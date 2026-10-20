import {checkOrigin,requireRole} from '@/lib/auth';
import {database} from '@/lib/db';
import {json,failure} from '@/lib/http';
import {z} from 'zod';
import type {RowDataPacket} from 'mysql2';
export const runtime='nodejs';
const status=z.object({id:z.string().uuid(),version:z.number().int().positive(),status:z.enum(['Preparing','Ready','Collected','Cancelled'])}).strict();
export async function GET(){
 try{
  await requireRole(['owner','manager','staff']);
  const [rows]=await database().execute<RowDataPacket[]>("SELECT id,customer,slot,items,status,version,created_at FROM test_orders WHERE is_test=1 AND status NOT IN ('Collected','Cancelled') ORDER BY created_at LIMIT 100");
  // Operational projection only: no account IDs, totals, payment or customer contact data.
  return json({orders:rows.map(o=>({...o,items:JSON.parse(o.items).map((i:{name:string;quantity:number})=>({name:i.name,quantity:i.quantity}))}))});
 }catch(e){return failure(e)}
}
export async function PATCH(req:Request){
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const u=await requireRole(['owner','manager','staff']);let body:unknown;try{body=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const p=status.safeParse(body);if(!p.success)return json({error:'Invalid status update'},400);
  const conn=await database().getConnection();
  try{
   await conn.beginTransaction();
   const [rows]=await conn.execute<RowDataPacket[]>('SELECT status,version FROM test_orders WHERE id=? AND is_test=1 FOR UPDATE',[p.data.id]);const old=rows[0];
   if(!old||old.version!==p.data.version){await conn.rollback();return json({error:'Order changed. Refresh the queue.'},409)}
   const next:Record<string,string>={New:'Preparing',Preparing:'Ready',Ready:'Collected'};
   const cancel=u.role==='owner'&&p.data.status==='Cancelled'&&['New','Preparing','Ready'].includes(old.status);
   if(next[old.status]!==p.data.status&&!cancel){await conn.rollback();return json({error:'Status transition is not allowed'},403)}
   await conn.execute('UPDATE test_orders SET status=?,version=version+1 WHERE id=?',[p.data.status,p.data.id]);
   await conn.execute('INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES(?,?,?,?)',[u.id,'status:'+p.data.status,'test_order',p.data.id]);
   await conn.commit();return json({ok:true});
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
 }catch(e){return failure(e)}
}
