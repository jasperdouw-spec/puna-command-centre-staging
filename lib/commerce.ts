import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import type {PoolConnection} from 'mysql2/promise';
import type {RowDataPacket} from 'mysql2';
import {database} from './db';
import {CommerceError,quoteCart,batchFits,capacityConfig,type CartInput,type SaleProduct} from './commerce-model';
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export const sqlDate=(d:number|string|Date)=>new Date(d).toISOString().replace('T',' ').slice(0,23);
export async function transaction<T>(fn:(c:PoolConnection,now:number)=>Promise<T>):Promise<T>{
 const c=await database().getConnection();let locked=false;
 try{
  const [lock]=await c.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT(DATABASE(),':commerce'),5) AS acquired");
  if(Number(lock[0].acquired)!==1)throw new CommerceError('BUSY_RETRY',503);locked=true;
  await c.query("SET time_zone='+00:00'");await c.beginTransaction();
  const [clock]=await c.query<RowDataPacket[]>('SELECT UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000 AS now_ms');
  const result=await fn(c,Number(clock[0].now_ms));await c.commit();return result;
 }catch(e){await c.rollback();throw e}finally{if(locked)await c.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':commerce'))");c.release()}
}
export async function audit(c:PoolConnection,actor:number|null,action:string,type:string,id:string){
 await c.execute('INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES(?,?,?,?)',[actor,action,type,id]);
}
export async function configuration(c:PoolConnection){
 const [rows]=await c.query<RowDataPacket[]>('SELECT id,configuration FROM capacity_versions WHERE effective_at<=UTC_TIMESTAMP(3) ORDER BY effective_at DESC,id DESC LIMIT 1');
 if(!rows.length)throw new CommerceError('SCHEDULE_UNCONFIGURED');
 const value=capacityConfig.parse(JSON.parse(rows[0].configuration));if(!value.verified||value.paused)throw new CommerceError('ORDERING_PAUSED');
 return {id:Number(rows[0].id),value};
}
export async function saleProducts(c:PoolConnection,ids:string[],lock=false){
 const [rows]=await c.query<RowDataPacket[]>(`SELECT p.id,p.name,p.price_cents,p.available,p.kind,p.version,
 m.category,m.publication,m.price_confirmed,m.ingredients_confirmed,m.tax_rules,m.deposit_cents,m.oven_units,m.packing_seconds,
 b.physical_units,b.committed_units,b.known
 FROM products p JOIN commerce_products m ON p.id=m.product_id
 LEFT JOIN inventory_balances b ON b.product_id=p.id AND b.location='truck'
 AND b.stage=CASE m.category WHEN 'empanada' THEN 'frozen' WHEN 'sauce' THEN 'portion' ELSE 'packaged' END
 WHERE p.id IN (?) ORDER BY p.id${lock?' FOR UPDATE':''}`,[ids]);
 return rows.map(r=>({...r,price_cents:Number(r.price_cents),version:Number(r.version),tax_rules:r.tax_rules===null?null:JSON.parse(r.tax_rules),available:!!r.available,price_confirmed:!!r.price_confirmed,ingredients_confirmed:!!r.ingredients_confirmed,known:!!r.known})) as SaleProduct[];
}
export async function release(c:PoolConnection,order:RowDataPacket,actor:number|null,reason:string){
 if(order.hold_status==='released')return;
 if(['inflight','uncertain','paid'].includes(order.payment_status))throw new CommerceError('PAYMENT_RECONCILIATION_REQUIRED');
 const [lines]=await c.query<RowDataPacket[]>('SELECT * FROM pickup_order_lines WHERE order_id=? ORDER BY product_id',[order.id]);
 for(const l of lines){
  await c.execute("UPDATE inventory_balances SET committed_units=committed_units-?,version=version+1 WHERE product_id=? AND location='truck' AND stage=?",[l.quantity,l.product_id,l.inventory_stage]);
  await c.execute("INSERT INTO inventory_movements(id,operation_key,product_id,from_location,to_location,from_stage,to_stage,quantity,kind,reason,actor_id,reference_id) VALUES(?,?,?,'truck','truck',?,?,?,'release',?,?,?)",[randomUUID(),'release:'+order.id+':'+l.product_id,l.product_id,l.inventory_stage,l.inventory_stage,l.quantity,reason,actor,order.id]);
 }
 const oven=lines.reduce((n,l)=>n+Number(l.oven_units),0),pack=lines.reduce((n,l)=>n+Number(l.packing_seconds),0);
 await c.execute('UPDATE service_batches SET oven_committed=oven_committed-?,packing_committed_seconds=packing_committed_seconds-?,version=version+1 WHERE id=?',[oven,pack,order.batch_id]);
 await c.execute("UPDATE pickup_orders SET hold_status='released',order_status='cancelled',version=version+1 WHERE id=?",[order.id]);
 await audit(c,actor,'release:'+reason,'pickup_order',order.id);
}
export async function expireDefiniteHolds(c:PoolConnection,now:number){
 const [orders]=await c.query<RowDataPacket[]>("SELECT * FROM pickup_orders WHERE hold_status='held' AND payment_status IN ('unpaid','failed') AND expires_at<=? ORDER BY id FOR UPDATE",[sqlDate(now)]);
 for(const o of orders)await release(c,o,null,'expired');
}
export async function rateLimit(c:PoolConnection,key:string,now:number,limit=15){
 const id=digest(key);await c.execute('INSERT IGNORE INTO request_limits(id_hash,window_at,attempts) VALUES(?,?,0)',[id,sqlDate(now)]);
 await c.execute('UPDATE request_limits SET attempts=IF(window_at<DATE_SUB(?,INTERVAL 10 MINUTE),1,attempts+1),window_at=IF(window_at<DATE_SUB(?,INTERVAL 10 MINUTE),?,window_at) WHERE id_hash=?',[sqlDate(now),sqlDate(now),sqlDate(now),id]);
 const [rows]=await c.execute<RowDataPacket[]>('SELECT attempts FROM request_limits WHERE id_hash=?',[id]);
 return Number(rows[0].attempts)<=limit;
}
export async function checkoutQuote(cart:CartInput){
 return transaction(async(c,now)=>{await expireDefiniteHolds(c,now);const config=await configuration(c);const products=await saleProducts(c,cart.map(i=>i.id));
  for(const p of products)p.physical_units=Math.max(0,p.physical_units-config.value.safetyStock);
  const quote=quoteCart(cart,products,config.value.maxItems);
  const [batches]=await c.query<RowDataPacket[]>("SELECT id,bake_at,cutoff_at,pickup_at,pickup_until,oven_capacity,oven_committed,packing_capacity_seconds,packing_committed_seconds,state FROM service_batches WHERE cutoff_at>? AND pickup_at<DATE_ADD(?,INTERVAL ? DAY) ORDER BY pickup_at LIMIT 300",[sqlDate(now),sqlDate(now),config.value.horizonDays]);
  return {quote,slots:batches.filter(b=>batchFits(b as never,quote,now)).map(b=>({id:b.id,pickupAt:new Date(b.pickup_at).toISOString(),pickupUntil:new Date(b.pickup_until).toISOString(),remainingPieces:b.oven_capacity-b.oven_committed})),serverTime:new Date(now).toISOString()};
 });
}
export type HoldInput={checkoutKey:string;accessKey:string;batchId:string;cart:CartInput;expectedTotal:number;name:string;email:string};
export async function reserve(input:HoldInput){
 const bodyHash=digest(JSON.stringify({batchId:input.batchId,cart:[...input.cart].sort((a,b)=>a.id.localeCompare(b.id)),name:input.name,email:input.email.toLowerCase(),receipt:digest(input.accessKey),expectedTotal:input.expectedTotal}));
 return transaction(async(c,now)=>{
  await expireDefiniteHolds(c,now);
  const [existing]=await c.execute<RowDataPacket[]>('SELECT * FROM pickup_orders WHERE checkout_key=? FOR UPDATE',[input.checkoutKey]);
  if(existing.length){const o=existing[0];if(o.request_hash!==bodyHash)throw new CommerceError('CHECKOUT_CONFLICT');return {id:o.id,expiresAt:new Date(o.expires_at).toISOString(),totalCents:o.total_cents,state:o.payment_status};}
  const config=await configuration(c);
  const products=await saleProducts(c,input.cart.map(i=>i.id),true);for(const p of products)p.physical_units=Math.max(0,p.physical_units-config.value.safetyStock);
  const q=quoteCart(input.cart,products,config.value.maxItems);if(q.total_cents!==input.expectedTotal)throw new CommerceError('PRICES_CHANGED_REVIEW_BAG');
  const [batches]=await c.execute<RowDataPacket[]>('SELECT * FROM service_batches WHERE id=? FOR UPDATE',[input.batchId]);const b=batches[0];
  if(!b||!batchFits(b as never,q,now)||new Date(b.pickup_at).getTime()>now+config.value.horizonDays*86400000)throw new CommerceError('PICKUP_NO_LONGER_AVAILABLE');
  const id=randomUUID(),expiry=Math.min(now+config.value.holdSeconds*1000,new Date(b.cutoff_at).getTime());
  await c.execute("INSERT INTO pickup_orders(id,checkout_key,request_hash,receipt_hash,batch_id,expires_at,contact_name,contact_email,subtotal_cents,tax_cents,deposit_cents,total_cents,payment_idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",[id,input.checkoutKey,bodyHash,digest(input.accessKey),b.id,sqlDate(expiry),input.name,input.email.toLowerCase(),q.subtotal_cents,q.tax_cents,q.deposit_cents,q.total_cents,randomUUID()]);
  for(const l of q.lines){
   await c.execute('INSERT INTO pickup_order_lines(order_id,product_id,name,quantity,unit_price_cents,tax_snapshot,tax_cents,deposit_cents,oven_units,packing_seconds,inventory_stage) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,l.id,l.name,l.quantity,l.unit_price_cents,JSON.stringify(l.tax_snapshot),l.tax_cents,l.deposit_cents,l.oven_units,l.packing_seconds,l.inventory_stage]);
   await c.execute("UPDATE inventory_balances SET committed_units=committed_units+?,version=version+1 WHERE product_id=? AND location='truck' AND stage=?",[l.quantity,l.id,l.inventory_stage]);
   await c.execute("INSERT INTO inventory_movements(id,operation_key,product_id,from_location,to_location,from_stage,to_stage,quantity,kind,reason,reference_id) VALUES(?,?,?,'truck','truck',?,?,?,'reserve','Checkout hold',?)",[randomUUID(),'reserve:'+id+':'+l.id,l.id,l.inventory_stage,l.inventory_stage,l.quantity,id]);
  }
  await c.execute('UPDATE service_batches SET oven_committed=oven_committed+?,packing_committed_seconds=packing_committed_seconds+?,version=version+1 WHERE id=?',[q.oven_units,q.packing_seconds,b.id]);
  await audit(c,null,'reserve','pickup_order',id);
  return {id,expiresAt:new Date(expiry).toISOString(),totalCents:q.total_cents,state:'unpaid'};
 });
}
export async function orderAccess(c:PoolConnection,id:string,key:string,lock=false){
 const [rows]=await c.execute<RowDataPacket[]>('SELECT * FROM pickup_orders WHERE id=? AND receipt_hash=?'+(lock?' FOR UPDATE':''),[id,digest(key)]);
 if(!rows[0])throw new CommerceError('ORDER_NOT_FOUND',404);return rows[0];
}
export function commerceEnabled(){return process.env.PUNA_CHECKOUT_MODE==='square-sandbox'&&!!process.env.SQUARE_SANDBOX_ACCESS_TOKEN&&!!process.env.SQUARE_SANDBOX_LOCATION_ID&&!!process.env.SQUARE_SANDBOX_APPLICATION_ID&&!!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY&&!!process.env.PUNA_JOB_TOKEN&&!!process.env.SQUARE_WEBHOOK_URL}
