import {catalogue} from '@/lib/catalogue';
import {checkOrigin,requireRole} from '@/lib/auth';
import {database} from '@/lib/db';
import {json,failure} from '@/lib/http';
import {z} from 'zod';
export const runtime='nodejs';
const fields=z.object({headline:z.string().trim().min(1).max(100),intro:z.string().trim().min(1).max(300),story:z.string().trim().min(1).max(4000),hours:z.string().trim().min(1).max(700),location:z.string().trim().min(1).max(500)}).strict();
const payload=z.object({version:z.number().int().min(0),settings:fields}).strict();
export async function GET(){try{await requireRole(['owner']);const c=await catalogue();const [drafts]=await database().query('SELECT id,base_version,value,created_at FROM website_revisions WHERE status=\'draft\' ORDER BY id DESC LIMIT 20');return json({settings:c.settings,version:c.version,drafts})}catch(e){return failure(e)}}
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
   await conn.execute('INSERT INTO website_revisions(base_version,value,status,created_by) VALUES(?,?,\'published\',?)',[p.data.version,JSON.stringify(p.data.settings),u.id]);
   await conn.commit();return json({ok:true,version:p.data.version+1});
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
 }catch(e){return failure(e)}
}

export async function POST(req:Request){
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{const u=await requireRole(['owner']);const p=payload.safeParse(await req.json());if(!p.success)return json({error:'Invalid website draft'},400);const conn=await database().getConnection();
 try{await conn.beginTransaction();const [result]=await conn.execute('INSERT INTO website_revisions(base_version,value,created_by) VALUES(?,?,?)',[p.data.version,JSON.stringify(p.data.settings),u.id]);const id=(result as {insertId:number}).insertId;await conn.execute('INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES(?,?,?,?)',[u.id,'draft','website_revision',String(id)]);await conn.commit();return json({id});}catch(e){await conn.rollback();throw e}finally{conn.release()}
 }catch(e){return failure(e)}
}
