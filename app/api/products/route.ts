import {NextResponse} from 'next/server';
import {database} from '@/lib/db';
import {requireRole,checkOrigin} from '@/lib/auth';
import {z} from 'zod';
export const runtime='nodejs';
const product=z.object({id:z.string().min(1).max(64),version:z.number().int().positive(),name:z.string().trim().min(1).max(120),description:z.string().max(10000),price_cents:z.number().int().min(0).max(100000),available:z.boolean(),confirm:z.boolean().default(false)}).strict();
function failure(e:unknown){const m=(e as Error).message;return NextResponse.json({error:m==='UNAUTHENTICATED'?'Sign in required':m==='FORBIDDEN'?'Access denied':'Service unavailable'},{status:m==='UNAUTHENTICATED'?401:m==='FORBIDDEN'?403:503})}
export async function GET(){try{await requireRole(['owner','manager']);const [rows]=await database().execute('SELECT id,name,description,price_cents,kind,available,source_status,updated_at,version FROM products ORDER BY kind,name');return NextResponse.json({products:rows},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
export async function PATCH(req:Request){
 if(!checkOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 try{
  const user=await requireRole(['owner','manager']);
  let body:unknown;try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  const parsed=product.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Invalid product fields'},{status:400});
  const p=parsed.data,conn=await database().getConnection();
  try{
   await conn.beginTransaction();
   const [result]=await conn.execute('UPDATE products SET name=?,description=?,price_cents=?,available=?,source_status=?,version=version+1 WHERE id=? AND version=?',[p.name,p.description,p.price_cents,p.available?1:0,p.confirm?'confirmed':'initial',p.id,p.version]);
   if(!(result as {affectedRows:number}).affectedRows){await conn.rollback();return NextResponse.json({error:'Product changed or was removed. Reload before saving.'},{status:409})}
   await conn.execute('INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES(?,?,?,?)',[user.id,p.confirm?'confirm':'update','product',p.id]);
   await conn.commit();return NextResponse.json({ok:true,version:p.version+1,source_status:p.confirm?'confirmed':'initial'});
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
 }catch(e){return failure(e)}
}
