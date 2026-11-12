import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHmac} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm,writeFile,chmod,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCallbackRelay,validateRelayConfig,readPrivateRelayConfig} from '../scripts/d2/callback-relay.mjs';
import {assertSandboxIdentity,assertSandboxPayment,assertTestRecipient,SQUARE_SANDBOX_ORIGIN,REQUIRED_SCOPES} from '../scripts/d2/guards.mjs';

// Synthetic signed HTTP fixtures only. No provider call, external listener or email.
const config={enabled:true,environment:'sandbox',identityVerified:true,origin:SQUARE_SANDBOX_ORIGIN,applicationId:'synthetic-app',merchantId:'synthetic-merchant',locationId:'synthetic-location',notificationUrl:'https://callback.example.test/api/ordering/square/webhook',signatureKey:randomBytes(32).toString('hex'),expiresAt:Date.now()+600000};
const identity={client_id:config.applicationId,merchant_id:config.merchantId,scopes:REQUIRED_SCOPES};
const merchant={id:config.merchantId,country:'CA',currency:'CAD'},location={id:config.locationId,merchant_id:config.merchantId,country:'CA',currency:'CAD',status:'ACTIVE'};
const order={id:'synthetic-order',totalCents:1600},payment={id:'synthetic-payment',location_id:config.locationId,reference_id:order.id,amount_money:{amount:1600,currency:'CAD'},status:'COMPLETED'};
test('sandbox identity requires exact environment application seller location country currency and minimal scopes',()=>{
 assert.equal(assertSandboxIdentity(config,identity,merchant,location),true);
 for(const c of [{...config,enabled:false},{...config,environment:'production'},{...config,origin:'https://connect.squareup.com'},{...config,applicationId:'other-application'}])assert.throws(()=>assertSandboxIdentity(c,identity,merchant,location));
 assert.throws(()=>assertSandboxIdentity(config,{...identity,scopes:[...REQUIRED_SCOPES,'CUSTOMERS_WRITE']},merchant,location));
 assert.throws(()=>assertSandboxIdentity(config,{...identity,scopes:['PAYMENTS_READ']},merchant,location));
 for(const l of [{...location,merchant_id:'different'},{...location,currency:'USD'},{...location,country:'US'},{...location,status:'INACTIVE'}])assert.throws(()=>assertSandboxIdentity(config,identity,merchant,l));
});
test('payment normalization rejects amount currency location reference and unknown result mismatches',()=>{
 assert.equal(assertSandboxPayment(config,order,payment),'COMPLETED');
 for(const p of [{...payment,location_id:'other-location'},{...payment,reference_id:'other-order'},{...payment,amount_money:{amount:1599,currency:'CAD'}},{...payment,amount_money:{amount:1600,currency:'USD'}},{...payment,status:'UNKNOWN'},{...payment,id:'bad-id\n'}])assert.throws(()=>assertSandboxPayment(config,order,p));
});
test('recipient allowlist defaults to deny and rejects wildcards lists display names and newline injection',()=>{
 assert.equal(assertTestRecipient('owner@example.test',['owner@example.test']),'owner@example.test');
 for(const address of ['customer@example.test','owner@example.test,other@example.test','Owner <owner@example.test>','owner@example.test\n','*@example.test'])assert.throws(()=>assertTestRecipient(address,['owner@example.test']));
 assert.throws(()=>assertTestRecipient('owner@example.test',[]));assert.throws(()=>assertTestRecipient('owner@example.test',['*@example.test']));
});
test('relay requires enabled verified sandbox exact HTTPS path and bounded expiry',()=>{
 for(const c of [{...config,enabled:false},{...config,environment:'production'},{...config,identityVerified:false},{...config,expiresAt:Date.now()-1},{...config,expiresAt:Date.now()+5*3600000},{...config,notificationUrl:'http://callback.example.test/api/ordering/square/webhook'},{...config,notificationUrl:config.notificationUrl+'?token=bad'},{...config,notificationUrl:'https://callback.example.test/workspace'}])assert.throws(()=>validateRelayConfig(c));
});
test('private config must be owner-only non-symlink and outside repository',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'puna-d2-config-'));try{
  const file=join(dir,'private.json');await writeFile(file,JSON.stringify(config),{mode:0o600});assert.equal((await readPrivateRelayConfig(file,process.cwd())).environment,'sandbox');
  await chmod(file,0o644);await assert.rejects(readPrivateRelayConfig(file,process.cwd()));await chmod(file,0o600);
  const linked=join(dir,'link.json');await symlink(file,linked);await assert.rejects(readPrivateRelayConfig(linked,process.cwd()));await assert.rejects(readPrivateRelayConfig(file,dir));const deceptive=join(dir,'..private.json');await writeFile(deceptive,JSON.stringify(config),{mode:0o600});await assert.rejects(readPrivateRelayConfig(deceptive,dir));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('callback listener boundaries and restart persistence',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'puna-d2-relay-'));let server=await createCallbackRelay(config,dir);
 const listen=async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;};let origin=await listen();
 const event={event_id:'synthetic-event-001',merchant_id:config.merchantId,type:'payment.updated',data:{id:payment.id,object:{payment}}};
 const signed=(value,url=config.notificationUrl)=>createHmac('sha256',config.signatureKey).update(url).update(value).digest('base64');
 const send=async(value=event,options={})=>{const raw=typeof value==='string'?value:JSON.stringify(value);return fetch(origin+(options.path||'/api/ordering/square/webhook'),{method:options.method||'POST',headers:{'content-type':options.contentType||'application/json','x-square-hmacsha256-signature':options.signature??signed(raw,options.signUrl),...options.headers},body:(options.method||'POST')==='GET'?undefined:raw});};
 try {
  await t.test('unrelated application admin fixture optimizer and arbitrary query routes are unavailable',async()=>{for(const path of ['/','/workspace','/food-truck','/api/local-fixtures','/_next/image','/api/ordering/square/webhook?x=1','/api/ordering/square/%77ebhook'])assert.equal((await send(event,{path})).status,404);});
  await t.test('GET and wrong content encoding/type are rejected',async()=>{assert.equal((await send(event,{method:'GET'})).status,404);assert.equal((await send(event,{contentType:'text/plain'})).status,415);assert.equal((await send(event,{headers:{'content-encoding':'gzip'}})).status,415);});
  await t.test('invalid signature and wrong registered URL are rejected',async()=>{assert.equal((await send(event,{signature:'forged'})).status,403);assert.equal((await send(event,{signUrl:'https://wrong.example.test/webhook'})).status,403);});
  await t.test('wrong merchant location event type and invalid JSON are rejected',async()=>{for(const e of [{...event,merchant_id:'another-merchant'},{...event,type:'customer.created'},{...event,data:{...event.data,object:{payment:{...payment,location_id:'another-location'}}}}])assert.equal((await send(e)).status,400);assert.equal((await send('{')).status,400);});
  await t.test('oversized callback is bounded before JSON parsing',async()=>assert.equal((await send('x'.repeat(32769))).status,413));
  await t.test('valid signed callback acknowledges only after minimized durable persistence',async()=>{assert.equal((await send(event)).status,202);const files=await readdir(dir);assert.equal(files.length,1);const saved=JSON.parse(await readFile(join(dir,files[0]),'utf8'));assert.deepEqual(Object.keys(saved).sort(),['bodyHash','eventId','objectId','receivedAt','type']);assert.ok(!JSON.stringify(saved).includes('amount_money'));});
  await t.test('duplicate and simultaneous delivery create one durable event',async()=>{assert.ok((await Promise.all(Array.from({length:5},()=>send(event)))).every(r=>r.status===202));assert.equal((await readdir(dir)).length,1);});
  await t.test('same event identity with changed content is refused',async()=>assert.equal((await send({...event,type:'payment.created'})).status,409));
  await t.test('delayed and out-of-order signed events enqueue without applying client payment state',async()=>{assert.equal((await send({...event,event_id:'synthetic-event-earlier',type:'payment.created',created_at:'2020-01-01T00:00:00Z'})).status,202);assert.equal((await readdir(dir)).length,2);});
  await t.test('restart retains duplicate suppression and provider retry can be acknowledged',async()=>{await new Promise(r=>server.close(r));server=await createCallbackRelay(config,dir);origin=await listen();assert.equal((await send(event)).status,202);assert.equal((await readdir(dir)).length,2);});
  await t.test('forwarded paths and hosts cannot turn listener into an application proxy',async()=>assert.equal((await send(event,{path:'/api/local-fixtures',headers:{'x-forwarded-host':'staging.punaempanadas.ca','x-original-url':'/api/ordering/square/webhook'}})).status,404));
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
