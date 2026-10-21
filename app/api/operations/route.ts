import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {RowDataPacket} from 'mysql2';
import {requireRole,checkOrigin} from '@/lib/auth';
import {database} from '@/lib/db';
import {json,failure} from '@/lib/http';
import {CommerceError,capacityConfig} from '@/lib/commerce-model';
import {transaction,audit} from '@/lib/commerce';
import {stockChange,saveCapacity,progressBatch,collectOrder} from '@/lib/operations';
import {sandboxRefund} from '@/lib/square';
export const runtime='nodejs';
export async function GET(){
 try{
  const u=await requireRole(['owner','manager','staff']),owner=u.role==='owner';
  const [batches]=await database().query<RowDataPacket[]>("SELECT id,bake_at,cutoff_at,pickup_at,pickup_until,state,manifest,version,exception_note,oven_capacity,oven_committed FROM service_batches WHERE pickup_until>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY) ORDER BY pickup_at LIMIT 200");
  const [orders]=await database().query<RowDataPacket[]>("SELECT o.id,o.batch_id,o.contact_name,o.fulfilment_status,o.order_status,o.version,o.is_test FROM pickup_orders o JOIN service_batches b ON b.id=o.batch_id WHERE o.payment_status='paid' AND o.refund_status='none' AND o.order_status='open' AND b.pickup_until>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY) ORDER BY b.pickup_at,o.created_at LIMIT 200");
  for(const o of orders){const [items]=await database().execute('SELECT name,quantity FROM pickup_order_lines WHERE order_id=?',[o.id]);o.items=items;}
  const data:Record<string,unknown>={batches,orders,serverTime:new Date().toISOString(),owner,connection:'online'};
  if(owner){
   const [stock]=await database().query("SELECT b.*,p.name FROM inventory_balances b JOIN products p ON p.id=b.product_id ORDER BY p.name,b.location,b.stage");
   const [exceptions]=await database().query("SELECT id,payment_status,refund_status,order_status,batch_id FROM pickup_orders WHERE order_status='exception' OR payment_status IN ('inflight','uncertain') ORDER BY created_at LIMIT 100");
   const [notices]=await database().query("SELECT id,kind,message,status,batch_id,created_at FROM operations_notices WHERE status='open' ORDER BY created_at DESC LIMIT 100");
   const [config]=await database().query('SELECT id,effective_at,configuration FROM capacity_versions ORDER BY id DESC LIMIT 1');
   const [recipes]=await database().query('SELECT id,product_id,version,name,yield_units,verification FROM recipe_versions ORDER BY name,version DESC');
   const [feedback]=await database().query('SELECT id,screen_path,category,message,status,created_at FROM feedback ORDER BY created_at DESC LIMIT 100');
   const [auditRows]=await database().query('SELECT id,action,entity_type,entity_id,created_at FROM audit_log ORDER BY id DESC LIMIT 100');
   const [products]=await database().query('SELECT id,name,kind FROM products ORDER BY name');Object.assign(data,{stock,exceptions,notices,configuration:config,recipes,feedback,audit:auditRows,products});
  }
  return json(data);
 }catch(e){return failure(e)}
}
const operation=z.discriminatedUnion('action',[
 z.object({action:z.literal('stock'),key:z.string().uuid(),id:z.string().max(64),location:z.enum(['truck','factory']),stage:z.enum(['ingredient','frozen','baking','ready','portion','packaged']),quantity:z.number().int().min(0).max(100000),version:z.number().int().positive(),kind:z.enum(['opening','receipt','waste','adjustment','transfer']),reason:z.string().trim().min(5).max(500),toLocation:z.enum(['truck','factory']).optional()}).strict(),
 z.object({action:z.literal('capacity'),configuration:capacityConfig,effectiveAt:z.string().datetime(),dates:z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(30)}).strict(),
 z.object({action:z.literal('batch'),id:z.string().uuid(),version:z.number().int().positive(),transition:z.enum(['close','load','ready','pause'])}).strict(),
 z.object({action:z.literal('collect'),id:z.string().uuid(),receiptKey:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({action:z.literal('notice'),batchId:z.string().uuid().nullable(),kind:z.enum(['shortage','late','pause','stock','payment']),message:z.string().trim().min(5).max(1000)}).strict(),
 z.object({action:z.literal('refund'),id:z.string().uuid(),amount:z.number().int().positive(),reason:z.string().trim().min(5).max(300)}).strict(),
 z.object({action:z.literal('feedback'),screen:z.string().startsWith('/').max(500),category:z.enum(['bug','feature','question']),message:z.string().trim().min(5).max(3000)}).strict()
]);
export async function POST(req:Request){
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const u=await requireRole(['owner','manager','staff']),raw=await req.text();if(raw.length>20000)return json({error:'Request too large'},413);
  const parsed=operation.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Invalid operation'},400);const p=parsed.data;
  if(['stock','capacity','refund'].includes(p.action)&&u.role!=='owner')return json({error:'Access denied'},403);
  if(p.action==='stock')return json(await stockChange(u.id,p));
  if(p.action==='capacity')return json(await saveCapacity(u.id,p));
  if(p.action==='batch')return json(await progressBatch(u.id,p.id,p.version,p.transition));
  if(p.action==='collect')return json(await collectOrder(u.id,p.id,p.receiptKey));
  if(p.action==='refund')return json(await sandboxRefund(p.id,u.id,p.amount,p.reason));
  if(p.action==='notice')return json(await transaction(async(c)=>{const id=randomUUID();await c.execute('INSERT INTO operations_notices(id,batch_id,actor_id,kind,message) VALUES(?,?,?,?,?)',[id,p.batchId,u.id,p.kind,p.message]);await audit(c,u.id,'notice:'+p.kind,'operations_notice',id);return {id};}),201);
  return json(await transaction(async(c)=>{const [r]=await c.execute('INSERT INTO feedback(user_id,screen_path,category,message) VALUES(?,?,?,?)',[u.id,p.screen,p.category,p.message]);await audit(c,u.id,'feedback:create','feedback',String((r as {insertId:number}).insertId));return {saved:true};}),201);
 }catch(e){if(e instanceof SyntaxError)return json({error:'Invalid JSON'},400);return e instanceof CommerceError?json({error:e.code},e.status):failure(e);}
}
