import 'server-only';
import {menuActiveSql} from './menu-model';
import {randomUUID,createHash} from 'node:crypto';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {transaction,audit,sqlDate} from './commerce';
import type {Role} from './auth';
import type {KitchenInput} from './kitchen-input';
import {active,capacity,reserved,adjustment,freeReady,freshness,connectionReason,effectiveStatus,serviceValidUntil,expiresAutomatically,READ_REVIEW_SECONDS,HEARTBEAT_SECONDS,STOCK_REVIEW_SECONDS,type Lot,type Allocation,type KitchenState,type Channel,type Stage} from './kitchen-model';

export class KitchenError extends Error {constructor(message:string,public status=409){super(message);}}
export function kitchenEnabled(){return process.env.PUNA_LIVE_KITCHEN_ENABLED==='true';}
export function publicKitchenEnabled(){return kitchenEnabled()&&process.env.PUNA_KITCHEN_PUBLIC_PREVIEW==='true';}
export function kitchenFixtures(){return kitchenEnabled()&&process.env.PUNA_KITCHEN_FIXTURES==='true'&&process.env.PUNA_DISPOSABLE_LOCAL_TESTS==='true'&&process.env.DB_NAME==='puna_ci_synthetic'&&process.env.DB_HOST==='127.0.0.1';}
const iso=(v:unknown)=>new Date(v as string).toISOString();
function fail(message:string,status=409):never{throw new KitchenError(message,status);}
type Actor={id:number;role:Role};

