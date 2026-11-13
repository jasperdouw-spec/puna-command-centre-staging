import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export async function runKitchenChecks({db,request,check,cookie,staffCookie}){
 const ownerClient=randomUUID(),staffClient=randomUUID();
 const inspect=async(who=cookie,clientId=ownerClient)=>(await request('/api/kitchen',{method:'POST',cookie:who,body:{action:'inspect',clientId}})).data;
 const raw=(body,who=cookie)=>request('/api/kitchen',{method:'POST',cookie:who,body});
 const post=async(action,who=cookie,clientId=ownerClient)=>raw({...action,key:randomUUID(),clientId,version:(await inspect(who,clientId)).state.version},who);
 const good=async(action,who=cookie,clientId=ownerClient)=>{const r=await post(action,who,clientId);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
 const open=async()=>{await good({action:'connect',checked:true});await good({action:'mode',mode:'open'});};
 const hold=async(lotId,quantity=1,pickupAt=new Date(Date.now()+60*60000).toISOString())=>good({action:'fixture-reserve',items:[{lotId,quantity}],pickupAt,label:'Synthetic reservation'});
 const count=async(q=10,online=5)=>good({action:'count',productId:'kitchen-corn',quantity:q,online,reason:'Synthetic physical count for isolation test'});
 const fingerprint=async()=>{const out={};for(const t of ['inventory_balances','inventory_movements','pickup_orders','pickup_order_lines','service_batches','historical_sales','sales_details'])out[t]=createHash('sha256').update(JSON.stringify((await db.query('SELECT * FROM '+t))[0])).digest('hex');return out;};
 const legacy=await fingerprint();
 await db.execute("INSERT INTO products(id,name,description,price_cents,kind,available) VALUES('kitchen-corn','Golden corn · synthetic','Disposable kitchen demonstration',800,'fresh',1),('kitchen-spinach','Spinach & cheese · synthetic','Disposable kitchen demonstration',800,'fresh',1)");
 for(const id of ['kitchen-corn','kitchen-spinach'])await db.execute("INSERT INTO commerce_products(product_id,canonical_id,category,publication) VALUES(?,?,'empanada','staging')",[id,id]);
 await check('kitchen candidate reruns safely and refuses a missing table behind its ledger',async()=>{
  assert.match(execFileSync(process.execPath,['tests/apply-kitchen-schema.mjs'],{encoding:'utf8'}),/already_applied/);assert.match(execFileSync(process.execPath,['tests/apply-service-schema.mjs'],{encoding:'utf8'}),/already_applied/);await db.query('RENAME TABLE kitchen_service TO synthetic_missing_service');try{assert.throws(()=>execFileSync(process.execPath,['tests/apply-service-schema.mjs'],{stdio:'pipe'}));}finally{await db.query('RENAME TABLE synthetic_missing_service TO kitchen_service');}
  await db.query('RENAME TABLE kitchen_observations TO synthetic_kitchen_observations');try{assert.throws(()=>execFileSync(process.execPath,['tests/apply-kitchen-schema.mjs'],{stdio:'pipe'}),/Command failed/);}finally{await db.query('RENAME TABLE synthetic_kitchen_observations TO kitchen_observations');}
  assert.equal((await inspect()).lots.length,0);assert.equal((await inspect()).state.holdSeconds,300);
 });
 await check('kitchen denies anonymous and foreign-origin mutations; staff cannot correct or change policy',async()=>{
  assert.equal((await request('/api/kitchen')).status,401);assert.equal((await request('/api/kitchen',{method:'POST',body:{action:'inspect',clientId:ownerClient}})).status,401);
  assert.equal((await request('/api/kitchen',{method:'POST',cookie,originHeader:'https://foreign.example.test',body:{action:'inspect',clientId:ownerClient}})).status,403);
  assert.equal((await post({action:'count',productId:'kitchen-corn',quantity:1,online:0,reason:'Synthetic count'},staffCookie,staffClient)).status,403);
  assert.equal((await post({action:'hold-policy',seconds:600},staffCookie,staffClient)).status,403);
 });
 await check('stock review requires a recent actor-specific read and preserves the business mode',async()=>{
  const other=randomUUID(),s=await inspect();assert.equal((await raw({action:'connect',key:randomUUID(),clientId:other,version:s.state.version,checked:true})).status,409);
  await db.query('UPDATE kitchen_observations SET read_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 31 SECOND)');assert.equal((await raw({action:'connect',key:randomUUID(),clientId:ownerClient,version:s.state.version,checked:true})).status,409);
  await good({action:'connect',checked:true});assert.equal((await inspect()).state.mode,'closed');await good({action:'mode',mode:'open'});
 });
 await check('ordinary hold policy defaults to five minutes and is owner-configurable',async()=>{
  await good({action:'hold-policy',seconds:240});assert.equal((await inspect()).state.holdSeconds,240);await good({action:'hold-policy',seconds:300});
 });
 await check('staff one-tap counts, replay protection and negative-stock prevention',async()=>{
  const s=await inspect(staffCookie,staffClient),body={action:'display-step',productId:'kitchen-spinach',delta:1,key:randomUUID(),clientId:staffClient,version:s.state.version};
  assert.equal((await raw(body,staffCookie)).status,200);assert.equal((await raw(body,staffCookie)).status,200);
  const total=async()=>(await inspect()).lots.filter(l=>l.productId==='kitchen-spinach').reduce((n,l)=>n+l.online_ready+l.truck_ready,0);
  assert.equal(await total(),1);await good({action:'display-step',productId:'kitchen-spinach',delta:-1},staffCookie,staffClient);assert.equal(await total(),0);
  assert.equal((await post({action:'display-step',productId:'kitchen-spinach',delta:-1})).status,409);
  assert.equal((await raw({...body,key:randomUUID()},staffCookie)).status,409);
 });
 await check('multiple oven batches support plus minus ETA partial transfer and cancellation',async()=>{
  const one=await good({action:'start',productId:'kitchen-spinach',quantity:4,online:4,minutes:15}),two=await good({action:'start',productId:'kitchen-spinach',quantity:6,online:6,minutes:30});
  await good({action:'oven-step',lotId:one.id,delta:1});await good({action:'oven-step',lotId:one.id,delta:-1});await good({action:'estimate',lotId:one.id,minutes:10});await good({action:'ready',lotId:one.id,quantity:2});
  let s=await inspect();assert.equal(s.lots.find(l=>l.id===one.id).online_ready,2);assert.equal(s.lots.find(l=>l.id===one.id).online_baking,2);assert.equal(s.lots.find(l=>l.id===two.id).online_baking,6);
  await good({action:'cancel-batch',lotId:one.id,reason:'Synthetic partial batch cancellation'});s=await inspect();assert.equal(s.lots.find(l=>l.id===one.id).online_ready,2);assert.equal(s.lots.find(l=>l.id===one.id).online_baking,0);
  const publicStock=(await request('/api/kitchen/availability')).data.products.find(p=>p.id==='kitchen-spinach');assert.equal(publicStock.ready,2);assert.equal(publicStock.baking,6);
 });
 await check('published cabinet visibility is independent of the disabled ordering flag',async()=>{
  await db.query("UPDATE products SET available=0 WHERE id='kitchen-spinach'");
  let p=(await request('/api/kitchen/availability')).data.products.find(p=>p.id==='kitchen-spinach');assert.equal(p.ready,2);assert.equal(p.baking,6);assert.equal(p.orderable,false);
  assert.equal((await inspect()).publicProductIds.includes('kitchen-spinach'),false);
  await db.query("UPDATE commerce_products SET publication='draft' WHERE product_id='kitchen-spinach'");assert.equal((await request('/api/kitchen/availability')).data.products.some(p=>p.id==='kitchen-spinach'),false);
  await db.query("UPDATE commerce_products SET publication='staging',category='sauce' WHERE product_id='kitchen-spinach'");assert.equal((await request('/api/kitchen/availability')).data.products.some(p=>p.id==='kitchen-spinach'),false);
  await db.query("UPDATE commerce_products SET category='empanada' WHERE product_id='kitchen-spinach'");await db.query("UPDATE products SET available=1 WHERE id='kitchen-spinach'");
 });
 let baked;
 await check('Start Baking is server-timed and elapsed estimates do not mark food ready',async()=>{
  baked=await good({action:'start',productId:'kitchen-corn',quantity:10,online:6,minutes:25},staffCookie,staffClient);let l=(await inspect()).lots.find(x=>x.id===baked.id);
  assert.equal(Date.parse(l.estimatedReadyAt)-Date.parse(l.startedAt),25*60000);assert.equal(l.online_baking,6);assert.equal(l.truck_baking,4);assert.equal(l.online_ready+l.truck_ready,0);
  await db.execute('UPDATE kitchen_lots SET estimated_ready_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE id=?',[baked.id]);l=(await inspect()).lots.find(x=>x.id===baked.id);assert.equal(l.online_ready+l.truck_ready,0);
 });
 // Compatibility fixture: obligations created by the older baking-reservation model.
 const legacyHold=async(lotId,quantity)=>{const id=randomUUID(),actor=(await db.query("SELECT id FROM users WHERE role='owner' LIMIT 1"))[0][0].id;await db.execute("INSERT INTO kitchen_allocations(id,channel,state,synthetic,label,pickup_at,expires_at,created_at,created_by) VALUES(?,'online','unpaid',1,'Legacy synthetic baking commitment',DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 HOUR),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE),UTC_TIMESTAMP(3),?)",[id,actor]);await db.execute('INSERT INTO kitchen_allocation_lines(allocation_id,lot_id,quantity,ready_units) VALUES(?,?,?,0)',[id,lotId,quantity]);return {id};};
 await check('new oven reservations are rejected even after the timer elapsed',async()=>{assert.equal((await post({action:'fixture-reserve',items:[{lotId:baked.id,quantity:1}],pickupAt:new Date(Date.now()+3600000).toISOString(),label:'Oven must not sell'})).status,409);});
 let paid;
 await check('partial readiness preserves total physical units and the reserved actual batch',async()=>{
  paid=await legacyHold(baked.id,4);await good({action:'fixture-payment',id:paid.id,state:'paid'});
  const other=await good({action:'start',productId:'kitchen-corn',quantity:2,online:2,minutes:20});await good({action:'ready',lotId:other.id,quantity:2});
  assert.equal((await inspect()).allocations.find(a=>a.id===paid.id).lines[0].readyUnits,0);
  await good({action:'ready',lotId:baked.id,quantity:3});let s=await inspect(),l=s.lots.find(x=>x.id===baked.id),a=s.allocations.find(a=>a.id===paid.id);
  assert.equal(l.online_ready+l.truck_ready,3);assert.equal(l.online_baking+l.truck_baking,7);assert.equal(a.lines[0].readyUnits,3);
  assert.equal((await post({action:'ready',lotId:baked.id,quantity:8})).status,409);
 });
 await check('transfers cannot take held or paid capacity and move only one channel budget',async()=>{
  assert.equal((await post({action:'transfer',lotId:baked.id,channel:'online',stage:'ready',quantity:1})).status,409);
  const unpaid=await legacyHold(baked.id,1);assert.equal((await post({action:'transfer',lotId:baked.id,channel:'online',stage:'baking',quantity:2})).status,409);
  const before=(await inspect()).lots.find(x=>x.id===baked.id);await good({action:'transfer',lotId:baked.id,channel:'truck',stage:'baking',quantity:1});const after=(await inspect()).lots.find(x=>x.id===baked.id);assert.equal(after.online_baking,before.online_baking+1);assert.equal(after.truck_baking,before.truck_baking-1);assert.equal((await inspect()).allocations.find(a=>a.id===unpaid.id).state,'unpaid');
 });
 await check('all-or-nothing synthetic basket rolls back when another batch cannot fit',async()=>{
  const s=await inspect(),before=s.allocations.length;assert.equal((await post({action:'fixture-reserve',items:[{lotId:baked.id,quantity:1},{lotId:randomUUID(),quantity:1}],pickupAt:new Date(Date.now()+3600000).toISOString(),label:'Rejected basket'})).status,409);assert.equal((await inspect()).allocations.length,before);
 });
 await check('concurrent online and walk-in requests serialize without negative stock',async()=>{
  const lot=await count(5,2),s=await inspect(),base={key:randomUUID(),clientId:ownerClient,version:s.state.version};
  const results=await Promise.all([raw({...base,action:'fixture-reserve',items:[{lotId:lot.id,quantity:2}],pickupAt:new Date(Date.now()+3600000).toISOString(),label:'Concurrent online'}),raw({...base,key:randomUUID(),action:'counter-reserve',lotId:lot.id,quantity:3})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  if(results[0].status===409)await hold(lot.id,2);else await good({action:'counter-reserve',lotId:lot.id,quantity:3});
  assert.equal((await post({action:'transfer',lotId:lot.id,channel:'online',stage:'ready',quantity:1})).status,409);assert.equal((await post({action:'counter-reserve',lotId:lot.id,quantity:1})).status,409);
  const allocations=(await inspect()).allocations.filter(a=>a.lines.some(l=>l.lotId===lot.id));assert.equal(allocations.reduce((n,a)=>n+a.lines[0].quantity,0),5);
 });
 await check('competing transfer and reservation cannot both spend the same free units',async()=>{
  const lot=await count(2,2),s=await inspect(),base={clientId:ownerClient,version:s.state.version};const rs=await Promise.all([raw({...base,key:randomUUID(),action:'fixture-reserve',items:[{lotId:lot.id,quantity:2}],pickupAt:new Date(Date.now()+3600000).toISOString(),label:'Competing reservation'}),raw({...base,key:randomUUID(),action:'transfer',lotId:lot.id,channel:'online',stage:'ready',quantity:2})]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);
  const l=(await inspect()).lots.find(x=>x.id===lot.id);assert.equal(l.online_ready+l.truck_ready,2);assert.ok(l.online_ready>=0&&l.truck_ready>=0);
 });
 await check('walk-in reserve then handover consumes once without a second availability deduction',async()=>{
  const l=await count(4,0),a=await good({action:'counter-reserve',lotId:l.id,quantity:2});const before=await inspect();const body={action:'counter-finish',id:a.id,confirmed:true,key:randomUUID(),clientId:ownerClient,version:before.state.version};
  assert.equal((await raw(body)).status,200);assert.equal((await raw(body)).status,200);const after=await inspect();assert.equal(after.lots.find(x=>x.id===l.id).truck_ready,2);assert.equal(after.allocations.find(x=>x.id===a.id).state,'consumed');
  assert.equal((await raw({...body,confirmed:false})).status,400);assert.equal((await post({action:'counter-finish',id:a.id,confirmed:true})).status,409);
 });
 await check('wastage affecting a paid commitment records shortage, protects order and pauses online',async()=>{
  await good({action:'waste',lotId:baked.id,channel:'online',stage:'ready',quantity:1,reason:'Synthetic burnt reserved unit'});const s=await inspect();assert.equal(s.status,'paused');assert.ok(s.issues.shortages.includes(baked.id));assert.equal(s.allocations.find(a=>a.id===paid.id).state,'paid');assert.equal((await post({action:'mode',mode:'open'})).status,409);
  assert.equal((await post({action:'correct',lotId:baked.id,channel:'online',stage:'ready',quantity:3,reason:'Synthetic recount'},staffCookie,staffClient)).status,403);
  await good({action:'correct',lotId:baked.id,channel:'online',stage:'ready',quantity:3,reason:'Verified replacement ready units counted'});await open();
 });
 await check('delays preserve pickup commitments and stop new online allocations when promises conflict',async()=>{
  await good({action:'delay',lotId:baked.id,minutes:120,reason:'Synthetic oven delay'});const s=await inspect();assert.equal(s.status,'paused');assert.ok(s.issues.delayed.includes(paid.id));assert.equal((await post({action:'mode',mode:'open'})).status,409);
  await good({action:'delay',lotId:baked.id,minutes:-60,reason:'Oven recovered and estimate checked'});await good({action:'delay',lotId:baked.id,minutes:-60,reason:'Ready estimate checked again'});await good({action:'mode',mode:'open'});
 });
 await check('expired ordinary holds release by server time; pending, uncertain, paid and counter stay protected',async()=>{
  const l=await count(12,9),unpaid=await hold(l.id),pending=await hold(l.id),uncertain=await hold(l.id),paidHold=await hold(l.id),counter=await good({action:'counter-reserve',lotId:l.id,quantity:1});
  await good({action:'fixture-payment',id:pending.id,state:'pending'});await good({action:'fixture-payment',id:uncertain.id,state:'pending'});await good({action:'fixture-payment',id:uncertain.id,state:'uncertain'});await good({action:'fixture-payment',id:paidHold.id,state:'paid'});
  await db.query('UPDATE kitchen_allocations SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE id IN (?)',[[unpaid.id,pending.id,uncertain.id,paidHold.id,counter.id]]);
  await inspect();assert.equal((await raw({action:'heartbeat',clientId:ownerClient})).status,200);const s=await inspect(),state=id=>s.allocations.find(a=>a.id===id).state;assert.equal(state(unpaid.id),'released');assert.equal(state(pending.id),'pending');assert.equal(state(uncertain.id),'uncertain');assert.equal(state(paidHold.id),'paid');assert.equal(state(counter.id),'counter_pending');
 });
 await check('public availability is read-only and strips allocation, staff and private identifiers',async()=>{
  const before=(await db.query('SELECT COUNT(*) n FROM kitchen_events'))[0][0].n;const r=await request('/api/kitchen/availability');assert.equal(r.status,200);assert.equal(r.data.enabled,true);assert.ok(r.data.heartbeatAt);assert.ok(r.data.products.some(p=>p.name.includes('Golden corn')));assert.doesNotMatch(JSON.stringify(r.data),/heartbeatClient|actorId|allocations|expiresAt|Synthetic reservation|pickupAt/);assert.equal((await db.query('SELECT COUNT(*) n FROM kitchen_events'))[0][0].n,before);assert.equal((await request('/api/kitchen/availability',{method:'POST',body:{}})).status,405);
 });
 await check('expired browser heartbeat leaves verified session and stock available',async()=>{
  await db.query('UPDATE kitchen_state SET heartbeat_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 91 SECOND)');const s=await inspect();assert.equal(s.fresh,true);assert.equal(s.status,'open');assert.equal(s.connectionReason,'connection_expired');assert.equal((await request('/api/kitchen/availability')).data.status,'open');assert.equal((await raw({action:'heartbeat',clientId:ownerClient})).status,200);
 });
 await check('expired stock review pauses intake even with current heartbeat and retains obligations',async()=>{
  await open();await db.query('UPDATE kitchen_service SET review_due_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND)');assert.equal((await inspect()).status,'paused');assert.equal((await raw({action:'heartbeat',clientId:ownerClient})).status,200);assert.equal((await post({action:'ready',lotId:baked.id,quantity:1})).status,409);const p=(await request('/api/kitchen/availability')).data;assert.equal(p.status,'paused');assert.ok(p.products.every(p=>p.ready===0&&p.baking===0));assert.equal((await inspect()).allocations.find(a=>a.id===paid.id).state,'paid');
 });
 await check('session closes by server clock and reopening requires a recent physical review',async()=>{
  await open();await db.query('UPDATE kitchen_service SET session_closes_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND)');assert.equal((await request('/api/kitchen/availability')).data.status,'closed');await db.query('UPDATE kitchen_state SET reviewed_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 6 MINUTE)');assert.equal((await post({action:'mode',mode:'open'})).status,409);await open();
 });
 await check('service policy bounds permissions and extensions never silently extend stock confidence',async()=>{
  const policy={action:'service-policy',reviewMinutes:720,prepMinutes:10,windowMinutes:15,capacityOrders:6,capacityUnits:60},before=(await inspect()).state.reviewDueAt;assert.equal((await post(policy,staffCookie,staffClient)).status,403);await good(policy);assert.equal((await inspect()).state.reviewDueAt,before);assert.equal((await post({...policy,reviewMinutes:721})).status,400);await good({...policy,reviewMinutes:480});await open();
 });
 await check('reconnect refuses an old version; takeover invalidates the former heartbeat owner',async()=>{
  const old=await inspect();await good({action:'mode',mode:'paused'},staffCookie,staffClient);assert.equal((await raw({action:'connect',key:randomUUID(),clientId:ownerClient,version:old.state.version,checked:true})).status,409);
  await good({action:'connect',checked:true},staffCookie,staffClient);assert.equal((await raw({action:'heartbeat',clientId:ownerClient})).status,403);assert.equal((await inspect()).state.mode,'paused');await open();
 });
 await check('synthetic paid handover requires set-aside and never deducts availability twice',async()=>{
  const l=await count(4,4),a=await hold(l.id,2);await good({action:'fixture-payment',id:a.id,state:'paid'});assert.equal((await post({action:'fixture-collect',id:a.id})).status,409);await good({action:'set-aside',id:a.id});await good({action:'fixture-collect',id:a.id});const s=await inspect();assert.equal(s.lots.find(x=>x.id===l.id).online_ready,2);assert.equal(s.allocations.find(x=>x.id===a.id).state,'consumed');
 });
 await check('late successful fixture payment creates an exception without stealing released capacity',async()=>{
  const l=await count(2,2),a=await hold(l.id,2);await db.execute('UPDATE kitchen_allocations SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE id=?',[a.id]);await inspect();await raw({action:'heartbeat',clientId:ownerClient});const b=await hold(l.id,2);await good({action:'fixture-payment',id:a.id,state:'paid'});const s=await inspect();assert.equal(s.allocations.find(x=>x.id===a.id).state,'late_exception');assert.equal(s.allocations.find(x=>x.id===b.id).state,'unpaid');assert.equal(s.status,'paused');
 });
 await check('kitchen changes are audited and leave legacy stock, orders and reporting unchanged',async()=>{
  assert.deepEqual(await fingerprint(),legacy);const [events]=await db.query('SELECT COUNT(*) n FROM kitchen_events');const [audit]=await db.query("SELECT COUNT(*) n FROM audit_log WHERE action LIKE 'kitchen:%' AND entity_type='kitchen_event'");assert.ok(Number(events[0].n)>20);assert.equal(events[0].n,audit[0].n);
 });
 // Reset only this newly-created disposable fixture ledger for the screen demo.
 for(const table of ['kitchen_allocation_lines','kitchen_allocations','kitchen_lots','kitchen_events','kitchen_observations'])await db.query('DELETE FROM '+table);
 await db.query("UPDATE kitchen_state SET mode='closed',heartbeat_at=NULL,heartbeat_client=NULL,heartbeat_actor=NULL,version=version+1");
 return {inspect,post,good,open,ownerClient,staffClient};
}
