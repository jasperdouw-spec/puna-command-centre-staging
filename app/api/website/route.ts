import {catalogue} from '@/lib/catalogue';
import {checkOrigin,requireRole} from '@/lib/auth';
import {database} from '@/lib/db';
import {json,failure} from '@/lib/http';
import {z} from 'zod';
export const runtime='nodejs';
const fields=z.object({headline:z.string().trim().min(1).max(100),intro:z.string().trim().min(1).max(300),story:z.string().trim().min(1).max(4000),hours:z.string().trim().min(1).max(700),location:z.string().trim().min(1).max(500)}).strict();
const payload=z.object({version:z.number().int().min(0),settings:fields}).strict();
export async function GET(){try{await requireRole(['owner']);const c=await catalogue();return json({settings:c.settings,version:c.version})}catch(e){return failure(e)}}
export async function PATCH(req:Request){
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const u=await requireRole(['owner']);let body:unknown;try{body=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const p=payload.safeParse(body);if(!p.success)return json({error:'Invalid website settings'},400);
  const conn=await database().getConnection();
  try{
   await conn.beginTransaction();
   // INSERT IGNORE handles two first saves without replacing the winner's content.
   const [result]=p.data.version===0?
    await conn.execute("INSERT IGNORE INTO website_settings(id,value) VALUES('business',?)",[JSON.stringify(p.data.settings)]):
    await conn.execute("UPDATE website_settings SET value=?,version=version+1 WHERE id='business' AND version=?",[JSON.stringify(p.data.settings),p.data.version]);
   if(!(result as {affectedRows:number}).affectedRows){await conn.rollback();return json({error:'Website changed. Reload before saving.'},409)}
   await conn.execute('INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES(?,?,?,?)',[u.id,'update','website','business']);
   await conn.commit();return json({ok:true,version:p.data.version+1});
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
 }catch(e){return failure(e)}
}