async function read(c:PoolConnection,now:number){
 const [states]=await c.query<RowDataPacket[]>('SELECT s.*,v.session_opened_at,v.session_closes_at,v.review_due_at,v.confidence,v.confidence_reason,v.review_minutes,v.prep_minutes,v.window_minutes,v.capacity_orders,v.capacity_units FROM kitchen_state s JOIN kitchen_service v ON v.id=s.id WHERE s.id=1 FOR UPDATE');
 if(!states[0])fail('Kitchen schema unavailable',503);
 const s=states[0],state:KitchenState={mode:s.mode,version:Number(s.version),reviewedAt:s.reviewed_at?iso(s.reviewed_at):null,heartbeatAt:s.heartbeat_at?iso(s.heartbeat_at):null,heartbeatActor:s.heartbeat_actor,heartbeatClient:s.heartbeat_client,holdSeconds:Number(s.hold_seconds),sessionOpenedAt:s.session_opened_at?iso(s.session_opened_at):null,sessionClosesAt:s.session_closes_at?iso(s.session_closes_at):null,reviewDueAt:s.review_due_at?iso(s.review_due_at):null,confidence:s.confidence,confidenceReason:s.confidence_reason,policy:{reviewMinutes:Number(s.review_minutes),prepMinutes:Number(s.prep_minutes),windowMinutes:Number(s.window_minutes),capacityOrders:Number(s.capacity_orders),capacityUnits:Number(s.capacity_units)}};
 const [rows]=await c.query<RowDataPacket[]>(`SELECT l.*,p.name,(p.available=1 AND m.publication='staging' AND ${menuActiveSql}) public_item FROM kitchen_lots l JOIN products p ON p.id=l.product_id LEFT JOIN commerce_products m ON m.product_id=p.id LEFT JOIN product_menu u ON u.product_id=p.id ORDER BY l.started_at,l.id`);
 const lots:Lot[]=rows.map(l=>({id:l.id,productId:l.product_id,name:l.name,startedUnits:Number(l.started_units),startedAt:iso(l.started_at),estimatedReadyAt:iso(l.estimated_ready_at),online_ready:Number(l.online_ready),online_baking:Number(l.online_baking),truck_ready:Number(l.truck_ready),truck_baking:Number(l.truck_baking),version:Number(l.version),note:l.note,public:!!l.public_item}));
 const [orders]=await c.query<RowDataPacket[]>('SELECT * FROM kitchen_allocations ORDER BY pickup_at,created_at,id');
 const [lines]=await c.query<RowDataPacket[]>('SELECT * FROM kitchen_allocation_lines ORDER BY allocation_id,lot_id');
 const allocations:Allocation[]=orders.map(a=>({id:a.id,channel:a.channel,state:a.state,synthetic:!!a.synthetic,managedOrder:!!a.order_id,label:a.label,pickupAt:iso(a.pickup_at),expiresAt:iso(a.expires_at),createdAt:iso(a.created_at),lines:lines.filter(l=>l.allocation_id===a.id).map(l=>({lotId:l.lot_id,quantity:Number(l.quantity),readyUnits:Number(l.ready_units),setAsideUnits:Number(l.set_aside_units)}))}));
 const [publicProducts]=await c.query<RowDataPacket[]>(`SELECT p.id FROM products p JOIN commerce_products m ON m.product_id=p.id LEFT JOIN product_menu u ON u.product_id=p.id WHERE p.kind='fresh' AND p.available=1 AND m.publication='staging' AND ${menuActiveSql}`);
 const [products]=await c.query<RowDataPacket[]>(`SELECT p.id,p.name,p.price_cents,COALESCE(m.category,'empanada') category,m.publication,${menuActiveSql} menu_active,(COALESCE(m.category,'empanada')='empanada' AND COALESCE(u.oven_eligible,1)=1) oven_eligible FROM products p LEFT JOIN commerce_products m ON m.product_id=p.id LEFT JOIN product_menu u ON u.product_id=p.id WHERE p.kind='fresh' ORDER BY p.name`);
 let posIssues:string[]=[];if(process.env.PUNA_SQUARE_POS_ENABLED==='true'){const [issues]=await c.query<RowDataPacket[]>('SELECT id FROM kitchen_pos_issues WHERE resolved_at IS NULL');posIssues=issues.map(r=>String(r.id));}
 const [pickupProblems]=await c.query<RowDataPacket[]>('SELECT order_id FROM kitchen_pickup_schedule WHERE needs_review=1');
 const effective=effectiveStatus(state,now,lots,allocations);if(pickupProblems.length){effective.issues.delayed.push(...pickupProblems.map(r=>String(r.order_id)));if(effective.status!=='closed'){effective.status='paused';effective.availabilityReason='commitments_need_review';}}if(process.env.PUNA_SQUARE_POS_ENABLED==='true'&&effective.status!=='closed'){effective.status='paused';effective.availabilityReason='square_reconciliation_required';} // Provider catch-up acceptance is still a release gate.
 const [events]=await c.query<RowDataPacket[]>('SELECT kind,actor_id,created_at,details FROM kitchen_events ORDER BY created_at DESC,operation_key DESC LIMIT 40');
 return {publicProductIds:publicProducts.map(p=>String(p.id)),displayProductIds:products.filter(p=>p.publication==='staging'&&p.category!=='ingredient'&&p.menu_active).map(p=>String(p.id)),connectionReason:connectionReason(state,now),history:events.map(e=>({kind:String(e.kind),actorId:Number(e.actor_id),at:iso(e.created_at),details:JSON.parse(e.details)})),state,lots,allocations,products:products.map(p=>({id:String(p.id),name:String(p.name),priceCents:Number(p.price_cents),category:String(p.category),ovenEligible:!!p.oven_eligible})),serverTime:new Date(now).toISOString(),...effective,issues:{...effective.issues,pos:posIssues},heartbeatSeconds:HEARTBEAT_SECONDS,fixtures:kitchenFixtures()};
}
export type KitchenSnapshot=Awaited<ReturnType<typeof read>>;
// Availability performs the same durable expiry/reconciliation work as staff reads.
// No active tablet is needed. Managed orders exist only behind the local provider gate.
async function current(c:PoolConnection,now:number){
 let s=await read(c,now);if(await expire(c,s,now))await c.execute('UPDATE kitchen_state SET version=version+1 WHERE id=1');
 if(s.allocations.some(a=>a.managedOrder)){const o=await import('./ordering');await o.expireOrdering(c,now);await o.syncOrdering(c,now);}
 return read(c,now);
}
export async function kitchenSnapshot(){if(!kitchenEnabled())fail('Live Kitchen is disabled',404);return transaction(current);}
async function event(c:PoolConnection,actor:number,key:string,hash:string,kind:string,result:unknown,details:unknown,now:number){
 await c.execute('INSERT INTO kitchen_events(operation_key,actor_id,request_hash,kind,result,details,created_at) VALUES(?,?,?,?,?,?,?)',[key,actor,hash,kind,JSON.stringify(result),JSON.stringify(details),sqlDate(now)]);
 await audit(c,actor,'kitchen:'+kind,'kitchen_event',key);
}
async function expire(c:PoolConnection,s:KitchenSnapshot,now:number){
 let changed=false;
 for(const a of s.allocations)if(!a.managedOrder&&expiresAutomatically(a,now)){
  await c.execute("UPDATE kitchen_allocations SET state='released' WHERE id=?",[a.id]);a.state='released';changed=true;
  await audit(c,null,'kitchen:unpaid_expired','kitchen_allocation',a.id);
 }
 return changed;
}
async function checkRead(c:PoolConnection,actor:Actor,clientId:string,version:number,now:number){
 const [r]=await c.execute<RowDataPacket[]>('SELECT read_version,read_at FROM kitchen_observations WHERE client_id=? AND actor_id=?',[clientId,actor.id]);
 if(!r[0]||Number(r[0].read_version)!==version||now-Date.parse(iso(r[0].read_at))>READ_REVIEW_SECONDS*1000)fail('Refresh authoritative stock and review it before reconnecting or opening.');
}
async function saveLot(c:PoolConnection,l:Lot){
 await c.execute('UPDATE kitchen_lots SET online_ready=?,online_baking=?,truck_ready=?,truck_baking=?,estimated_ready_at=?,note=?,version=version+1 WHERE id=?',[l.online_ready,l.online_baking,l.truck_ready,l.truck_baking,sqlDate(l.estimatedReadyAt),l.note,l.id]);
}
async function saveLine(c:PoolConnection,id:string,line:Allocation['lines'][number]){await c.execute('UPDATE kitchen_allocation_lines SET ready_units=?,set_aside_units=? WHERE allocation_id=? AND lot_id=?',[line.readyUnits,line.setAsideUnits,id,line.lotId]);}

