import {runMenuStudioChecks} from './menu-studio-integration.mjs';
import {checkCharts} from './chart-browser.mjs';
import {captureApprovedSection} from './approved-visual.mjs';
import {runPosChecks} from './kitchen-square-integration.mjs';
import {runOrderingChecks} from './ordering-integration.mjs';
import {runOrderingBrowser} from './ordering-browser.mjs';
import {runKitchenChecks} from './kitchen-integration.mjs';
import {runKitchenBrowser,visualMismatches} from './kitchen-browser.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertSyntheticContext} from './disposable-context.mjs';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,randomUUID,scryptSync,createHash} from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import mysql from 'mysql2/promise';
import {chromium} from 'playwright';
import {runCommerceChecks} from './commerce-integration.mjs';
import {runRecordChecks} from './records-integration.mjs';
import {runCustomerChecks} from './customers-integration.mjs';
import {runSalesChecks} from './sales-integration.mjs';
import {verifySyntheticRecovery} from './recovery.mjs';

assertSyntheticContext();
const db=await mysql.createConnection({host:'127.0.0.1',port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,multipleStatements:true});
// Match the established hosted database, including its inherited table collation.
await db.query('ALTER DATABASE puna_ci_synthetic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
for(const [file,expected] of Object.entries(JSON.parse(readFileSync('tests/preserved-assets.json','utf8'))))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),expected,'Preserved public asset '+file);
const origin='https://localhost:3443';
const appArgs=['--import', './tests/provider-fixture.mjs',...(process.env.PUNA_TEST_STANDALONE==='true'?['.next/standalone/server.js']:['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'])];
const appAddress={HOSTNAME:'127.0.0.1',PORT:'3100',PUNA_CHECKOUT_MODE:'square-sandbox',SQUARE_SANDBOX_ACCESS_TOKEN:'synthetic-not-a-provider-secret',SQUARE_SANDBOX_LOCATION_ID:'synthetic-location',SQUARE_SANDBOX_APPLICATION_ID:'synthetic-application',SQUARE_WEBHOOK_SIGNATURE_KEY:'synthetic-webhook-only',SQUARE_WEBHOOK_URL:'https://127.0.0.1:3443/api/square/webhook',PUNA_JOB_TOKEN:'synthetic-ci-job-token-never-use-on-hosting'};
const certDirectory=mkdtempSync(join(tmpdir(),'puna-phase-b-synthetic-'));
let app,proxy,browser;let passed=0;
const check=async(name,fn)=>{try{await fn();passed++;console.log('PASS '+name)}catch(error){
 console.log('FAIL '+name);if(browser){mkdirSync('test-artifacts/screenshots',{recursive:true});let n=0;for(const c of browser.contexts())for(const p of c.pages()){console.log('Browser diagnostic '+JSON.stringify({path:new URL(p.url()).pathname+new URL(p.url()).search,headings:await p.getByRole('heading').allTextContents(),overflow:await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1&&r.width>0}).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right}))),labelCount:await p.locator('label').count(),dialogs:await p.locator('dialog[open]').evaluateAll(ds=>ds.map(d=>({name:d.getAttribute('aria-label'),labels:[...d.querySelectorAll('label')].map(l=>l.textContent?.slice(0,100))}))),alerts:await p.getByRole('alert').allTextContents(),statuses:await p.getByRole('status').allTextContents()}));await p.screenshot({path:'test-artifacts/screenshots/failure-'+(++n)+'.png',fullPage:true})}}throw error}};
