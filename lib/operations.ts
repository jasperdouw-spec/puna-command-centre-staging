import 'server-only';
import {randomUUID} from 'node:crypto';
import type {PoolConnection} from 'mysql2/promise';
import type {RowDataPacket} from 'mysql2';
import {transaction,audit,sqlDate,digest} from './commerce';
import {CommerceError,capacityConfig,planBatches,type CapacityConfig} from './commerce-model';
export async function balance(c:PoolConnection,id:string,location:string,stage:string){
 await c.execute('INSERT IGNORE INTO inventory_balances(product_id,location,stage) VALUES(?,?,?)',[id,location,stage]);
 const [rows]=await c.execute<RowDataPacket[]>('SELECT * FROM inventory_balances WHERE product_id=? AND location=? AND stage=? FOR UPDATE',[id,location,stage]);return rows[0];
}
async function movement(c:PoolConnection,input:{key:string;id:string;quantity:number;kind:string;reason:string;actor:number;from?:{location:string;stage:string};to?:{location:string;stage:string};reference?:string}){
 await c.execute('INSERT INTO inventory_movements(id,operation_key,product_id,from_location,to_location,from_stage,to_stage,quantity,kind,reason,actor_id,reference_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[randomUUID(),input.key,input.id,input.from?.location||null,input.to?.location||null,input.from?.stage||null,input.to?.stage||null,input.quantity,input.kind,input.reason,input.actor,input.reference||null]);
}
export async function stockChange(actor:number,p:{key:string;id:string;location:'truck'|'factory';stage:string;quantity:number;version:number;kind:'opening'|'receipt'|'waste'|'adjustment'|'transfer';reason:string;toLocation?:'truck'|'factory'}){
 return transaction(async(c,now)=>{
  const [old]=await c.execute<RowDataPacket[]>('SELECT product_id,quantity,kind FROM inventory_movements WHERE operation_key=?',[p.key]);
  if(old.length){if(old[0].product_id!==p.id||Number(old[0].quantity)!==p.quantity||old[0].kind!==p.kind)throw new CommerceError('OPERATION_CONFLICT');return {duplicate:true};}
  const b=await balance(c,p.id,p.location,p.stage);if(Number(b.version)!==p.version)throw new CommerceError('STOCK_CHANGED');
  if(!b.known&&p.kind!=='opening')throw new CommerceError('STOCK_UNVERIFIED');
  if(p.kind==='opening'&&b.known)throw new CommerceError('OPENING_ALREADY_RECORDED');
  const next=p.kind==='opening'?p.quantity:p.kind==='receipt'?Number(b.physical_units)+p.quantity:p.kind==='adjustment'?p.quantity:Number(b.physical_units)-p.quantity;
  if(next<Number(b.committed_units)||next<0)throw new CommerceError('STOCK_COMMITTED');
  if(p.kind==='transfer'){
   if(!p.toLocation||p.toLocation===p.location)throw new CommerceError('INVALID_TRANSFER',400);
   const dest=await balance(c,p.id,p.toLocation,p.stage);if(!dest.known)throw new CommerceError('DESTINATION_STOCK_UNVERIFIED');
   await c.execute('UPDATE inventory_balances SET physical_units=physical_units+?,version=version+1 WHERE product_id=? AND location=? AND stage=?',[p.quantity,p.id,p.toLocation,p.stage]);
  }
  await c.execute('UPDATE inventory_balances SET physical_units=?,known=1,version=version+1,counted_at=IF(? IN (\'opening\',\'adjustment\'),?,counted_at),counted_by=IF(? IN (\'opening\',\'adjustment\'),?,counted_by) WHERE product_id=? AND location=? AND stage=?',[next,p.kind,sqlDate(now),p.kind,actor,p.id,p.location,p.stage]);
  await movement(c,{key:p.key,id:p.id,quantity:p.quantity,kind:p.kind,reason:p.reason,actor,from:{location:p.location,stage:p.stage},to:p.toLocation?{location:p.toLocation,stage:p.stage}:undefined});
  await audit(c,actor,'stock:'+p.kind,'product',p.id);return {version:p.version+1};
 });
}
export async function saveCapacity(actor:number,input:{configuration:CapacityConfig;effectiveAt:string;dates:string[]}){
 const config=capacityConfig.parse(input.configuration);
 return transaction(async(c,now)=>{
  if(Date.parse(input.effectiveAt)<now-60000)throw new CommerceError('EFFECTIVE_DATE_IN_PAST',400);
  const [result]=await c.execute('INSERT INTO capacity_versions(effective_at,configuration,created_by) VALUES(?,?,?)',[sqlDate(input.effectiveAt),JSON.stringify(config),actor]);
  const version=(result as {insertId:number}).insertId;let created=0;const conflicts:string[]=[];
  for(const date of input.dates)for(const planned of planBatches(config,date)){
   if(Date.parse(planned.bakeAt)<Date.parse(input.effectiveAt)||Date.parse(planned.bakeAt)<=now||Date.parse(planned.bakeAt)>now+config.horizonDays*86400000)continue;
   const [old]=await c.execute<RowDataPacket[]>('SELECT * FROM service_batches WHERE bake_at=? FOR UPDATE',[sqlDate(planned.bakeAt)]);
   if(old.length){
    // Preserve the version attached to existing reservations; flag capacity reductions for review.
    if(Number(old[0].oven_committed)>planned.ovenCapacity||Number(old[0].packing_committed_seconds)>planned.packingCapacitySeconds){
     conflicts.push(old[0].id);await c.execute("UPDATE service_batches SET exception_note='New capacity is below existing commitments',state=IF(state='open','paused',state),version=version+1 WHERE id=?",[old[0].id]);
     await c.execute("INSERT INTO operations_notices(id,batch_id,actor_id,kind,message) VALUES(?,?,?,'shortage','Capacity reduction conflicts with existing commitments; do not move or cancel paid orders silently')",[randomUUID(),old[0].id,actor]);
    }continue;
   }
   await c.execute('INSERT INTO service_batches(id,configuration_id,bake_at,cutoff_at,pickup_at,pickup_until,oven_capacity,packing_capacity_seconds) VALUES(?,?,?,?,?,?,?,?)',[randomUUID(),version,sqlDate(planned.bakeAt),sqlDate(planned.cutoffAt),sqlDate(planned.pickupAt),sqlDate(planned.pickupUntil),planned.ovenCapacity,planned.packingCapacitySeconds]);created++;
  }
  await audit(c,actor,'capacity:version','capacity',String(version));return {version,created,conflicts};
 });
}
async function transferCommitted(c:PoolConnection,l:RowDataPacket,from:string,to:string|undefined,actor:number,key:string,reference:string){
 const b=await balance(c,l.product_id,'truck',from);
 if(!b.known||Number(b.physical_units)<Number(l.quantity)||Number(b.committed_units)<Number(l.quantity))throw new CommerceError('STOCK_SHORTAGE');
 await c.execute("UPDATE inventory_balances SET physical_units=physical_units-?,committed_units=committed_units-?,version=version+1 WHERE product_id=? AND location='truck' AND stage=?",[l.quantity,l.quantity,l.product_id,from]);
 if(to){await balance(c,l.product_id,'truck',to);await c.execute("UPDATE inventory_balances SET physical_units=physical_units+?,committed_units=committed_units+?,known=1,version=version+1 WHERE product_id=? AND location='truck' AND stage=?",[l.quantity,l.quantity,l.product_id,to]);}
 await movement(c,{key,id:l.product_id,quantity:Number(l.quantity),kind:to==='baking'?'load':to==='ready'?'ready':'collect',reason:'Paid pickup fulfilment',actor,from:{location:'truck',stage:from},to:to?{location:'truck',stage:to}:undefined,reference});
}
export async function progressBatch(actor:number,id:string,version:number,action:'close'|'load'|'ready'|'pause'){
 return transaction(async(c,now)=>{
  const [rows]=await c.execute<RowDataPacket[]>('SELECT * FROM service_batches WHERE id=? FOR UPDATE',[id]);const b=rows[0];
  if(!b||Number(b.version)!==version)throw new CommerceError('BATCH_CHANGED');
  if(action==='pause'){if(!['open','paused'].includes(b.state))throw new CommerceError('BATCH_ALREADY_STARTED');await c.execute("UPDATE service_batches SET state='paused',version=version+1 WHERE id=?",[id]);await audit(c,actor,'batch:pause','batch',id);return {state:'paused'};}
  const expected={close:'open',load:'closed',ready:'loaded'}[action];if(b.state!==expected)throw new CommerceError('INVALID_BATCH_TRANSITION');
  if(action==='close'&&new Date(b.cutoff_at).getTime()>now)throw new CommerceError('BATCH_NOT_CLOSED_YET');
  const [orders]=await c.execute<RowDataPacket[]>("SELECT id,fulfilment_status FROM pickup_orders WHERE batch_id=? AND payment_status='paid' AND refund_status='none' AND order_status='open' AND hold_status='committed' ORDER BY id FOR UPDATE",[id]);
  const manifest:{orders:Array<{id:string;items:Array<{id:string;name:string;quantity:number}>}>;closedAt:string}={orders:[],closedAt:new Date(now).toISOString()};
  for(const order of orders){
   const [lines]=await c.execute<RowDataPacket[]>('SELECT * FROM pickup_order_lines WHERE order_id=? ORDER BY product_id',[order.id]);
   manifest.orders.push({id:order.id,items:lines.map(l=>({id:l.product_id,name:l.name,quantity:Number(l.quantity)}))});
   if(action!=='close'){
    const frozen=JSON.parse(b.manifest||'{}').orders||[];if(!frozen.some((o:{id:string})=>o.id===order.id))throw new CommerceError('MANIFEST_EXCEPTION');
    if(order.fulfilment_status!==(action==='load'?'reserved':'loaded'))throw new CommerceError('FULFILMENT_CHANGED');
    for(const l of lines.filter(l=>l.inventory_stage==='frozen'))await transferCommitted(c,l,action==='load'?'frozen':'baking',action==='load'?'baking':'ready',actor,action+':'+order.id+':'+l.product_id,order.id);
    await c.execute('UPDATE pickup_orders SET fulfilment_status=?,version=version+1 WHERE id=?',[action==='load'?'loaded':'ready',order.id]);
   }
  }
  const state={close:'closed',load:'loaded',ready:'ready'}[action];
  await c.execute('UPDATE service_batches SET state=?,manifest=IF(?=\'close\',?,manifest),version=version+1 WHERE id=?',[state,action,JSON.stringify(manifest),id]);
  await audit(c,actor,'batch:'+action,'batch',id);return {state,orders:orders.length};
 });
}
export async function collectOrder(actor:number,id:string,receiptKey:string){
 return transaction(async(c)=>{
  const [rows]=await c.execute<RowDataPacket[]>('SELECT * FROM pickup_orders WHERE id=? AND receipt_hash=? FOR UPDATE',[id,digest(receiptKey)]);const o=rows[0];
  if(!o)throw new CommerceError('ORDER_NOT_FOUND',404);
  if(o.payment_status!=='paid'||o.refund_status!=='none'||o.fulfilment_status!=='ready'||o.order_status!=='open')throw new CommerceError('COLLECTION_NOT_ELIGIBLE');
  const [lines]=await c.execute<RowDataPacket[]>('SELECT * FROM pickup_order_lines WHERE order_id=? ORDER BY product_id',[id]);
  for(const l of lines)await transferCommitted(c,l,l.inventory_stage==='frozen'?'ready':l.inventory_stage,undefined,actor,'collect:'+id+':'+l.product_id,id);
  await c.execute("UPDATE pickup_orders SET fulfilment_status='collected',order_status='complete',version=version+1 WHERE id=?",[id]);
  await audit(c,actor,'collect','pickup_order',id);return {collected:true};
 });
}