// Internal allocation kernel. Phase C exposes online use only through a guarded
// synthetic fixture action; D1 checkout reuses it within the same order transaction.
async function reserve(c:PoolConnection,s:KitchenSnapshot,actor:{id:number|null},now:number,channel:Channel,items:{lotId:string;quantity:number;readyUnits?:number}[],pickupAt:string,label:string){
 if(new Set(items.map(i=>i.lotId)).size!==items.length)fail('Duplicate batch in basket',400);
 if(channel==='truck'&&s.state.mode==='closed')fail('Kitchen is closed to new walk-in reservations.');
 if(channel==='online'&&s.status!=='open')fail('Online reservations paused: truck must be open, fresh and reconciled.');
 if(Date.parse(pickupAt)<now||Date.parse(pickupAt)>now+24*3600000)fail('Pickup commitment must be within the next day.',400);
 const lines:Allocation['lines']=[];
 for(const item of items){
  const l=s.lots.find(l=>l.id===item.lotId);if(!l)fail('Batch unavailable');
  if(capacity(l,s.allocations).deficit)fail('Batch shortage needs review');
  const ready=Math.max(0,l[`${channel}_ready`]-reserved(l.id,channel,'ready',s.allocations));
  const baking=channel==='online'&&Date.parse(l.estimatedReadyAt)>now?Math.max(0,l.online_baking-reserved(l.id,channel,'baking',s.allocations)):0;
  if(item.quantity>ready+baking)fail('Not enough uncommitted stock in this allocation.');
  const readyUnits=item.readyUnits??Math.min(ready,item.quantity);
  if(!Number.isInteger(readyUnits)||readyUnits<0||readyUnits>item.quantity||readyUnits>ready||item.quantity-readyUnits>baking)fail('Selected ready or baking allocation is no longer available.');
  if(readyUnits<item.quantity&&Date.parse(l.estimatedReadyAt)>Date.parse(pickupAt))fail('Batch estimate does not fit the pickup commitment.');
  lines.push({lotId:l.id,quantity:item.quantity,readyUnits,setAsideUnits:0});
 }
 const id=randomUUID();
 await c.execute('INSERT INTO kitchen_allocations(id,channel,state,synthetic,label,pickup_at,expires_at,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?)',[id,channel,channel==='online'?'unpaid':'counter_pending',channel==='online'?1:0,label,sqlDate(pickupAt),sqlDate(now+s.state.holdSeconds*1000),sqlDate(now),actor.id]);
 for(const l of lines)await c.execute('INSERT INTO kitchen_allocation_lines(allocation_id,lot_id,quantity,ready_units) VALUES(?,?,?,?)',[id,l.lotId,l.quantity,l.readyUnits]);
 return {id};
}