function request(path,{method='GET',body,rawBody,cookie,originHeader=origin,extraHeaders={}}={}){
 return new Promise((resolve,reject)=>{
  const headers={...extraHeaders};if(cookie)headers.cookie=cookie;if(originHeader!==null)headers.origin=originHeader;
  const payload=rawBody??(body===undefined?undefined:JSON.stringify(body));
  if(payload){if(!rawBody)headers['content-type']='application/json';headers['content-length']=Buffer.byteLength(payload)}
  const r=https.request(origin+path,{method,headers,rejectUnauthorized:false},res=>{let text='';res.on('data',d=>text+=d);res.on('end',()=>{let data;try{data=JSON.parse(text)}catch{data=text}resolve({status:res.statusCode,data,headers:res.headers})})});r.on('error',reject);r.end(payload);
 });
}
const auth=(body,options={})=>request('/api/auth',{method:'POST',body,...options});
const password=randomBytes(24).toString('hex');
const token=randomBytes(32).toString('hex');
const owner={action:'setup',token,email:'owner@example.test',name:'Synthetic owner',password};
const login=async(email=owner.email)=>{const r=await auth({action:'login',email,password});assert.equal(r.status,200);const set=r.headers['set-cookie'][0];assert.match(set,/HttpOnly/i);assert.match(set,/Secure/i);assert.match(set,/SameSite=lax/i);return set.split(';')[0]};
const count=async(table)=>Number((await db.query('SELECT COUNT(*) AS n FROM '+table))[0][0].n);
let cookie;
const product=async()=>{const r=await request('/api/products',{cookie});assert.equal(r.status,200);return r.data.products[0]};
const patch=(p,extra={},options={})=>request('/api/products',{method:'PATCH',cookie,body:{id:p.id,version:p.version,name:p.name,description:p.description,price_cents:p.price_cents,available:!!p.available,...extra},...options});
try{
 for(const file of ['001_initial.sql','003_auth_rate_limits.sql','004_product_versions.sql','005_unified_staging.sql'])await db.query(readFileSync('db/'+file,'utf8'));
 execFileSync(process.execPath,['scripts/migrate.mjs','--apply'],{stdio:'pipe'});
 execFileSync(process.execPath,['scripts/migrate.mjs','--migration=007_customer_notes','--apply'],{stdio:'pipe'});
 execFileSync(process.execPath,['scripts/migrate.mjs','--migration=008_reporting','--apply'],{stdio:'pipe'});
 execFileSync(process.execPath,['scripts/migrate.mjs','--migration=011_menu_studio','--apply'],{stdio:'pipe'});
 await check('additive migration reruns preserve the schema',async()=>{for(const migration of ['006_commerce','007_customer_notes','008_reporting','011_menu_studio']){const out=execFileSync(process.execPath,['scripts/migrate.mjs','--migration='+migration,'--apply'],{encoding:'utf8'});assert.match(out,/already_applied/)}});
 await check('migration ledger cannot hide a missing expected table',async()=>{
  const [before]=await db.query("SELECT checksum FROM schema_migrations WHERE id='007_customer_notes'");
  await db.query('RENAME TABLE customer_notes TO synthetic_migration_customer_notes');
  try{
   assert.throws(()=>execFileSync(process.execPath,['scripts/migrate.mjs','--migration=007_customer_notes','--apply'],{encoding:'utf8',stdio:'pipe'}),error=>{
    assert.notEqual(error.status,0);assert.match(String(error.stderr),/Migration ledger exists but expected tables are missing/);assert.match(String(error.stderr),/customer_notes/);assert.doesNotMatch(String(error.stdout),/already_applied/);return true;
   });
   const [tables]=await db.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME='customer_notes'",[process.env.DB_NAME]);assert.equal(tables.length,0,'A missing table must not be silently recreated');
   const [after]=await db.query("SELECT checksum FROM schema_migrations WHERE id='007_customer_notes'");assert.deepEqual(after,before);
  }finally{await db.query('RENAME TABLE synthetic_migration_customer_notes TO customer_notes')}
 });
 await db.execute("INSERT INTO products(id,name,description,price_cents,kind) VALUES(?,?,?,?,?)",['synthetic-product','Synthetic product','Disposable integration fixture',1234,'fresh']);
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(certDirectory,'key.pem'),'-out',join(certDirectory,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],{stdio:'ignore'});
 app=spawn(process.execPath,appArgs,{env:{...process.env,...appAddress,BOOTSTRAP_TOKEN:token,STAGING_TEST_ORDERS_ENABLED:'false',NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
 // Only application diagnostics, never request bodies, session tokens or database rows.
 app.stdout.on('data',d=>process.stdout.write(d));app.stderr.on('data',d=>process.stderr.write(d));
 proxy=https.createServer({key:readFileSync(join(certDirectory,'key.pem')),cert:readFileSync(join(certDirectory,'cert.pem'))},(req,res)=>{
  const upstream=http.request({host:'127.0.0.1',port:3100,path:req.url,method:req.method,headers:{...req.headers,host:req.headers.host||'localhost:3443','x-forwarded-proto':'https'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});
  upstream.on('error',()=>{res.writeHead(503);res.end()});req.pipe(upstream);
 });
 await new Promise(resolve=>proxy.listen(3443,'127.0.0.1',resolve));
 let ready=false;for(let i=0;i<60;i++){try{if((await request('/api/auth')).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}
 assert.ok(ready,'Production application starts within 30 seconds');
 await check('anonymous API and workspace denied',async()=>{assert.equal((await request('/api/products')).status,401);assert.equal((await request('/api/products',{method:'PATCH',body:{}})).status,401);assert.equal((await request('/workspace')).status,307)});
 await check('owner setup rejects bad token and missing/foreign origin',async()=>{
  assert.equal((await auth({...owner,token:'x'.repeat(64)})).status,403);
  assert.equal((await auth(owner,{originHeader:null})).status,403);
  assert.equal((await auth(owner,{originHeader:'https://evil.example.test'})).status,403);
  assert.equal(await count('users'),0);
 });
 await check('owner setup is single-use even with concurrent requests',async()=>{
  const results=await Promise.all([auth(owner),auth({...owner,email:'other@example.test'})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  // Whichever setup won is the single synthetic owner.
  owner.email=(await db.query('SELECT email FROM users'))[0][0].email;
  assert.equal(await count('users'),1);assert.equal((await auth(owner)).status,409);
 });
 await check('login creates secure hashed session',async()=>{
  cookie=await login();const raw=cookie.split('=')[1];
  const [sessions]=await db.query('SELECT id_hash FROM sessions');
  assert.equal(sessions[0].id_hash,createHash('sha256').update(raw).digest('hex'));assert.notEqual(sessions[0].id_hash,raw);
  assert.equal((await request('/api/auth',{cookie})).data.user.role,'owner');
 });
 await check('login throttles repeated failed attempts',async()=>{
  for(let i=0;i<5;i++)assert.equal((await auth({action:'login',email:'nobody@example.test',password:'incorrect-password'})).status,401);
  assert.equal((await auth({action:'login',email:'nobody@example.test',password:'incorrect-password'})).status,429);
 });
 await check('server denies missing, foreign and insecure mutation origins',async()=>{
  const p=await product();for(const value of [null,'https://evil.example.test','http://localhost:3443'])assert.equal((await patch(p,{}, {originHeader:value})).status,403);
  assert.equal(await count('audit_log'),0);
 });
 await check('staff cannot read or mutate products',async()=>{
  const salt=randomBytes(16).toString('hex'),hash='scrypt:'+salt+':'+scryptSync(password,salt,64).toString('hex');
  await db.execute('INSERT INTO users(email,display_name,role,password_hash) VALUES(?,?,?,?)',['staff@example.test','Synthetic staff','staff',hash]);
  const staff=await login('staff@example.test');assert.equal((await request('/api/products',{cookie:staff})).status,403);
  assert.equal((await patch(await product(),{}, {cookie:staff})).status,403);
 });
 await check('invalid fields do not write data or audit',async()=>{const p=await product();assert.equal((await patch(p,{price_cents:-1})).status,400);assert.equal(await count('audit_log'),0)});
 await check('save persists without implicit product confirmation',async()=>{
  const p=await product();assert.equal((await patch(p,{name:'Synthetic edited'})).status,200);
  const saved=await product();assert.equal(saved.name,'Synthetic edited');assert.equal(saved.version,p.version+1);assert.equal(saved.source_status,'initial');assert.equal(await count('audit_log'),1);
 });
 await check('explicit confirmation persists with transactional audit',async()=>{
  const p=await product();assert.equal((await patch(p,{confirm:true})).status,200);
  assert.equal((await product()).source_status,'confirmed');
  const [rows]=await db.query("SELECT a.action,a.actor_id,a.entity_id,u.role FROM audit_log a JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 1");
  assert.equal(rows[0].action,'confirm');assert.equal(rows[0].role,'owner');assert.equal(rows[0].entity_id,p.id);
 });
 await check('concurrent edits yield one success and one conflict',async()=>{
  const p=await product(),before=await count('audit_log');
  const result=await Promise.all([patch(p,{name:'Synthetic concurrent A'}),patch(p,{name:'Synthetic concurrent B'})]);
  assert.deepEqual(result.map(r=>r.status).sort(),[200,409]);assert.equal(await count('audit_log'),before+1);
  assert.equal((await product()).version,p.version+1);assert.equal((await product()).source_status,'initial');
 });
 await check('failed audit insert rolls product transaction back',async()=>{
  const p=await product(),before=await count('audit_log');
  await db.query("CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic rollback test'");
  try{assert.equal((await patch(p,{name:'Must roll back'})).status,503)}finally{await db.query('DROP TRIGGER synthetic_audit_failure')}
  const after=await product();assert.equal(after.name,p.name);assert.equal(after.version,p.version);assert.equal(await count('audit_log'),before);
 });
 await check('expired sessions cannot read or write',async()=>{
  await db.query('UPDATE sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND)');
  assert.equal((await request('/api/products',{cookie})).status,401);
  assert.equal((await request('/api/products',{method:'PATCH',cookie,body:{}})).status,401);
  assert.equal((await request('/api/auth',{cookie})).data.user,null);
  cookie=await login();
 });
 await check('logout revokes session and replay is denied',async()=>{
  const old=cookie;assert.equal((await auth({action:'logout'},{cookie})).status,200);assert.equal((await request('/api/products',{cookie:old})).status,401);cookie=await login();
 });

 let staffCookie=await login('staff@example.test'),secondCookie,testOrderId;
 const submitOrder=(body,extra={})=>request('/api/puna',{method:'POST',body,cookie,...extra});
 const orderBody=()=>({action:'order',id:randomUUID(),customer:'Synthetic pickup',slot:'12:00–12:30',items:[{id:'synthetic-product',quantity:2}]});
 await check('public and dashboard share one catalogue without private fields',async()=>{
  const r=await request('/api/puna');assert.equal(r.status,200);assert.match(r.headers['cache-control'],/no-store/);
  assert.equal(r.data.products[0].name,(await product()).name);assert.equal(r.data.products[0].price,(await product()).price_cents);
  for(const key of ['orders','users','sessions','password_hash','email'])assert.equal(key in r.data,false);
  assert.equal(r.data.canManage,false);assert.equal((await request('/api/puna',{cookie})).data.canManage,true);
  assert.equal((await submitOrder(orderBody())).status,403);assert.equal(await count('test_orders'),0);
 });
 await check('workers denied owner routes, account creation and old mutation surfaces',async()=>{
  const r=await request('/workspace?view=edit',{cookie:staffCookie});assert.equal(r.status,307);assert.equal(r.headers.location,'/food-truck');
  for(const path of ['/api/website','/api/accounts'])assert.equal((await request(path,{cookie:staffCookie})).status,403);
  assert.equal((await request('/api/website',{method:'PATCH',cookie:staffCookie,body:{}})).status,403);
  assert.equal((await request('/api/accounts',{method:'POST',cookie:staffCookie,body:{role:'owner'}})).status,403);
  assert.equal((await request('/api/truck')).status,401);
 });
 await check('second owner provisioned through authenticated audited API',async()=>{
  const body={email:'owner-two@example.test',name:'Synthetic second owner',role:'owner',password};const before=await count('audit_log');
  assert.equal((await request('/api/accounts',{method:'POST',cookie,body,originHeader:null})).status,403);
  assert.equal((await request('/api/accounts',{method:'POST',cookie,body})).status,201);
  assert.equal(await count('audit_log'),before+1);secondCookie=await login(body.email);
  assert.equal((await request('/api/products',{cookie:secondCookie})).status,200);
  assert.equal((await request('/workspace',{cookie:secondCookie})).status,200);
  const accounts=await request('/api/accounts',{cookie:secondCookie});assert.equal(accounts.data.users.filter(u=>u.role==='owner').length,2);
  assert.ok(accounts.data.users.every(u=>!('password_hash' in u)));
 });
 const originalSettings=(await request('/api/puna')).data.settings;
 await check('shared website content uses conflict detection and audit rollback',async()=>{
  const write=(version,settings,extra={})=>request('/api/website',{method:'PATCH',cookie,body:{version,settings},...extra});
  const before=await count('audit_log');
  assert.equal((await write(0,originalSettings,{originHeader:'https://evil.example.test'})).status,403);
  const results=await Promise.all([write(0,{...originalSettings,hours:'Synthetic hours A'}),write(0,{...originalSettings,hours:'Synthetic hours B'})]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);assert.equal(await count('audit_log'),before+1);
  const current=await request('/api/website',{cookie});
  assert.equal((await request('/api/puna')).data.settings.hours,current.data.settings.hours);
  await db.query("CREATE TRIGGER synthetic_settings_failure BEFORE INSERT ON audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic rollback test'");
  try{assert.equal((await write(current.data.version,{...originalSettings,hours:'Must roll back'})).status,503)}finally{await db.query('DROP TRIGGER synthetic_settings_failure')}
  assert.equal((await request('/api/website',{cookie})).data.version,current.data.version);
  assert.equal((await write(current.data.version,originalSettings)).status,200);
 });
 await check('disabled account loses existing session immediately',async()=>{
  await db.execute("UPDATE users SET active=0 WHERE email='staff@example.test'");
  assert.equal((await request('/api/truck',{cookie:staffCookie})).status,401);
  await db.execute("UPDATE users SET active=1 WHERE email='staff@example.test'");
 });
 await check('bootstrap removed on restart; synthetic ordering explicitly enabled only in CI',async()=>{
  const exit=new Promise(resolve=>app.once('exit',resolve));app.kill('SIGTERM');await exit;
  app=spawn(process.execPath,appArgs,{env:{...process.env,...appAddress,BOOTSTRAP_TOKEN:'',STAGING_TEST_ORDERS_ENABLED:'true',NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
  app.stdout.on('data',d=>process.stdout.write(d));app.stderr.on('data',d=>process.stderr.write(d));
  let ready=false;for(let i=0;i<60;i++){try{if((await request('/api/auth')).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}assert.ok(ready);
  assert.equal((await auth(owner)).status,403);assert.equal((await request('/api/puna')).data.testOrdersEnabled,true);
 });
 await check('test order requires session and origin, prices come from shared database',async()=>{
  assert.equal((await submitOrder(orderBody(),{cookie:undefined})).status,401);
  assert.equal((await submitOrder(orderBody(),{originHeader:null})).status,403);
  for(const action of ['settings','product','status'])assert.equal((await submitOrder({action},{cookie:staffCookie})).status,400);
  assert.equal((await submitOrder({...orderBody(),total:1})).status,400);
  const item=await product();assert.equal((await patch(item,{available:true})).status,200);
  const body=orderBody();testOrderId=body.id;const before=await count('audit_log');
  const results=await Promise.all([submitOrder(body),submitOrder(body)]);assert.deepEqual(results.map(r=>r.status),[200,200]);
  assert.equal(await count('test_orders'),1);assert.equal(await count('audit_log'),before+1);assert.equal(results[0].data.total,(await product()).price_cents*2);
  assert.equal((await submitOrder(body,{cookie:secondCookie})).status,409);
 });
 await check('worker status transitions are restricted, versioned and audited atomically',async()=>{
  const queue=await request('/api/truck',{cookie:staffCookie});assert.equal(queue.status,200);const o=queue.data.orders[0];
  assert.equal('total' in o,false);assert.equal('price' in o.items[0],false);
  const update=(status,extra={})=>request('/api/truck',{method:'PATCH',cookie:staffCookie,body:{id:o.id,version:o.version,status},...extra});
  assert.equal((await update('Preparing',{originHeader:null})).status,403);
  assert.equal((await update('Collected')).status,403);assert.equal((await update('Cancelled')).status,403);
  const before=await count('audit_log');
  await db.query("CREATE TRIGGER synthetic_order_failure BEFORE INSERT ON audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic rollback test'");
  try{assert.equal((await update('Preparing')).status,503)}finally{await db.query('DROP TRIGGER synthetic_order_failure')}
  assert.equal((await request('/api/truck',{cookie:staffCookie})).data.orders[0].status,'New');
  const results=await Promise.all([update('Preparing'),update('Preparing')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(await count('audit_log'),before+1);
  const row=(await db.query("SELECT a.actor_id,u.role FROM audit_log a JOIN users u ON a.actor_id=u.id WHERE a.action='status:Preparing'"))[0][0];assert.equal(row.role,'staff');
 });
 await runCommerceChecks({db,request,check,cookie,staffCookie});
 await runRecordChecks({db,request,check,cookie,staffCookie});
 await runSalesChecks({db,request,check,cookie,staffCookie});
 await runCustomerChecks({db,request,check,cookie,staffCookie});
 await check('owner order book separates Sandbox records and omits private receipt credentials',async()=>{
  assert.equal((await request('/api/workspace')).status,401);
  assert.equal((await request('/api/workspace',{cookie:staffCookie})).status,403);
  const live=await request('/api/workspace',{cookie});assert.equal(live.status,200);assert.equal(live.data.scope,'live');assert.equal(live.data.orders.length,0);assert.equal(live.data.summary.activeOrders,0);
  const sandbox=await request('/api/workspace?scope=sandbox&filter=all',{cookie});assert.equal(sandbox.status,200);
  const expected=Number((await db.query('SELECT COUNT(*) n FROM pickup_orders WHERE is_test=1'))[0][0].n);
  assert.equal(sandbox.data.total,expected);assert.ok(sandbox.data.orders.length>0);assert.ok(sandbox.data.orders.length<=25);
  for(const order of sandbox.data.orders){assert.equal(Number(order.is_test),1);assert.ok(Array.isArray(order.items));for(const key of ['receipt_hash','checkout_key','request_hash','square_payment_id','square_order_id','payment_idempotency_key','contact_email'])assert.equal(key in order,false)}
  const active=await request('/api/workspace?scope=sandbox&filter=active',{cookie});assert.ok(active.data.orders.every(o=>o.payment_status==='paid'&&o.refund_status==='none'&&o.order_status==='open'&&o.fulfilment_status!=='collected'));
  for(const query of ['scope=unknown','page=0','page=1.5','filter=unknown','scope=live&scope=sandbox'])assert.equal((await request('/api/workspace?'+query,{cookie})).status,400);
 });
 app.kill('SIGTERM');await new Promise(resolve=>app.once('exit',resolve));
 app=spawn(process.execPath,appArgs,{env:{...process.env,...appAddress,BOOTSTRAP_TOKEN:'',STAGING_TEST_ORDERS_ENABLED:'false',NODE_ENV:'production',GOOGLE_CLIENT_ID:'synthetic-google-client',GOOGLE_CLIENT_SECRET:'synthetic-not-real',PUNA_ORIGIN:'https://staging.punaempanadas.ca'},stdio:['ignore','pipe','pipe']});app.stdout.on('data',d=>process.stdout.write(d));app.stderr.on('data',d=>process.stderr.write(d));
 for(let i=0;i<60;i++){try{if((await request('/api/google')).data.configured)break}catch{}await new Promise(r=>setTimeout(r,500))}

 await check('Google signed tokens still require an invitation or explicit existing-account linking',async()=>{
 const begin=async(who,invitation,link=false)=>{const r=await request('/api/google',{method:'POST',cookie:who,body:{invitation,link}});assert.equal(r.status,200);const u=new URL(r.data.url);assert.equal(u.searchParams.get('scope'),'openid email profile');return {state:u.searchParams.get('state'),nonce:u.searchParams.get('nonce'),cookie:r.headers['set-cookie'][0].split(';')[0]};};
 const finish=(b,claims,session)=>request('/api/google/callback?'+new URLSearchParams({state:b.state,code:Buffer.from(JSON.stringify({sub:'synthetic-google-owner',email:owner.email,nonce:b.nonce,...claims})).toString('base64url')}),{cookie:[session,b.cookie].filter(Boolean).join('; ')});
 const denied=r=>{assert.equal(r.status,307);assert.match(r.headers.location,/\/sign-in\?identity=failed$/);assert.equal((r.headers['set-cookie']||[]).some(c=>c.startsWith('puna_session=')),false)};
 const uninvited=await begin();denied(await finish(uninvited,{}));
 for(const change of [{aud:'wrong-audience'},{iss:'https://evil.example.test'},{exp:1},{nonce:'wrong'},{email_verified:false},{iat:null}]){const b=await begin(cookie,undefined,true);denied(await finish(b,change,cookie));}
 const link=await begin(cookie,undefined,true);assert.match((await finish(link,{},cookie)).headers.location,/\/workspace$/);denied(await finish(link,{},cookie));
 const signedIn=await begin();assert.match((await finish(signedIn,{email:'changed-verified-email@example.test'})).headers.location,/\/workspace$/);
 });
 await check('invited Google worker gets restricted access and revocation invalidates the session',async()=>{
 const invitation=await request('/api/team',{method:'POST',cookie,body:{action:'invite',email:'google-worker@example.test',role:'staff'}});assert.equal(invitation.status,200);
 const token=new URLSearchParams(invitation.data.privateInvitation.split('#')[1]).get('invite');
 const b=await request('/api/google',{method:'POST',body:{invitation:token}});const u=new URL(b.data.url),claims={sub:'synthetic-google-worker',email:'google-worker@example.test',name:'Synthetic invited worker',nonce:u.searchParams.get('nonce')};
 const result=await request('/api/google/callback?'+new URLSearchParams({state:u.searchParams.get('state'),code:Buffer.from(JSON.stringify(claims)).toString('base64url')}),{cookie:b.headers['set-cookie'][0].split(';')[0]});assert.equal(result.status,307);
 const session=result.headers['set-cookie'].find(c=>c.startsWith('puna_session=')).split(';')[0];
 assert.equal((await request('/api/records',{cookie:session})).status,403);assert.equal((await request('/api/operations',{cookie:session})).status,200);
 const [r]=await db.execute("SELECT id,role FROM users WHERE email='google-worker@example.test'");assert.equal(r[0].role,'staff');
 assert.equal((await request('/api/team',{method:'POST',cookie,body:{action:'revoke',userId:r[0].id}})).status,200);assert.equal((await request('/api/operations',{cookie:session})).status,401);
 });

 browser=await chromium.launch(process.platform==='darwin'&&process.env.PUNA_DISPOSABLE_LOCAL_TESTS==='true'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-gpu']}:{});
 // D2 evidence must not retain QR/status credentials, including rendered QR images.
 if(process.env.PUNA_CAPTURE_SYNTHETIC_SCREENSHOTS==='false'){
  const newContext=browser.newContext.bind(browser);
  browser.newContext=async(...args)=>{const c=await newContext(...args);c.on('page',p=>{p.screenshot=async()=>Buffer.alloc(0);Object.getPrototypeOf(p.locator('body')).screenshot=async()=>Buffer.alloc(0);});return c;};
 }
 mkdirSync('test-artifacts/screenshots',{recursive:true});
 const context=await browser.newContext({ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='localhost'?route.continue():route.abort()});
 const page=await context.newPage();page.on('pageerror',e=>console.log('Browser error: '+e.message));
 const navigateWorkspace=async(target,name)=>{
  const nav=target.getByRole('navigation',{name:'Puna workspace',exact:true});
  const button=nav.getByRole('button',{name,exact:true});
  if(!await button.isVisible())await target.getByRole('button',{name:'Open workspace menu',exact:true}).click();
  await button.click();
 };
 const openMenuItem=async(target,name)=>{
  await target.getByRole('button',{name:'Edit '+name,exact:true}).click();
  const editor=target.getByRole('dialog',{name:'Edit menu item',exact:true});
  await editor.waitFor();return editor;
 };
 await check('browser drafts persist separately; explicit publication updates the menu',async()=>{
  await page.goto(origin+'/sign-in');await page.getByLabel('Email',{exact:true}).fill(owner.email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/workspace');
  const logo=page.getByRole('link',{name:'Puna website',exact:true}).locator('img');await logo.waitFor();await logo.evaluate(im=>im.decode());assert.ok(await logo.evaluate(im=>im.naturalWidth>0));
  await navigateWorkspace(page,'Menu & Products');const original=await product();let editor=await openMenuItem(page,original.name);
  await editor.getByLabel('Name',{exact:true}).fill('Synthetic browser edit');await editor.getByLabel('Price (CAD)',{exact:true}).fill('8.25');await editor.getByLabel('Ingredients & filling',{exact:true}).fill('Synthetic ingredients');
  await editor.getByRole('button',{name:'Save draft',exact:true}).click();await editor.getByRole('status').filter({hasText:'Draft saved'}).waitFor();assert.equal((await product()).name,original.name);
  await page.reload();editor=await openMenuItem(page,original.name);assert.equal(await editor.getByLabel('Name',{exact:true}).inputValue(),'Synthetic browser edit');assert.equal(Number(await editor.getByLabel('Price (CAD)',{exact:true}).inputValue()),8.25);
  await editor.getByLabel('I confirm the price, ingredients, photo and schedule are accurate',{exact:true}).check();await editor.getByRole('button',{name:'Publish to menu',exact:true}).click();await editor.getByRole('status').filter({hasText:'Published to the menu'}).waitFor();assert.equal((await product()).source_status,'confirmed');assert.equal((await product()).price_cents,825);
  await editor.getByRole('button',{name:'Close menu item',exact:true}).click();
 });
 await check('mobile editor remains usable without horizontal overflow',async()=>{
  await page.setViewportSize({width:390,height:844});await page.reload();const editor=await openMenuItem(page,'Synthetic browser edit');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.ok(await editor.getByLabel('Name',{exact:true}).isVisible());
  const box=await editor.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
  await editor.getByLabel('Name',{exact:true}).focus();await page.keyboard.press('Escape');await editor.waitFor({state:'hidden'});
  assert.ok(await page.getByRole('button',{name:'Edit Synthetic browser edit',exact:true}).evaluate(e=>e===document.activeElement));
 });
 await check('sales and source recipe views show synthetic evidence on desktop and mobile',async()=>{
  await page.setViewportSize({width:1440,height:1000});await navigateWorkspace(page,'Today');await page.getByRole('tab',{name:'Sales reports',exact:true}).click();await page.getByText('Source review, mappings & reporting controls',{exact:true}).click();await page.getByRole('heading',{name:'Historical Square files',exact:true}).waitFor();
  await page.getByLabel('From',{exact:true}).fill('2025-01-01');await page.getByLabel('Through',{exact:true}).fill('2025-12-31');await page.getByLabel('Group by',{exact:true}).selectOption('product');
  await page.getByText('Synthetic source recipe · recipe · requires verification',{exact:true}).click();await page.locator('.source-references details[open] th').filter({hasText:'Source quantity'}).scrollIntoViewIfNeeded();
  for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-artifacts/screenshots/'+device+'-sales.png',fullPage:true});}
  await navigateWorkspace(page,'Kitchen');await page.getByRole('tab',{name:'Recipes & production',exact:true}).click();await page.getByRole('heading',{name:'Source recipes',exact:true}).waitFor();
  await page.goto(origin+'/workspace');
 });
 await check('dashboard tabs, metric selection, sorting and product detail work responsively',async()=>{
  await navigateWorkspace(page,'Today');await page.getByRole('tab',{name:'Sales reports',exact:true}).click();
  await page.getByRole('tab',{name:'Month',exact:true}).click();await page.getByLabel('Reporting date',{exact:true}).fill('2025-06-15');
  await page.locator('.sd-card').first().waitFor();await page.waitForFunction(()=>document.querySelector('.sd-product'));
  await page.locator('.sd-product').first().click();await page.getByRole('region',{name:'Selected product detail'}).waitFor();await page.locator('.sd-product-detail .sd-chart').waitFor();
  await page.getByRole('button',{name:'Close detail',exact:true}).click();await page.getByRole('button',{name:'Quantity',exact:true}).click();
  await page.locator('.sd-card').filter({hasText:'Transactions'}).click();assert.equal(await page.locator('.sd-card').filter({hasText:'Transactions'}).getAttribute('aria-pressed'),'true');
  await page.getByRole('columnheader',{name:/Product/}).getByRole('button').click();assert.equal(await page.getByRole('columnheader',{name:/Product/}).getAttribute('aria-sort'),'ascending');
  await page.locator('.sd-card').filter({hasText:'Net sales'}).click();
  await page.getByText('Refunds, discounts, taxes & tips',{exact:true}).click();await page.getByText('No reconciled item-level source',{exact:true}).waitFor();await page.getByText('Refunds, discounts, taxes & tips',{exact:true}).click();
  for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844],['narrow',320,740]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:'test-artifacts/screenshots/'+device+'-dashboard.png',fullPage:false,animations:'disabled'});
   if(width<600){await page.locator('.sd-period-note').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:'test-artifacts/screenshots/'+device+'-dashboard-metrics.png',fullPage:false,animations:'disabled'});}
   await page.getByRole('heading',{name:'What people came for',exact:true}).evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:'test-artifacts/screenshots/'+device+'-dashboard-products.png',fullPage:false,animations:'disabled'});}
  await page.getByRole('tab',{name:'Day',exact:true}).click();await page.getByRole('tab',{name:'Day',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Week',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('tab',{name:'Month',exact:true}).click();await page.locator('.sd-product').first().waitFor();await checkCharts(page);
  await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/workspace');
 });
 await check('order workspace starts with real empty state and opens existing Sandbox order details',async()=>{
  await navigateWorkspace(page,'Today');await page.getByRole('heading',{name:'No active paid orders',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Maya L.',exact:true}).count(),0);
  await navigateWorkspace(page,'Orders');await page.getByRole('heading',{name:'No active paid orders',exact:true}).waitFor();
  await page.getByRole('button',{name:'Sandbox',exact:true}).click();
  const open=page.getByRole('region',{name:'Orders workspace',exact:true}).getByRole('button',{name:'Synthetic pickup',exact:true}).first();await open.waitFor();await open.click();
  const details=page.getByRole('dialog',{name:'Synthetic pickup',exact:true});await details.waitFor();
  await details.getByText('Sandbox order',{exact:true}).waitFor();await details.getByText('Payment verified',{exact:true}).waitFor();
  assert.equal(await details.getByRole('button',{name:/Mark Ready|Mark collected/}).count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'test-artifacts/screenshots/mobile-order-details.png',fullPage:true});
  await details.getByRole('button',{name:'Open kitchen',exact:true}).click();
  await page.getByRole('heading',{name:'Batches and paid pickup orders',exact:true}).waitFor();
 });
 await check('order refresh closes details when the order leaves the current filter',async()=>{
  const orders=await request('/api/workspace?scope=sandbox&filter=active',{cookie});assert.equal(orders.status,200);
  const order=orders.data.orders[0];assert.ok(order);assert.equal(Number(order.is_test),1);
  const refreshContext=await browser.newContext({ignoreHTTPSErrors:true,storageState:await context.storageState()});
  try{
   await refreshContext.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());
   const rp=await refreshContext.newPage();await rp.clock.install();await rp.goto(origin+'/workspace?view=orders');
   await rp.getByRole('button',{name:'Sandbox',exact:true}).click();
   const open=rp.getByRole('button',{name:'Open order '+order.id.slice(0,8),exact:true});await open.click();
   await rp.getByRole('dialog',{name:order.contact_name,exact:true}).waitFor();
   await db.execute("UPDATE pickup_orders SET order_status='exception' WHERE id=? AND is_test=1",[order.id]);
   const refreshed=rp.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/workspace'&&url.searchParams.get('scope')==='sandbox'&&url.searchParams.get('filter')==='active'&&response.status()===200});
   await rp.clock.fastForward(31000);
   assert.ok(!(await(await refreshed).json()).orders.some(row=>row.id===order.id));
   await rp.locator('dialog[open]').waitFor({state:'hidden'});
   assert.equal(await open.count(),0);
  }finally{
   await db.execute('UPDATE pickup_orders SET order_status=? WHERE id=? AND is_test=1',[order.order_status,order.id]);
   await refreshContext.close();
  }
 });
 await check('customer history stays scoped and owner notes persist after reload',async()=>{
  await navigateWorkspace(page,'Customers');await page.getByRole('heading',{name:'No real customers yet',exact:true}).waitFor();
  await page.getByRole('button',{name:'Sandbox customers',exact:true}).click();
  await page.getByRole('button',{name:'Synthetic pickup',exact:true}).click();
  let details=page.getByRole('dialog',{name:'Customer details',exact:true});await details.waitFor();
  const note='Synthetic pickup preference for browser verification.';
  await details.getByLabel('Private customer note',{exact:true}).fill(note);
  await details.getByRole('button',{name:'Save customer note',exact:true}).click();await details.getByRole('status').filter({hasText:'Customer note saved.'}).waitFor();
  await details.getByRole('heading',{name:'Order history',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'test-artifacts/screenshots/mobile-customer-details.png',fullPage:true});
  await details.getByRole('button',{name:'Close customer details',exact:true}).click();await page.reload();
  await page.getByRole('button',{name:'Sandbox customers',exact:true}).click();await page.getByRole('button',{name:'Synthetic pickup',exact:true}).click();
  details=page.getByRole('dialog',{name:'Customer details',exact:true});
  await details.getByLabel('Private customer note',{exact:true}).waitFor();assert.equal(await details.getByLabel('Private customer note',{exact:true}).inputValue(),note);
  const list=await request('/api/customers?scope=sandbox',{cookie}),customer=list.data.customers.find(c=>c.email==='pickup@example.test');assert.ok(customer);
  assert.equal((await request('/api/customers?scope=sandbox&key='+customer.key,{cookie})).data.note,note);
  await page.keyboard.press('Escape');await details.waitFor({state:'hidden'});
  assert.ok(await page.getByRole('button',{name:'Synthetic pickup',exact:true}).evaluate(e=>e===document.activeElement));
 });

 await check('browser edits staging website settings and sees them on the public homepage',async()=>{
  await page.goto(origin+'/workspace?view=content');await page.getByLabel('Opening hours',{exact:true}).fill('Synthetic test hours only');
  const heading=page.getByLabel('Story heading',{exact:true}),beforeHeading=await heading.inputValue();
  await heading.fill('Synthetic story heading.\nSynthetic coast.');
  await page.getByRole('button',{name:'Publish to staging',exact:true}).click();await page.getByRole('status').filter({hasText:'Website details saved'}).waitFor();
  await page.goto(origin+'/');await page.getByText('Synthetic test hours only',{exact:true}).waitFor();
  assert.match(await page.locator('.story-card h2').innerText(),/Synthetic story heading\.\s*Synthetic coast\./);
  await page.goto(origin+'/workspace?view=content');await page.getByLabel('Story heading',{exact:true}).fill(beforeHeading);
  await page.getByRole('button',{name:'Publish to staging',exact:true}).click();await page.getByRole('status').filter({hasText:'Website details saved'}).waitFor();
  await page.goto(origin+'/');await page.getByText('Synthetic test hours only',{exact:true}).waitFor();
  assert.match(await page.locator('.story-card h2').innerText(),/Andean roots\.\s*West Coast life\./);
  assert.equal(await page.locator('.menu-card h3').first().textContent(),'Synthetic browser edit');
  assert.equal(await page.getByRole('link',{name:'Workspace',exact:true}).count(),1);
  await page.getByRole('link',{name:'Workspace',exact:true}).click();await page.waitForURL('**/workspace');
 });
 await check('second owner uses the same login and grouped sidebar navigation',async()=>{
  const ownerContext=await browser.newContext({ignoreHTTPSErrors:true});await ownerContext.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());const op=await ownerContext.newPage();
  await op.goto(origin+'/sign-in');await op.getByLabel('Email',{exact:true}).fill('owner-two@example.test');await op.getByLabel('Password',{exact:true}).fill(password);await op.getByRole('button',{name:'Sign in',exact:true}).click();await op.waitForURL('**/workspace');
  const nav=op.getByRole('navigation',{name:'Puna workspace',exact:true});
  for(const name of ['Today','Orders','Customers','Menu & Products','Kitchen','Website','Team & settings'])await nav.getByRole('button',{name,exact:true}).waitFor();
  assert.equal(await op.getByRole('region',{name:'Puna orbital navigation'}).count(),0);
  await navigateWorkspace(op,'Team & settings');await op.getByRole('heading',{name:'Team access',exact:true}).waitFor();
  await op.getByRole('button',{name:'Sign out',exact:true}).click();await op.waitForURL('**/sign-in');await ownerContext.close();
 });
 await check('browser food-truck login is restricted and legacy test orders never enter paid queue',async()=>{
  const worker=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
  await worker.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());
  const wp=await worker.newPage();await wp.goto(origin+'/sign-in');await wp.getByLabel('Email',{exact:true}).fill('staff@example.test');await wp.getByLabel('Password',{exact:true}).fill(password);await wp.getByRole('button',{name:'Sign in',exact:true}).click();await wp.waitForURL('**/food-truck');
  assert.equal(await wp.getByRole('button',{name:'Website',exact:true}).count(),0);assert.equal(await wp.getByRole('link',{name:'Owner dashboard',exact:true}).count(),0);
  await wp.getByRole('heading',{name:'Truck preparation & pickup',exact:true}).waitFor();assert.equal(await wp.getByText('Synthetic pickup',{exact:true}).count(),0);assert.equal(await wp.getByRole('button',{name:'Mark Ready',exact:true}).count(),0);
  await wp.goto(origin+'/workspace?view=staff');await wp.waitForURL('**/food-truck');
  mkdirSync('test-artifacts/screenshots',{recursive:true});
  for(const [device,width,height] of [['desktop',1440,1000],['laptop',1280,900],['tablet',768,1024],['mobile',390,844]]){await wp.setViewportSize({width,height});assert.ok(await wp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await wp.screenshot({path:'test-artifacts/screenshots/'+device+'-worker.png',fullPage:true})}
  await wp.getByRole('button',{name:'Sign out',exact:true}).click();await wp.waitForURL('**/sign-in');await wp.goto(origin+'/food-truck');await wp.waitForURL('**/sign-in');assert.equal((await request('/api/truck',{cookie:staffCookie})).status,200);
  await worker.close();
 });
 await check('customer bag persists without placing unpaid orders',async()=>{const beforeOrders=await count('pickup_orders');
  const before=await count('test_orders');await page.goto(origin+'/');await page.getByRole('button',{name:'Add Synthetic browser edit to bag',exact:true}).click();await page.goto(origin+'/cart');await page.getByRole('heading',{name:'Your bag',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Synthetic browser edit',exact:true}).waitFor();assert.equal(await count('test_orders'),before);assert.equal(await count('pickup_orders'),beforeOrders);assert.equal(await page.getByRole('button',{name:'Place test order',exact:true}).count(),0);
 });
 await check('staging metadata, genuine branded 404 and sitemap protect private routes',async()=>{
  const missing=await request('/this-page-does-not-exist');assert.equal(missing.status,404);assert.match(missing.data,/back to PUNA/);assert.equal(missing.headers['x-robots-tag'],'noindex, nofollow');
  const home=await request('/');assert.match(home.data,/og:image/);assert.match(home.data,/puna-social.jpg/);assert.match(home.data,/noindex, nofollow/);
  const map=await request('/sitemap.xml');assert.equal(map.status,200);assert.doesNotMatch(map.data,/<loc>/);
  const robots=await request('/robots.txt');assert.equal(robots.status,200);assert.match(robots.data,/Disallow: \/receipt/);assert.doesNotMatch(robots.data,/Sitemap:/);
  assert.equal((await request('/privacy')).status,404);assert.equal((await request('/social/puna-social.jpg')).status,200);
  assert.notEqual((await request('/cart')).data.match(/<title>(.*?)<\/title>/)?.[1],home.data.match(/<title>(.*?)<\/title>/)?.[1]);
 });
 await check('public design, artwork and navigation render on desktop and mobile with synthetic catalogue',async()=>{
  // Synthetic records only; render five customer menu items and keep three frozen products internal.
  await db.execute("UPDATE products SET price_cents=800 WHERE id='synthetic-product'");
  for(let i=1;i<=7;i++)await db.execute('INSERT INTO products(id,name,description,price_cents,kind,available) VALUES(?,?,?,?,?,?)',['fixture-'+i,'Synthetic menu '+i,i===1?'Disposable long filling description with roasted vegetables, slowly cooked onions, herbs, potatoes, peppers and a detailed ingredient note. This longer synthetic text checks that mobile prices and pickup controls never overlap ingredients.':'Disposable test description. No customer data.',i<=4?800:2500,i<=4?'fresh':'frozen',i<=4?1:0]);
  const publicContext=await browser.newContext({ignoreHTTPSErrors:true});await publicContext.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());const pp=await publicContext.newPage();
  for(const [device,width,height] of [['desktop',1440,1000],['laptop',1280,900],['tablet',768,1024],['mobile',390,844],['narrow',320,740]]){
   await pp.setViewportSize({width,height});await pp.goto(origin+'/');await pp.getByText('Synthetic test hours only',{exact:true}).waitFor();
   const logo=pp.locator('.hero-visual img');await logo.evaluate(im=>im.decode());assert.ok(await logo.evaluate(im=>im.naturalWidth>0&&im.naturalHeight>0));
   assert.equal(await pp.locator('.product,.extra').count(),5);assert.equal(await pp.locator('#frozen').count(),0);assert.equal(await pp.getByText('Factory',{exact:true}).count(),0);
   assert.equal(await pp.locator('.customer').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(21, 19, 15)');
   const copy=await pp.locator('.hero-copy').boundingBox(),art=await pp.locator('.hero-visual').boundingBox();assert.ok(width>700?art.x>copy.x+copy.width-2:art.y>=copy.y+copy.height-2);
   assert.ok(await pp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await pp.emulateMedia({reducedMotion:'reduce'});await pp.getByRole('link',{name:'Skip to content',exact:true}).focus();assert.equal(await pp.getByRole('link',{name:'Skip to content',exact:true}).evaluate(e=>getComputedStyle(e).outlineStyle),'solid');assert.equal(await pp.locator('.product').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');await pp.locator('h1').click();
   for(const im of await pp.locator('main img').all()){const src=await im.getAttribute('src');assert.doesNotMatch(src,/18015083942193300|IG.?0016/);if(await im.isVisible()){await im.scrollIntoViewIfNeeded();await im.evaluate(e=>e.decode());assert.ok(await im.evaluate(e=>e.naturalWidth>0));}else{const asset=await pp.request.get(new URL(src,origin).toString());assert.equal(asset.status(),200);assert.match(asset.headers()['content-type'],/image/);}}await pp.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await pp.screenshot({path:'test-artifacts/screenshots/'+device+'-public-home.png',fullPage:true});
   await pp.screenshot({path:'test-artifacts/screenshots/'+device+'-public-hero.png',fullPage:false});
   const cta=await pp.locator('.hero-actions .btn').first().boundingBox();assert.ok(cta.y+cta.height<=height,'Hero CTA above fold');
   await pp.locator('.truck-location').scrollIntoViewIfNeeded();await pp.screenshot({path:'test-artifacts/screenshots/'+device+'-footer.png',fullPage:false});
   assert.ok(await pp.locator('.truck-location').evaluate(e=>parseFloat(getComputedStyle(e).paddingTop)>=48));
   await pp.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   for(const [name,hash] of [['The menu','#menu'],['Our story','#story'],['Pickup','#pickup']]){await pp.getByRole('link',{name:width<=700&&name==='Our story'?'Meet Puna ↗':name,exact:true}).click();assert.equal(new URL(pp.url()).hash,hash)}
   await pp.getByRole('button',{name:'Add Synthetic browser edit to bag',exact:true}).click();await pp.getByRole('button',{name:/Open bag/}).click();await pp.getByRole('dialog',{name:'Your bag'}).waitFor();assert.equal(await pp.getByRole('button',{name:'Place test order',exact:true}).count(),0);await pp.getByRole('button',{name:'Close cart',exact:true}).click();
  }
  await publicContext.close();
 });
 await check('sidebar navigation and browser history preserve an unsaved website edit',async()=>{
  await page.goto(origin+'/workspace?view=content');
  const input=page.getByLabel('Homepage introduction',{exact:true});await input.waitFor();const before=await input.inputValue();
  await input.fill('Synthetic unsaved sidebar change');
  await navigateWorkspace(page,'Today');await input.waitFor({state:'hidden'});
  await navigateWorkspace(page,'Website');assert.equal(await input.inputValue(),'Synthetic unsaved sidebar change');
  await page.goBack();await input.waitFor({state:'hidden'});
  await page.goForward();await input.waitFor();assert.equal(await input.inputValue(),'Synthetic unsaved sidebar change');
  await input.fill(before);
  assert.equal((await request('/api/puna')).data.settings.intro,before);
 });
 await check('capture synthetic desktop, laptop, tablet and mobile review screenshots',async()=>{
  mkdirSync('test-artifacts/screenshots',{recursive:true});
  for(const [device,width,height] of [['desktop',1440,1000],['laptop',1024,900],['tablet',768,1024],['mobile',390,844]]){
   await page.setViewportSize({width,height});
   await navigateWorkspace(page,'Today');
   await page.getByRole('link',{name:'Puna website',exact:true}).locator('img').evaluate(im=>im.decode());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:'test-artifacts/screenshots/'+device+'-home.png',fullPage:true});
   await navigateWorkspace(page,'Menu & Products');await page.getByRole('button',{name:'Edit Synthetic browser edit',exact:true}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:'test-artifacts/screenshots/'+device+'-products.png',fullPage:true});
   const editor=await openMenuItem(page,'Synthetic browser edit');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await editor.screenshot({path:'test-artifacts/screenshots/'+device+'-edit.png',animations:'disabled'});
   await editor.getByRole('button',{name:'Close menu item',exact:true}).click();
  }
  writeFileSync('test-artifacts/screenshots/commit.txt',(process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()+' (local working tree)')+'\n');
 });

 await check('owner import screen previews, imports drafts and refreshes both editors',async()=>{
  await page.goto(origin+'/workspace?view=edit');
  await page.getByText('Import source-tracked catalogue',{exact:true}).click();
  const box=page.getByLabel('Reviewed catalogue package',{exact:true});
  await box.fill('not valid JSON');await page.getByRole('button',{name:'Review import',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'not valid JSON'}).waitFor();
  const row={id:'zzz-browser-source',canonicalId:'synthetic:browser-source',sourceKey:'synthetic:browser-source',sourceReference:'https://example.test/catalogue#historical-prices-through-2026-09-16',sourceHash:'a'.repeat(64),name:'ZZZ Synthetic source import',description:'Synthetic imported description only.',priceCents:800,kind:'fresh',category:'empanada',priceConfirmed:true};
  const payload=JSON.stringify({action:'import-products',rows:[row]});
  await box.fill(payload);await page.getByRole('button',{name:'Review import',exact:true}).click();
  await page.getByRole('heading',{name:'Review 1 catalogue records',exact:true}).waitFor();
  for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){await page.setViewportSize({width,height});await page.getByRole('region',{name:'Source-tracked catalogue import',exact:true}).screenshot({path:'test-artifacts/screenshots/'+device+'-source-import.png'});}
  assert.equal(Number((await db.execute("SELECT COUNT(*) n FROM products WHERE id=?",[row.id]))[0][0].n),0);
  await page.getByRole('button',{name:'Import reviewed records as drafts',exact:true}).click();
  await page.getByRole('status').filter({hasText:'1 inserted, 0 updated, 0 unchanged'}).waitFor();
  const [saved]=await db.execute('SELECT p.available,p.price_cents,p.source_status,m.* FROM products p JOIN commerce_products m ON m.product_id=p.id WHERE p.id=?',[row.id]);
  assert.equal(saved[0].publication,'draft');assert.equal(saved[0].price_confirmed,1);assert.equal(saved[0].ingredients_confirmed,0);assert.equal(saved[0].available,0);assert.equal(saved[0].source_status,'initial');assert.equal(saved[0].tax_rules,null);assert.equal(saved[0].deposit_cents,null);assert.equal(saved[0].packing_seconds,null);
  assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM inventory_balances WHERE product_id=?',[row.id]))[0][0].n),0);
  await page.getByRole('button',{name:'Edit '+row.name,exact:true}).waitFor();
  await page.getByText('Advanced checkout settings',{exact:true}).click();
  await page.getByText(row.name+' · draft',{exact:true}).waitFor();
  assert.ok(!(await request('/api/puna')).data.products.some(p=>p.id===row.id));
  await page.getByRole('button',{name:'Review import',exact:true}).click();await page.getByRole('button',{name:'Import reviewed records as drafts',exact:true}).click();
  await page.getByRole('status').filter({hasText:'0 inserted, 0 updated, 1 unchanged'}).waitFor();
  assert.equal(Number((await db.execute("SELECT COUNT(*) n FROM audit_log WHERE entity_id=? AND action='source:import'",[row.id]))[0][0].n),1);
 });
 await check('imported product publishes separately and owner description edits remain protected',async()=>{
  const name='ZZZ Synthetic source import',id='zzz-browser-source';
  const summary=page.locator('summary').filter({hasText:name});await summary.click();
  const panel=summary.locator('..');
  await panel.getByLabel('Visibility').selectOption('staging');
  await panel.getByRole('button',{name:'Save checkout settings',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Checkout settings saved'}).waitFor();
  assert.ok((await request('/api/puna')).data.products.some(p=>p.id===id&&p.price===800&&!p.available));
  const group=await openMenuItem(page,name);
  await group.getByLabel('Description',{exact:true}).fill('Synthetic owner edit retained.');
  await group.getByLabel('Ingredients & filling',{exact:true}).fill('Synthetic ingredients');await group.getByLabel('I confirm the price, ingredients, photo and schedule are accurate',{exact:true}).check();await group.getByRole('button',{name:'Publish to menu',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Published to the menu'}).waitFor();
  await group.getByRole('button',{name:'Close menu item',exact:true}).click();
  const row={id,canonicalId:'synthetic:browser-source',sourceKey:'synthetic:browser-source',sourceReference:'https://example.test/catalogue',sourceHash:'b'.repeat(64),name,description:'Conflicting replacement',priceCents:800,kind:'fresh',category:'empanada',priceConfirmed:true};
  await page.getByLabel('Reviewed catalogue package',{exact:true}).fill(JSON.stringify({action:'import-products',rows:[row]}));await page.getByRole('button',{name:'Review import',exact:true}).click();await page.getByRole('button',{name:'Import reviewed records as drafts',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'OWNER_EDIT_CONFLICT'}).waitFor();
  assert.equal((await db.execute('SELECT description FROM products WHERE id=?',[id]))[0][0].description,'Synthetic owner edit retained.');
  assert.equal(Number((await db.execute("SELECT COUNT(*) n FROM audit_log WHERE entity_id=? AND action='source:import'",[id]))[0][0].n),1);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 });

 await check('browser workspace home and logout work',async()=>{
  await navigateWorkspace(page,'Today');await page.getByRole('link',{name:'Puna website',exact:true}).waitFor();
  if(!await page.getByRole('button',{name:'Sign out',exact:true}).isVisible())await page.getByRole('button',{name:'Open workspace menu',exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/sign-in');
  await page.goto(origin+'/workspace');await page.waitForURL('**/sign-in');
 });
 await context.close();
 if(process.env.PUNA_PHASE_C_TESTS==='true'){
  await check('feature-off kitchen requires no new schema and keeps public preview absent',async()=>{assert.equal((await request('/api/kitchen',{cookie})).status,404);assert.equal((await request('/api/kitchen/availability')).data.enabled,false);assert.equal((await request('/api/puna')).data.kitchenPreview,false);});
  const baselineContext=await browser.newContext({ignoreHTTPSErrors:true,reducedMotion:'reduce'}),baselinePage=await baselineContext.newPage();
  await baselineContext.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());
  for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){await baselinePage.setViewportSize({width,height});await baselinePage.goto(origin+'/');await baselinePage.getByText('Synthetic test hours only',{exact:true}).waitFor();await baselinePage.locator('.hero-visual img').evaluate(im=>im.decode());await baselinePage.locator('#menu').screenshot({path:'test-artifacts/screenshots/unified-menu-before-'+device+'.png',animations:'disabled'});for(const [name,selector] of [['hero','.hero'],['story','.story-full']]){const section=baselinePage.locator(selector);await captureApprovedSection(section,'test-artifacts/screenshots/inventory-baseline-'+device+'-'+name+'.png');}}
  await baselineContext.close();
  execFileSync(process.execPath,['tests/apply-kitchen-schema.mjs'],{stdio:'inherit'});
  execFileSync(process.execPath,['tests/apply-service-schema.mjs'],{stdio:'inherit'});
  await check('numbered kitchen migration rerun preserves the initial state',async()=>{const before=(await db.query('SELECT * FROM kitchen_state'))[0];execFileSync(process.execPath,['tests/apply-kitchen-schema.mjs'],{stdio:'inherit'});assert.deepEqual((await db.query('SELECT * FROM kitchen_state'))[0],before);});
  const restart=async(enabled)=>{app.kill('SIGTERM');await new Promise(r=>app.once('exit',r));app=spawn(process.execPath,appArgs,{env:{...process.env,...appAddress,PUNA_CHECKOUT_MODE:'disabled',PUNA_LIVE_KITCHEN_ENABLED:String(enabled),PUNA_KITCHEN_PUBLIC_PREVIEW:String(enabled),PUNA_KITCHEN_FIXTURES:String(enabled),BOOTSTRAP_TOKEN:'',STAGING_TEST_ORDERS_ENABLED:'false',NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});app.stdout.on('data',d=>process.stdout.write(d));app.stderr.on('data',d=>process.stderr.write(d));let ready=false;for(let n=0;n<60;n++){try{if((await request('/api/kitchen/availability')).data.enabled===enabled){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);};
  await restart(true);
  await runKitchenChecks({db,request,check,cookie,staffCookie});
  await runKitchenBrowser({browser,origin,db,request,check,password});
  const before=(await db.query('SELECT COUNT(*) n FROM kitchen_lots'))[0][0].n;
  await restart(false);
  await check('feature-off rollback preserves kitchen commitments and legacy access without destructive rollback',async()=>{assert.equal((await request('/api/kitchen',{cookie})).status,404);assert.equal((await request('/api/kitchen/availability')).data.enabled,false);assert.equal((await request('/api/operations',{cookie:staffCookie})).status,200);assert.equal((await request('/api/checkout')).data.mode,'disabled');assert.equal((await db.query('SELECT COUNT(*) n FROM kitchen_lots'))[0][0].n,before);assert.equal((await db.query("SELECT COUNT(*) n FROM kitchen_allocations WHERE state='paid'"))[0][0].n,1);});
 }
 if(process.env.PUNA_PHASE_D_TESTS==='true'){
  execFileSync(process.execPath,['tests/apply-ordering-schema.mjs'],{stdio:'inherit'});
  const restart=async(intake,service=true)=>{app.kill('SIGTERM');await new Promise(r=>app.once('exit',r));app=spawn(process.execPath,appArgs,{env:{...process.env,...appAddress,PUNA_CHECKOUT_MODE:'disabled',PUNA_LIVE_KITCHEN_ENABLED:'true',PUNA_KITCHEN_PUBLIC_PREVIEW:'true',PUNA_KITCHEN_FIXTURES:'false',PUNA_ORDERING_LOCAL_ENABLED:String(service),PUNA_ORDERING_ACCEPT_NEW:String(intake),BOOTSTRAP_TOKEN:'',STAGING_TEST_ORDERS_ENABLED:'false',NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});app.stdout.on('data',d=>process.stdout.write(d));app.stderr.on('data',d=>process.stderr.write(d));let ready=false;for(let n=0;n<60;n++){try{if((await request('/api/checkout')).data.mode===(service?'local-simulated':'disabled')){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);};
  await restart(true);
  const helpers=await runOrderingChecks({db,request,check,cookie,staffCookie,restart});
  await runOrderingBrowser({browser,origin,db,check,password,helpers});
  await runMenuStudioChecks({db,request,check,cookie,staffCookie,browser,origin,password,ownerEmail:owner.email,helpers,restart});
  await restart(false,false);
  await check('D1 feature-off retains schema and original checkout while local fixtures refuse all actions',async()=>{assert.equal((await request('/api/checkout')).data.mode,'disabled');assert.equal((await request('/api/pickup',{cookie:staffCookie})).status,404);assert.equal((await request('/api/local-fixtures',{method:'POST',body:{action:'run-jobs'},extraHeaders:{'x-local-fixture-key':process.env.PUNA_D1_FIXTURE_SECRET}})).status,404);assert.equal((await request('/api/operations',{cookie:staffCookie})).status,200);});
 }
 if(process.env.PUNA_PHASE_C_TESTS==='true'){
  const restart=async(enabled)=>{app.kill('SIGTERM');await new Promise(r=>app.once('exit',r));app=spawn(process.execPath,appArgs,{env:{...process.env,...appAddress,PUNA_CHECKOUT_MODE:'disabled',PUNA_LIVE_KITCHEN_ENABLED:'true',PUNA_SQUARE_POS_ENABLED:String(enabled),PUNA_SQUARE_POS_WEBHOOK_URL:origin+'/api/square/pos-webhook',PUNA_SQUARE_POS_WEBHOOK_KEY:'synthetic-pos-key',PUNA_SQUARE_POS_LOCATION_ID:'synthetic-location',PUNA_SQUARE_POS_CUTOVER_AT:'2026-11-01T00:00:00Z',BOOTSTRAP_TOKEN:'',STAGING_TEST_ORDERS_ENABLED:'false',NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});app.stdout.on('data',d=>process.stdout.write(d));app.stderr.on('data',d=>process.stderr.write(d));let ready=false;for(let n=0;n<60;n++){try{if((await request('/api/auth')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);};
  await runPosChecks({db,request,check,cookie,restart});
 }
 await check('isolated synthetic restore preserves counts, definitions, indexes and foreign keys',async()=>{console.log('Synthetic recovery evidence '+JSON.stringify(await verifySyntheticRecovery()))});
 await check('approved hero and Story screenshots remain unchanged',async()=>assert.deepEqual(visualMismatches,[]));
 console.log('RESULT '+passed+' integration checks passed; synthetic data only; no deployment; private hosted-data restore was not exercised.');
}finally{
 if(browser)await browser.close();
 if(proxy)await new Promise(resolve=>proxy.close(resolve));
 if(app){app.kill('SIGTERM');await new Promise(resolve=>{app.once('exit',resolve);setTimeout(()=>{app.kill('SIGKILL');resolve()},3000).unref()})}
 await db.end();
 rmSync(certDirectory,{recursive:true,force:true});
}

