import {catalogue} from '@/lib/catalogue';
import {currentUser,checkOrigin,requireRole} from '@/lib/auth';
import {database} from '@/lib/db';
import {json,failure} from '@/lib/http';
import {slots} from '@/lib/puna';
import {z} from 'zod';
import type {RowDataPacket} from 'mysql2';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const order=z.object({action:z.literal('order'),id:z.string().uuid(),customer:z.string().trim().min(1).max(80),slot:z.enum(slots as [string,...string[]]),items:z.array(z.object({id:z.string().max(64),quantity:z.number().int().min(1).max(20)}).strict()).min(1).max(5)}).strict();
export async function GET(){try{const u=await currentUser();const c=await catalogue();return json({products:c.products,settings:c.settings,canManage:!!u,workspaceHref:u?'/workspace':'/sign-in',testOrdersEnabled:process.env.STAGING_TEST_ORDERS_ENABLED==='true'});}catch(e){return failure(e)}}
export async function POST(req:Request){
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const user=await requireRole(['owner','manager','staff']);
  // There is deliberately no production-order or payment pathway.
  if(process.env.STAGING_TEST_ORDERS_ENABLED!=='true')return json({error:'Test ordering is disabled'},403);
  let raw:unknown;try{raw=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const p=order.safeParse(raw);if(!p.success)return json({error:'Invalid test order'},400);
  const a=p.data;if(new Set(a.items.map(i=>i.id)).size!==a.items.length)return json({error:'Duplicate products'},400);
  const conn=await database().getConnection();
  try{
   await conn.beginTransaction();
   // Serialize per-account test orders, enforce a bounded queue and retry idempotently.
   await conn.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[user.id]);
   const [old]=await conn.execute<RowDataPacket[]>('SELECT created_by,total FROM test_orders WHERE id=?',[a.id]);
   if(old[0]){await conn.rollback();return old[0].created_by===user.id?json({ok:true,id:a.id,total:Number(old[0].total)}):json({error:'Order ID already used'},409)}
   const [rate]=await conn.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM test_orders WHERE created_by=? AND created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 10 MINUTE)',[user.id]);
   if(Number(rate[0].n)>=20){await conn.rollback();return json({error:'Too many test orders. Try again later.'},429)}
   const items=[];let total=0;
   for(const i of [...a.items].sort((x,y)=>x.id.localeCompare(y.id))){
    const [rows]=await conn.execute<RowDataPacket[]>('SELECT id,name,price_cents,kind,available FROM products WHERE id=? LOCK IN SHARE MODE',[i.id]);const product=rows[0];
    if(!product||product.kind!=='fresh'||!product.available){await conn.rollback();return json({error:'Item unavailable. Refresh the menu.'},409)}
    const price=Number(product.price_cents);total+=price*i.quantity;items.push({id:product.id,name:product.name,quantity:i.quantity,price});
   }
   await conn.execute('INSERT INTO test_orders(id,created_by,customer,slot,items,total) VALUES(?,?,?,?,?,?)',[a.id,user.id,a.customer,a.slot,JSON.stringify(items),total]);
   await conn.execute('INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES(?,?,?,?)',[user.id,'create','test_order',a.id]);
   await conn.commit();return json({ok:true,id:a.id,total});
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
 }catch(e){return failure(e)}
}