async function consume(c:PoolConnection,s:KitchenSnapshot,a:Allocation){
 if(a.lines.some(l=>l.readyUnits!==l.quantity))fail('Every item must be staff-confirmed ready.');
 if(a.lines.some(l=>{const lot=s.lots.find(x=>x.id===l.lotId)!;return capacity(lot,s.allocations).deficit>0;}))fail('Stock shortage needs review before handover.');
 if(a.channel==='online'&&a.lines.some(l=>l.setAsideUnits!==l.quantity))fail('Confirm paid items are physically set aside.');
 for(const line of a.lines){const lot=s.lots.find(l=>l.id===line.lotId)!;lot[`${a.channel}_ready`]-=line.quantity;await saveLot(c,lot);}
 // Decrement physical and retire commitment together; free availability is unchanged.
 await c.execute("UPDATE kitchen_allocations SET state='consumed' WHERE id=?",[a.id]);
}

export async function kitchenAction(actor:Actor,p:KitchenInput){
 if(!kitchenEnabled())fail('Live Kitchen is disabled',404);
 if(p.action.startsWith('fixture-')&&!kitchenFixtures())fail('Synthetic fixtures are disabled',404);
 if(['count','correct'].includes(p.action)&&!['owner','manager'].includes(actor.role))fail('A manager or owner must approve counted corrections.',403);
 if(['hold-policy','service-policy'].includes(p.action)&&actor.role!=='owner')fail('Only the owner can change the hold policy.',403);
 return transaction(async(c,now)=>{
  let s=await current(c,now);
  if(p.action==='inspect'){
   await c.execute('INSERT INTO kitchen_observations(client_id,actor_id,read_version,read_at) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE read_version=VALUES(read_version),read_at=VALUES(read_at)',[p.clientId,actor.id,s.state.version,sqlDate(now)]);
   return {...s,role:actor.role,actorId:actor.id};
  }
  if(p.action==='heartbeat'){
   if(s.state.heartbeatClient!==p.clientId||s.state.heartbeatActor!==actor.id)fail('Another truck screen owns the heartbeat. Review before taking over.',403);
   await checkRead(c,actor,p.clientId,s.state.version,now);
   const changed=await expire(c,s,now);
   await c.execute('UPDATE kitchen_state SET heartbeat_at=?,version=version+? WHERE id=1',[sqlDate(now),changed?1:0]);
   return {ok:true};
  }
  const hash=createHash('sha256').update(JSON.stringify(p)).digest('hex');
  const [old]=await c.execute<RowDataPacket[]>('SELECT actor_id,request_hash,result FROM kitchen_events WHERE operation_key=?',[p.key]);
  if(old[0]){if(Number(old[0].actor_id)!==actor.id||old[0].request_hash!==hash)fail('Operation key conflicts with a different action.');return JSON.parse(old[0].result);}
  if(p.version!==s.state.version)fail('Stock changed. Refresh and review before trying again.');
  let result:Record<string,unknown>={ok:true};
  if(p.action==='connect'){
   await checkRead(c,actor,p.clientId,s.state.version,now);
   await c.execute("UPDATE kitchen_state SET reviewed_at=?,heartbeat_at=?,heartbeat_client=?,heartbeat_actor=? WHERE id=1",[sqlDate(now),sqlDate(now),p.clientId,actor.id]);
   await c.execute("UPDATE kitchen_service SET review_due_at=?,confidence='verified',confidence_reason=NULL WHERE id=1",[sqlDate(now+s.state.policy!.reviewMinutes*60000)]);
  }else if(p.action==='mode'){
   if(p.mode==='open'){
    await checkRead(c,actor,p.clientId,s.state.version,now);
    if(!freshness(s.state,now)||now-Date.parse(s.state.reviewedAt!)>300000)fail('Confirm a physical stock review within five minutes before opening a business session.');
    if(Object.values(s.issues).some(v=>v.length))fail('Resolve shortages, delayed commitments and late-payment exceptions before opening.');
   }
   if(p.mode==='open'){const closes=p.closesAt?Date.parse(p.closesAt):now+8*3600000;if(closes<=now+60000||closes>now+12*3600000)fail('Choose a closing time between one minute and twelve hours from now.');await c.execute('UPDATE kitchen_service SET session_opened_at=?,session_closes_at=? WHERE id=1',[sqlDate(now),sqlDate(closes)]);}
   await c.execute('UPDATE kitchen_state SET mode=? WHERE id=1',[p.mode]);
  }else{
   const corrective=['correct','waste','ready','delay','estimate','cancel-batch'].includes(p.action)&&s.state.confidence==='blocked'&&s.state.reviewedAt&&now>=Date.parse(s.state.reviewedAt)&&now<Date.parse(s.state.reviewDueAt||'');
   if(!['fixture-payment','confidence','service-policy'].includes(p.action)&&!freshness(s.state,now)&&!corrective)fail('Physical stock review is required before stock changes.');
   if(p.action!=='fixture-payment')await checkRead(c,actor,p.clientId,s.state.version,now);
   await expire(c,s,now);
   if(p.action==='confidence'){await c.execute("UPDATE kitchen_service SET confidence='blocked',confidence_reason=? WHERE id=1",[p.reason]);}
   else if(p.action==='service-policy'){await c.execute('UPDATE kitchen_service SET review_minutes=?,prep_minutes=?,window_minutes=?,capacity_orders=?,capacity_units=? WHERE id=1',[p.reviewMinutes,p.prepMinutes,p.windowMinutes,p.capacityOrders,p.capacityUnits]);if(s.state.reviewedAt)await c.execute('UPDATE kitchen_service SET review_due_at=? WHERE id=1',[sqlDate(Math.min(Date.parse(s.state.reviewDueAt||s.state.reviewedAt),Date.parse(s.state.reviewedAt)+p.reviewMinutes*60000))]);}
   else if(p.action==='display-step'){
    if(!s.products.some(x=>x.id===p.productId))fail('Choose an existing fresh catalogue product.',400);
    const candidates=s.lots.filter(l=>l.productId===p.productId);
    const lot=p.delta===1?candidates.find(l=>l.online_ready+l.truck_ready<500):candidates.find(l=>freeReady(l,s.allocations,'online')+freeReady(l,s.allocations,'truck')>0);
    if(lot){try{await saveLot(c,adjustment(lot,s.allocations,'ready',p.delta));}catch(e){fail((e as Error).message);}}
    else if(p.delta===1){const id=randomUUID();await c.execute('INSERT INTO kitchen_lots(id,product_id,started_units,started_at,estimated_ready_at,online_ready,truck_ready,online_baking,truck_baking,note,created_by) VALUES(?,?,?,?,?,1,0,0,0,?,?)',[id,p.productId,1,sqlDate(now),sqlDate(now),'Staff counted one ready empanada',actor.id]);result={id};}
    else fail('No unreserved display units to remove.');
   }else if(p.action==='start'||p.action==='count'){
    if(p.online>p.quantity)fail('Online allocation cannot exceed the counted batch.',400);
    if(!s.products.some(x=>x.id===p.productId))fail('Choose a fresh catalogue product.',400);
    const id=randomUUID(),baking=p.action==='start';if(baking&&!s.products.find(x=>x.id===p.productId)?.ovenEligible)fail('This product is ready-stock only.');
    await c.execute('INSERT INTO kitchen_lots(id,product_id,started_units,started_at,estimated_ready_at,online_ready,truck_ready,online_baking,truck_baking,note,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,p.productId,p.quantity,sqlDate(now),sqlDate(now+(baking?p.minutes*60000:0)),baking?0:p.online,baking?0:p.quantity-p.online,baking?p.online:0,baking?p.quantity-p.online:0,baking?'Counted into the oven':p.reason,actor.id]);result={id};
   }else if(p.action==='hold-policy')await c.execute('UPDATE kitchen_state SET hold_seconds=? WHERE id=1',[p.seconds]);
   else if(p.action==='fixture-reserve')result=await reserve(c,s,actor,now,'online',p.items,p.pickupAt,p.label);
   else if(p.action==='counter-reserve'){if(process.env.PUNA_SQUARE_POS_ENABLED==='true')fail('Use the Square POS workflow while automatic reconciliation is active.');result=await reserve(c,s,actor,now,'truck',[{lotId:p.lotId,quantity:p.quantity}],new Date(now+10*60000).toISOString(),'Walk-in · '+new Date(now).toLocaleTimeString('en-CA',{timeZone:'America/Vancouver',hour:'numeric',minute:'2-digit'}));}
   else if(['counter-finish','counter-release','set-aside','fixture-payment','fixture-collect'].includes(p.action)){
    const op=p as Extract<KitchenInput,{id:string}>,a=s.allocations.find(x=>x.id===op.id);if(!a)fail('Reservation not found',404);
    if(p.action==='counter-finish'){if(process.env.PUNA_SQUARE_POS_ENABLED==='true')fail('Automatic POS mode is active. Reconcile the Square order before handover; do not deduct manually.');if(a.channel!=='truck'||a.state!=='counter_pending')fail('Counter reservation is not pending.');await consume(c,s,a);}
    if(p.action==='counter-release'){if(a.channel!=='truck'||a.state!=='counter_pending')fail('Only an unpaid counter reservation can be released.');await c.execute("UPDATE kitchen_allocations SET state='released' WHERE id=?",[a.id]);}
    if(p.action==='set-aside'){
     if(a.state!=='paid'||a.lines.some(l=>capacity(s.lots.find(x=>x.id===l.lotId)!,s.allocations).deficit>0))fail('A paid reservation without shortages is required.');
     for(const line of a.lines){line.setAsideUnits=line.readyUnits;await saveLine(c,a.id,line);}
    }
    if(p.action==='fixture-collect'){if(a.managedOrder||!a.synthetic||a.state!=='paid')fail('Only a paid synthetic order can use this fixture.');await consume(c,s,a);}
    if(p.action==='fixture-payment'){
     if(a.managedOrder||!a.synthetic||a.channel!=='online')fail('Only a synthetic online reservation can use this fixture.');
     let next:string=p.state;
     if(a.state==='released'&&p.state==='paid')next='late_exception';
     else if(!(['unpaid','pending','uncertain'].includes(a.state)))fail('Payment transition is not valid.');
     else if(p.state==='pending'&&a.state!=='unpaid'||p.state==='uncertain'&&a.state!=='pending')fail('Payment transition is not valid.');
     if(p.state==='failed')next='released';
     await c.execute('UPDATE kitchen_allocations SET state=? WHERE id=?',[next,a.id]);
    }
   }else{
    const op=p as Extract<KitchenInput,{lotId:string}>,l=s.lots.find(x=>x.id===op.lotId);if(!l)fail('Batch not found',404);
    if(p.action==='oven-step'){
     if(p.delta>0&&!s.products.find(x=>x.id===l.productId)?.ovenEligible)fail('This product is ready-stock only.');
     try{Object.assign(l,adjustment(l,s.allocations,'baking',p.delta));}catch(e){fail((e as Error).message);}
    }
    if(p.action==='cancel-batch'){
     if(reserved(l.id,'online','baking',s.allocations)+reserved(l.id,'truck','baking',s.allocations)>0)fail('This batch has customer reservations. Preserve those units; resolve or refund affected orders before cancelling.');
     l.online_baking=0;l.truck_baking=0;l.note=p.reason;
    }
    if(p.action==='estimate'){l.estimatedReadyAt=new Date(now+p.minutes*60000).toISOString();l.note='Ready estimate updated by staff';}
    if(p.action==='ready'){
     if(p.quantity>l.online_baking+l.truck_baking)fail('Cannot mark more ready than remains baking.');
     let remaining=p.quantity;
     // Stay inside each order's actual lot and channel. Within that lot, earlier
     // pickup commitments win; paid/uncertain commitments precede ordinary holds.
     const priority=(a:Allocation)=>a.state==='paid'?0:['pending','uncertain','counter_pending'].includes(a.state)?1:2;
     const orders=s.allocations.filter(a=>active(a.state)).sort((a,b)=>priority(a)-priority(b)||Date.parse(a.pickupAt)-Date.parse(b.pickupAt)||Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id));
     for(const a of orders){const line=a.lines.find(x=>x.lotId===l.id);if(!line)continue;const n=Math.min(remaining,line.quantity-line.readyUnits,l[`${a.channel}_baking`]);if(n){l[`${a.channel}_baking`]-=n;l[`${a.channel}_ready`]+=n;line.readyUnits+=n;remaining-=n;await saveLine(c,a.id,line);}}
     for(const channel of ['truck','online'] as const){const n=Math.min(remaining,l[`${channel}_baking`]);l[`${channel}_baking`]-=n;l[`${channel}_ready`]+=n;remaining-=n;}
     if(remaining)fail('Readiness could not be allocated safely.');
    }
    if(p.action==='delay'){l.estimatedReadyAt=new Date(Math.max(now,Date.parse(l.estimatedReadyAt)+p.minutes*60000)).toISOString();l.note=p.reason;}
    if(p.action==='transfer'){
     if(capacity(l,s.allocations).deficit)fail('Resolve this batch shortage before transferring.');
     const from=`${p.channel}_${p.stage}` as const,to=`${p.channel==='online'?'truck':'online'}_${p.stage}` as const;
     if(p.quantity>l[from]-reserved(l.id,p.channel,p.stage,s.allocations))fail('Only uncommitted capacity may be transferred.');
     l[from]-=p.quantity;l[to]+=p.quantity;
    }
    if(p.action==='waste'){const field=`${p.channel}_${p.stage}` as const;if(p.quantity>l[field])fail('Waste exceeds counted physical stock.');l[field]-=p.quantity;l.note=p.reason;}
    if(p.action==='correct'){l[`${p.channel}_${p.stage}`]=p.quantity;l.note=p.reason;}
    await saveLot(c,l);
   }
  }
  const after=await read(c,now);
  if(after.allocations.some(a=>a.managedOrder))await (await import('./ordering')).syncOrdering(c,now);
  // Confidence/commitment failures pause effective intake without changing business intent.
  if(after.issues.shortages.length)await c.execute("UPDATE kitchen_service SET confidence='blocked',confidence_reason='Counted stock is below protected commitments' WHERE id=1");
  await c.execute('UPDATE kitchen_state SET version=version+1 WHERE id=1');
  await event(c,actor.id,p.key,hash,p.action,result,p,now);
  return result;
 });
}

