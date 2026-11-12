import 'server-only';
import {randomUUID} from 'node:crypto';
import type {RowDataPacket} from 'mysql2/promise';
import {transaction,sqlDate,audit} from './commerce';
import {KitchenError,readKitchen,kitchenEnabled} from './kitchen';
import {freeReady} from './kitchen-model';
import {verifySignature} from './square';
import {squareAccess,squareRead,withSquareDeadline} from './square-reporting';
import {posQuantities,posDelta,type PosOrder,type PosMapping} from './kitchen-square-model';
export const squarePosEnabled=()=>kitchenEnabled()&&process.env.PUNA_SQUARE_POS_ENABLED==='true';
export async function handlePosWebhook(raw:string,signature:string|null){
 if(!squarePosEnabled())throw new KitchenError('Square POS synchronization is disabled',404);
 const url=process.env.PUNA_SQUARE_POS_WEBHOOK_URL,key=process.env.PUNA_SQUARE_POS_WEBHOOK_KEY,merchant=process.env.SQUARE_REPORTING_MERCHANT_ID,location=process.env.PUNA_SQUARE_POS_LOCATION_ID,cutover=Date.parse(process.env.PUNA_SQUARE_POS_CUTOVER_AT||'');
 if(!url||!key||!merchant||!location||!Number.isFinite(cutover))throw new KitchenError('Square POS configuration incomplete',503);
 if(!verifySignature(raw,signature,url,key))throw new KitchenError('Invalid Square signature',403);
 let event;try{event=JSON.parse(raw);}catch{throw new KitchenError('Invalid event',400);}
 if(event.merchant_id!==merchant||typeof event.event_id!=='string'||event.event_id.length>192)throw new KitchenError('Invalid Square identity',403);
 if(!['order.created','order.updated','order.fulfillment.updated'].includes(event.type))return {ignored:true};
 const summary=event.data?.object?.order_updated||event.data?.object?.order_created||event.data?.object?.order_fulfillment_updated;
 const id=summary?.order_id||event.data?.id;if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,192}$/.test(id))throw new KitchenError('Invalid Square order',400);
 // Fetch the canonical version; retries and out-of-order events cannot roll it back.
 const order:PosOrder=await withSquareDeadline(async()=>{const access=await squareAccess();if(access.identity.merchantId!==merchant)throw new KitchenError('Merchant mismatch',403);const r=await squareRead('/v2/orders/'+encodeURIComponent(id),access.token);return r.order;});
 if(!order||order.id!==id||order.location_id!==location)throw new KitchenError('Square location mismatch',403);
 const created=Date.parse(order.created_at);if(!Number.isFinite(created))throw new KitchenError('Invalid order date',400);
 if(created<cutover||order.state!=='COMPLETED')return {ignored:true};
 return transaction(async(c,now)=>{
  const s=await readKitchen(c,now);
  const [oldEvent]=await c.execute<RowDataPacket[]>('SELECT event_id FROM kitchen_pos_events WHERE event_id=?',[event.event_id]);if(oldEvent.length)return {duplicate:true};
  const record=async(outcome:string)=>{await c.execute('INSERT INTO kitchen_pos_events(event_id,square_order_id,outcome,received_at) VALUES(?,?,?,?)',[event.event_id,id,outcome,sqlDate(now)]);await audit(c,null,'kitchen:pos:'+outcome,'square_order',id);};
  const [web]=await c.execute<RowDataPacket[]>('SELECT id FROM pickup_orders WHERE square_order_id=?',[id]);if(web.length){await record('website_order_excluded');return {excluded:true};}
  const [existing]=await c.execute<RowDataPacket[]>('SELECT provider_version,quantities FROM kitchen_pos_orders WHERE square_order_id=?',[id]);
  if(existing[0]&&Number(existing[0].provider_version)>=order.version){await record('older_or_duplicate');return {duplicate:true};}
  const [rows]=await c.query<RowDataPacket[]>('SELECT variation_id,product_id,units FROM kitchen_square_mappings');const mappings:PosMapping[]=rows.map(r=>({variationId:r.variation_id,productId:r.product_id,units:Number(r.units)}));
  const issue=async(code:string)=>{await c.execute('INSERT INTO kitchen_pos_issues(id,square_order_id,code,created_at) VALUES(?,?,?,?)',[randomUUID(),id,code,sqlDate(now)]);await c.execute("UPDATE kitchen_state SET mode=IF(mode='closed','closed','paused'),version=version+1 WHERE id=1");};
  let quantities:Record<string,number>;
  try{quantities=posQuantities(order,mappings);}catch(e){await issue((e as Error).message);await record('mapping_review');return {review:true};}
  const previous:Record<string,number>=existing[0]?JSON.parse(existing[0].quantities):{},delta=posDelta(quantities,previous);
  if(delta.review)await issue('REDUCED_QUANTITY_REQUIRES_PHYSICAL_REVIEW');
  // All-or-nothing: a shortage is held for reconciliation, never a partial import.
  for(const [product,quantity] of Object.entries(delta.remove)){const available=s.lots.filter(l=>l.productId===product).reduce((n,l)=>n+freeReady(l,s.allocations,'online')+freeReady(l,s.allocations,'truck'),0);if(available<quantity){await issue('POS_STOCK_SHORTAGE');await record('stock_review');return {review:true};}}
  for(const [product,quantity] of Object.entries(delta.remove)){let left=quantity;for(const lot of s.lots.filter(l=>l.productId===product)){for(const channel of ['truck','online'] as const){const n=Math.min(left,freeReady(lot,s.allocations,channel));lot[`${channel}_ready`]-=n;left-=n;}await c.execute('UPDATE kitchen_lots SET online_ready=?,truck_ready=?,version=version+1 WHERE id=?',[lot.online_ready,lot.truck_ready,lot.id]);if(!left)break;}}
  // Keep the high-water gross count so a refund can never generate stock or a later double deduction.
  const high=Object.fromEntries([...new Set([...Object.keys(previous),...Object.keys(quantities)])].map(k=>[k,Math.max(previous[k]||0,quantities[k]||0)]));
  await c.execute('INSERT INTO kitchen_pos_orders(square_order_id,provider_version,quantities,applied_at) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE provider_version=VALUES(provider_version),quantities=VALUES(quantities),applied_at=VALUES(applied_at)',[id,order.version,JSON.stringify(high),sqlDate(now)]);
  await c.execute('UPDATE kitchen_state SET version=version+1 WHERE id=1');await record(delta.review?'applied_review':'applied');return {applied:true,review:delta.review};
 });
}
