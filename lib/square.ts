import 'server-only';
import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import type {RowDataPacket} from 'mysql2';
import {transaction,orderAccess,commerceEnabled,audit,sqlDate,release,digest} from './commerce';
import {CommerceError,type TaxRule} from './commerce-model';
const api='https://connect.squareupsandbox.com/v2';
export type Payment={id:string;status:string;order_id?:string;location_id?:string;amount_money?:{amount:number;currency:string};total_money?:{amount:number;currency:string};refunded_money?:{amount:number;currency:string};created_at?:string};
async function square(path:string,body?:unknown){
 if(!commerceEnabled())throw new CommerceError('SANDBOX_NOT_CONFIGURED',503);
 const response=await fetch(api+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+process.env.SQUARE_SANDBOX_ACCESS_TOKEN,'Content-Type':'application/json','Square-Version':'2026-09-16'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),cache:'no-store'});
 const result=await response.json();
 if(!response.ok){if(path==='/payments'&&response.status===400&&result.errors?.some((e:{code:string})=>['CARD_DECLINED','CVV_FAILURE','ADDRESS_VERIFICATION_FAILURE','CARD_EXPIRED','INVALID_CARD','CARD_NOT_SUPPORTED'].includes(e.code)))throw new CommerceError('PAYMENT_DECLINED',402);throw new CommerceError(response.status>=500?'PROVIDER_UNCERTAIN':'PROVIDER_REQUEST_REJECTED',502);}
 return result;
}
export function verifySignature(raw:string,signature:string|null,url:string,key:string){
 if(!signature||signature.length>200)return false;
 const expected=createHmac('sha256',key).update(url+raw).digest('base64'),a=Buffer.from(expected),b=Buffer.from(signature);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function verifyPayment(p:Payment,o:{id:string;square_order_id:string;total_cents:number},location:string){
 const amount=p.total_money||p.amount_money;
 if(!p.id||p.order_id!==o.square_order_id||p.location_id!==location||!amount||amount.currency!=='CAD'||Number(amount.amount)!==Number(o.total_cents))throw new CommerceError('PAYMENT_MISMATCH');
 if(p.refunded_money&&p.refunded_money.currency!=='CAD')throw new CommerceError('PAYMENT_MISMATCH');
 return {paid:p.status==='COMPLETED',definiteFailure:['FAILED','CANCELED'].includes(p.status),refunded:Number(p.refunded_money?.amount||0)};
}
export async function applyPayment(id:string,p:Payment){
 return transaction(async(c,now)=>{
  const [rows]=await c.execute<RowDataPacket[]>('SELECT o.*,b.cutoff_at,b.state AS batch_state FROM pickup_orders o JOIN service_batches b ON b.id=o.batch_id WHERE o.id=? FOR UPDATE',[id]);const o=rows[0];if(!o)throw new CommerceError('ORDER_NOT_FOUND',404);
  const result=verifyPayment(p,o as never,process.env.SQUARE_SANDBOX_LOCATION_ID!);
  if(o.square_payment_id&&o.square_payment_id!==p.id)throw new CommerceError('PAYMENT_MISMATCH');
  if(result.paid){
   const late=new Date(o.cutoff_at).getTime()<=now&&o.payment_status!=='paid';
   const exception=late||o.hold_status==='released'||o.batch_state!=='open'&&o.payment_status!=='paid';
   const refund=result.refunded>=Number(o.total_cents)?'refunded':result.refunded>0?'partial':o.refund_status;
   await c.execute("UPDATE pickup_orders SET payment_status='paid',square_payment_id=?,hold_status=IF(hold_status='released','released','committed'),refund_status=?,order_status=IF(?,'exception',order_status),version=version+1 WHERE id=?",[p.id,refund,exception?1:0,id]);
   if(o.payment_status!=='paid')await audit(c,null,exception?'payment:late_exception':'payment:captured','pickup_order',id);
   if(exception&&o.payment_status!=='paid')await c.execute("INSERT INTO operations_notices(id,batch_id,actor_id,kind,message) SELECT ?,?,id,'payment',? FROM users WHERE role='owner' AND active=1 ORDER BY id LIMIT 1",[randomUUID(),o.batch_id,'Captured payment needs owner review. Order '+id]);
   await c.execute("INSERT IGNORE INTO provider_jobs(id,kind,order_id,available_at,operation_key,status,last_error_code) VALUES(?,'receipt',?,?,?,'blocked','RECEIPT_DELIVERY_NOT_CONFIGURED')",[randomUUID(),id,sqlDate(now),'receipt:'+id]);
   return {state:'paid',exception,refundStatus:refund};
  }
  // A stale event cannot downgrade an already verified capture or refund.
  if(o.payment_status==='paid')return {state:'paid',exception:o.order_status==='exception',refundStatus:o.refund_status};
  if(result.definiteFailure){await c.execute("UPDATE pickup_orders SET payment_status='failed',square_payment_id=? WHERE id=?",[p.id,id]);await release(c,{...o,payment_status:'failed'} as RowDataPacket,null,'provider_failed');return {state:'failed'};}
  await c.execute("UPDATE pickup_orders SET payment_status='uncertain',square_payment_id=?,version=version+1 WHERE id=?",[p.id,id]);return {state:'uncertain'};
 });
}
export async function startPayment(id:string,key:string,sourceToken:string){
 if(!commerceEnabled())throw new CommerceError('SANDBOX_NOT_CONFIGURED',503);
 const data=await transaction(async(c,now)=>{
  const o=await orderAccess(c,id,key,true);
  if(o.payment_status==='paid')return {existing:true,o};
  if(o.payment_status!=='unpaid')throw new CommerceError('PAYMENT_RECONCILIATION_REQUIRED');
  const [bs]=await c.execute<RowDataPacket[]>('SELECT * FROM service_batches WHERE id=? FOR UPDATE',[o.batch_id]);
  if(o.hold_status!=='held'||new Date(o.expires_at).getTime()<=now||new Date(bs[0].cutoff_at).getTime()<=now||bs[0].state!=='open')throw new CommerceError('HOLD_EXPIRED');
  const [lines]=await c.execute<RowDataPacket[]>('SELECT * FROM pickup_order_lines WHERE order_id=? ORDER BY product_id',[id]);
  await c.execute("UPDATE pickup_orders SET payment_status='inflight',version=version+1 WHERE id=?",[id]);
  await c.execute("INSERT IGNORE INTO provider_jobs(id,kind,order_id,available_at,operation_key) VALUES(?,'reconcile_payment',?,?,?)",[randomUUID(),id,sqlDate(now+30000),'payment:'+id]);
  await audit(c,null,'payment:started','pickup_order',id);return {existing:false,o,lines,batch:bs[0]};
 });
 if(data.existing)return {state:'paid'};
 try{
  const taxes:Array<Record<string,unknown>>=[],items:Array<Record<string,unknown>>=[];
  for(const l of data.lines!){
   const rules=JSON.parse(l.tax_snapshot) as TaxRule[],applied:Array<{tax_uid:string}>=[];
   for(let i=0;i<rules.length;i++){const uid=l.product_id+'-'+i;taxes.push({uid,name:rules[i].name,percentage:String(rules[i].basis_points/100),scope:'LINE_ITEM',type:'ADDITIVE'});applied.push({tax_uid:uid});}
   items.push({uid:l.product_id,name:l.name,quantity:String(l.quantity),base_price_money:{amount:Number(l.unit_price_cents),currency:'CAD'},applied_taxes:applied});
   if(Number(l.deposit_cents)>0)items.push({uid:l.product_id+'-deposit',name:'Container deposit',quantity:'1',base_price_money:{amount:Number(l.deposit_cents),currency:'CAD'},applied_taxes:rules.flatMap((r,i)=>r.deposit_taxable?[{tax_uid:l.product_id+'-'+i}]:[])});
  }
  const orderResponse=await square('/orders',{idempotency_key:data.o.checkout_key,order:{location_id:process.env.SQUARE_SANDBOX_LOCATION_ID,reference_id:id,line_items:items,taxes,fulfillments:[{type:'PICKUP',state:'PROPOSED',pickup_details:{schedule_type:'SCHEDULED',pickup_at:new Date(data.batch!.pickup_at).toISOString(),recipient:{display_name:data.o.contact_name,email_address:data.o.contact_email},note:'SANDBOX TEST — no real pickup'}}]}});
  const providerOrder=orderResponse.order;
  if(!providerOrder?.id||Number(providerOrder.total_money?.amount)!==Number(data.o.total_cents)||providerOrder.total_money?.currency!=='CAD')throw new CommerceError('PROVIDER_TOTAL_MISMATCH');
  await transaction(async(c)=>{await c.execute('UPDATE pickup_orders SET square_order_id=? WHERE id=?',[providerOrder.id,id]);});
  const response=await square('/payments',{idempotency_key:data.o.payment_idempotency_key,source_id:sourceToken,amount_money:{amount:Number(data.o.total_cents),currency:'CAD'},autocomplete:true,location_id:process.env.SQUARE_SANDBOX_LOCATION_ID,order_id:providerOrder.id,reference_id:id});
  if(!response.payment?.id)throw new CommerceError('PROVIDER_UNCERTAIN');
  // Retrieve independently; the browser's tokenization callback is never payment proof.
  const verified=await square('/payments/'+encodeURIComponent(response.payment.id));
  return await applyPayment(id,verified.payment);
 }catch(e){
  if(e instanceof CommerceError&&e.code==='PAYMENT_DECLINED'){await transaction(async(c)=>{const o=await orderAccess(c,id,key,true);await c.execute("UPDATE pickup_orders SET payment_status='failed' WHERE id=?",[id]);await release(c,{...o,payment_status:'failed'} as RowDataPacket,null,'declined');});throw e;}
  await transaction(async(c)=>{await c.execute("UPDATE pickup_orders SET payment_status='uncertain',version=version+1 WHERE id=? AND payment_status='inflight'",[id]);});
  throw e;
 }
}
export async function reconcilePayment(id:string){
 const snapshot=await transaction(async(c)=>{const [rows]=await c.execute<RowDataPacket[]>('SELECT id,square_order_id,square_payment_id FROM pickup_orders WHERE id=?',[id]);return rows[0];});
 if(!snapshot)throw new CommerceError('ORDER_NOT_FOUND',404);
 let paymentId=snapshot.square_payment_id;
 if(!paymentId&&snapshot.square_order_id){const response=await square('/orders/'+encodeURIComponent(snapshot.square_order_id));const tenders=response.order?.tenders||[];paymentId=tenders.find((t:{payment_id?:string})=>t.payment_id)?.payment_id;}
 if(!paymentId)throw new CommerceError('PROVIDER_STATE_UNRESOLVED');
 const response=await square('/payments/'+encodeURIComponent(paymentId));return applyPayment(id,response.payment);
}
export async function handleWebhook(raw:string,signature:string|null){
 const url=process.env.SQUARE_WEBHOOK_URL,key=process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
 if(!url||!key||!verifySignature(raw,signature,url,key))throw new CommerceError('INVALID_SIGNATURE',403);
 const e=JSON.parse(raw);if(typeof e.event_id!=='string'||e.event_id.length>150||typeof e.type!=='string')throw new CommerceError('INVALID_EVENT',400);
 const objectId=e.data?.id;if(typeof objectId!=='string'||objectId.length>150)throw new CommerceError('INVALID_EVENT',400);
 return transaction(async(c,now)=>{
  const [old]=await c.execute<RowDataPacket[]>('SELECT body_hash FROM provider_events WHERE provider=? AND event_id=?',['square',e.event_id]);
  if(old.length){if(old[0].body_hash!==digest(raw))throw new CommerceError('EVENT_CONFLICT');return {duplicate:true};}
  await c.execute('INSERT INTO provider_events(provider,event_id,object_id,event_type,body_hash) VALUES(?,?,?,?,?)',['square',e.event_id,objectId,e.type,digest(raw)]);
  const orderId=e.data?.object?.payment?.order_id;const paymentId=e.data?.object?.refund?.payment_id;
  const [orders]=await c.execute<RowDataPacket[]>('SELECT id FROM pickup_orders WHERE square_payment_id=? OR square_order_id=?',[typeof paymentId==='string'?paymentId:objectId,typeof orderId==='string'?orderId:'']);
  for(const o of orders)await c.execute("INSERT INTO provider_jobs(id,kind,order_id,available_at,operation_key) VALUES(?,'reconcile_payment',?,?,?)",[randomUUID(),o.id,sqlDate(now),'event:'+e.event_id+':'+o.id]);
  return {accepted:true};
 });
}
export async function sandboxRefund(id:string,actor:number,amount:number,reason:string){
 const r=await transaction(async(c,now)=>{
  const [rows]=await c.execute<RowDataPacket[]>('SELECT * FROM pickup_orders WHERE id=? FOR UPDATE',[id]);const o=rows[0];
  if(!o||!o.is_test||o.payment_status!=='paid'||o.refund_status!=='none'||amount!==Number(o.total_cents)||o.fulfilment_status==='collected')throw new CommerceError('REFUND_NOT_ELIGIBLE');
  const refundId=randomUUID();await c.execute('INSERT INTO refunds(id,order_id,amount_cents,reason,requested_by) VALUES(?,?,?,?,?)',[refundId,id,amount,reason,actor]);
  await c.execute("UPDATE pickup_orders SET refund_status='pending',order_status='exception',version=version+1 WHERE id=?",[id]);
  await c.execute("INSERT INTO provider_jobs(id,kind,order_id,available_at,operation_key) VALUES(?,'refund',?,?,?)",[randomUUID(),id,sqlDate(now),'refund:'+refundId]);
  await audit(c,actor,'refund:requested','pickup_order',id);return {id:refundId,paymentId:o.square_payment_id};
 });
 return r;
}
export async function processRefund(orderId:string){
 const r=await transaction(async(c)=>{const [rows]=await c.execute<RowDataPacket[]>("SELECT r.*,o.square_payment_id FROM refunds r JOIN pickup_orders o ON o.id=r.order_id WHERE r.order_id=? AND r.state IN ('requested','pending') ORDER BY r.created_at LIMIT 1",[orderId]);return rows[0];});
 if(!r)return {state:'done'};
 const response=await square('/refunds',{idempotency_key:r.id,payment_id:r.square_payment_id,amount_money:{amount:Number(r.amount_cents),currency:'CAD'},reason:r.reason});
 const refund=response.refund;if(!refund?.id)throw new CommerceError('PROVIDER_UNCERTAIN');
 await transaction(async(c)=>{
  const state=refund.status==='COMPLETED'?'completed':['FAILED','REJECTED'].includes(refund.status)?'failed':'pending';
  await c.execute('UPDATE refunds SET provider_refund_id=?,state=? WHERE id=?',[refund.id,state,r.id]);
  await c.execute('UPDATE pickup_orders SET refund_status=?,order_status=IF(?=\'completed\',\'cancelled\',order_status),version=version+1 WHERE id=?',[state==='completed'?'refunded':state,state,orderId]);
  await audit(c,null,'refund:'+state,'pickup_order',orderId);
 });
 // Refunds never replenish food stock automatically.
 return {state:['COMPLETED','FAILED','REJECTED'].includes(refund.status)?'done':'pending'};
}