export async function publicAvailability(){
 if(!publicKitchenEnabled())return {enabled:false as const};
 const s=await kitchenSnapshot();
 // Publication controls visibility; the separate sale flag still controls checkout.
 // Never enable sales or expose a draft product merely to populate the cabinet.
 return {enabled:true as const,preview:true,serverTime:s.serverTime,heartbeatAt:s.state.heartbeatAt,validUntil:serviceValidUntil(s.state),status:s.status,fresh:s.fresh,connectionReason:s.connectionReason,availabilityReason:s.availabilityReason,businessMode:s.state.mode,sessionClosesAt:s.state.sessionClosesAt,policy:s.state.policy,
  products:s.products.filter(p=>s.displayProductIds.includes(p.id)).map(p=>{
   const lots=s.lots.filter(l=>l.productId===p.id),ready=lots.reduce((n,l)=>n+freeReady(l,s.allocations),0),batches=lots.filter(l=>l.online_baking>0).map(l=>({id:l.id,quantity:Math.max(0,l.online_baking-reserved(l.id,'online','baking',s.allocations)),reserved:reserved(l.id,'online','baking',s.allocations),estimate:l.estimatedReadyAt,reservable:Date.parse(l.estimatedReadyAt)>Date.parse(s.serverTime)}));
   return {id:p.id,name:p.name,priceCents:p.priceCents,orderable:s.publicProductIds.includes(p.id),known:lots.length>0,readyLots:s.status==='open'?lots.filter(l=>freeReady(l,s.allocations)>0).map(l=>({id:l.id,quantity:freeReady(l,s.allocations)})):[],ready:s.status==='open'?ready:0,baking:s.status==='open'?batches.reduce((n,b)=>n+b.quantity,0):0,batches:s.status==='open'?batches:[],estimate:s.status==='open'?batches.map(b=>b.estimate).sort()[0]||null:null};
  })};
}
export type PublicAvailability=Awaited<ReturnType<typeof publicAvailability>>;

export {read as readKitchen, reserve as reserveKitchen, consume as consumeKitchen, expire as expireKitchen, saveLine as saveKitchenLine};
