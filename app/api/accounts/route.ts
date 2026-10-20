import {checkOrigin,requireRole,hashPassword} from '@/lib/auth';
import {database} from '@/lib/db';
import {json,failure} from '@/lib/http';
import {z} from 'zod';
export const runtime='nodejs';
const account=z.object({email:z.string().email().max(254),name:z.string().trim().min(1).max(120),role:z.enum(['owner','staff']),password:z.string().min(12).max(128)}).strict();
export async function GET(){try{await requireRole(['owner']);const [users]=await database().execute('SELECT id,email,display_name,role,active FROM users ORDER BY id');return json({users})}catch(e){return failure(e)}}
export async function POST(req:Request){
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const u=await requireRole(['owner']);let body:unknown;try{body=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const p=account.safeParse(body);if(!p.success)return json({error:'Invalid account fields'},400);
  const hash=hashPassword(p.data.password),conn=await database().getConnection();
  try{
   await conn.beginTransaction();
   const [r]=await conn.execute('INSERT INTO users(email,display_name,role,password_hash) VALUES(?,?,?,?)',[p.data.email.toLowerCase(),p.data.name,p.data.role,hash]);
   await conn.execute('INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES(?,?,?,?)',[u.id,'create','user',String((r as {insertId:number}).insertId)]);
   await conn.commit();return json({ok:true},201);
  }catch(e){await conn.rollback();if((e as {code?:string}).code==='ER_DUP_ENTRY')return json({error:'An account already uses that email'},409);throw e}finally{conn.release()}
 }catch(e){return failure(e)}
}
