import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,randomUUID,scryptSync,createHash} from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import mysql from 'mysql2/promise';
import {chromium} from 'playwright';
import {runCommerceChecks} from './commerce-integration.mjs';

assert.equal(process.env.GITHUB_ACTIONS,'true','Synthetic integration suite is CI-only');
assert.equal(process.env.DB_HOST,'127.0.0.1');
assert.equal(process.env.DB_NAME,'puna_ci_synthetic');
assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
const db=await mysql.createConnection({host:'127.0.0.1',port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,multipleStatements:true});
for(const [file,expected] of Object.entries(JSON.parse(readFileSync('tests/preserved-assets.json','utf8'))))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),expected,'Preserved public asset '+file);
const origin='https://localhost:3443';
const appArgs=['--import', './tests/provider-fixture.mjs',...(process.env.PUNA_TEST_STANDALONE==='true'?['.next/standalone/server.js']:['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'])];
const appAddress={HOSTNAME:'127.0.0.1',PORT:'3100',PUNA_CHECKOUT_MODE:'square-sandbox',SQUARE_SANDBOX_ACCESS_TOKEN:'synthetic-not-a-provider-secret',SQUARE_SANDBOX_LOCATION_ID:'synthetic-location',SQUARE_SANDBOX_APPLICATION_ID:'synthetic-application',SQUARE_WEBHOOK_SIGNATURE_KEY:'synthetic-webhook-only',SQUARE_WEBHOOK_URL:'https://127.0.0.1:3443/api/square/webhook',PUNA_JOB_TOKEN:'synthetic-ci-job-token-never-use-on-hosting'};
let app,proxy,browser;let passed=0;
const check=async(name,fn)=>{try{await fn();passed++;console.log('PASS '+name)}catch(error){
 console.log('FAIL '+name);if(browser){mkdirSync('test-artifacts/screenshots',{recursive:true});let n=0;for(const c of browser.contexts())for(const p of c.pages()){console.log('Browser diagnostic '+JSON.stringify({path:new URL(p.url()).pathname+new URL(p.url()).search,headings:await p.getByRole('heading').allTextContents(),labelCount:await p.locator('label').count(),alerts:await p.getByRole('alert').allTextContents(),statuses:await p.getByRole('status').allTextContents()}));await p.screenshot({path:'test-artifacts/screenshots/failure-'+(++n)+'.png',fullPage:true})}}throw error}};
function request(path,{method='GET',body,cookie,originHeader=origin}={}){
 return new Promise((resolve,reject)=>{
  const headers={};if(cookie)headers.cookie=cookie;if(originHeader!==null)headers.origin=originHeader;
  const payload=body===undefined?undefined:JSON.stringify(body);
  if(payload){headers['content-type']='application/json';headers['content-length']=Buffer.byteLength(payload)}
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
 for(const file of ['001_initial.sql','003_auth_rate_limits.sql','004_product_versions.sql','005_unified_staging.sql','006_commerce.sql'])await db.query(readFileSync('db/'+file,'utf8'));
 await db.execute("INSERT INTO products(id,name,description,price_cents,kind) VALUES(?,?,?,?,?)",['synthetic-product','Synthetic product','Disposable integration fixture',1234,'fresh']);
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout','/tmp/puna-ci-key.pem','-out','/tmp/puna-ci-cert.pem','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],{stdio:'ignore'});
 app=spawn(process.execPath,appArgs,{env:{...process.env,...appAddress,BOOTSTRAP_TOKEN:token,STAGING_TEST_ORDERS_ENABLED:'false',NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
 // Only application diagnostics, never request bodies, session tokens or database rows.
 app.stdout.on('data',d=>process.stdout.write(d));app.stderr.on('data',d=>process.stderr.write(d));
 proxy=https.createServer({key:readFileSync('/tmp/puna-ci-key.pem'),cert:readFileSync('/tmp/puna-ci-cert.pem')},(req,res)=>{
  const upstream=http.request({host:'127.0.0.1',port:3100,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:3443','x-forwarded-proto':'https'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});
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
 browser=await chromium.launch();
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='localhost'?route.continue():route.abort()});
 const page=await context.newPage();page.on('pageerror',e=>console.log('Browser error: '+e.message));
 await check('browser login and explicit product edit persist after refresh',async()=>{
  await page.goto(origin+'/sign-in');await page.getByLabel('Email',{exact:true}).fill(owner.email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/workspace');
  const logo=page.getByRole('img',{name:'Puna official logo'});await logo.waitFor();assert.ok(await logo.evaluate(im=>im.complete&&im.naturalWidth>0));
  await page.getByRole('button',{name:'Website',exact:true}).click();await page.getByRole('button',{name:'Products',exact:true}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).first().fill('Synthetic browser edit');
  assert.notEqual((await product()).name,'Synthetic browser edit');
  await page.getByRole('button',{name:'Save product',exact:true}).first().click();await page.getByRole('status').waitFor();await page.reload();await page.getByLabel('Name',{exact:true}).first().waitFor();
  assert.equal(await page.getByLabel('Name',{exact:true}).first().inputValue(),'Synthetic browser edit');assert.equal((await product()).source_status,'initial');
  await page.getByLabel('I confirm these product details',{exact:true}).first().check();await page.getByRole('button',{name:'Save product',exact:true}).first().click();await page.getByRole('status').waitFor();assert.equal((await product()).source_status,'confirmed');
 });
 await check('mobile editor remains usable without horizontal overflow',async()=>{
  await page.setViewportSize({width:390,height:844});await page.reload();await page.getByRole('button',{name:'Save product',exact:true}).first().waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.ok(await page.getByLabel('Name',{exact:true}).first().isVisible());
 });

 await check('browser edits staging website settings and sees them on the public homepage',async()=>{
  await page.goto(origin+'/workspace?view=content');await page.getByLabel('Opening hours',{exact:true}).fill('Synthetic test hours only');
  await page.getByRole('button',{name:'Publish to staging',exact:true}).click();await page.getByRole('status').waitFor();
  await page.goto(origin+'/');await page.getByText('Synthetic test hours only',{exact:true}).waitFor();
  assert.equal(await page.locator('.menu-card h3').first().textContent(),'Synthetic browser edit');
  assert.equal(await page.getByRole('link',{name:'Workspace',exact:true}).count(),1);
  await page.getByRole('link',{name:'Workspace',exact:true}).click();await page.waitForURL('**/workspace');
 });
 await check('second owner uses the same login and full orbital navigation',async()=>{
  const ownerContext=await browser.newContext({ignoreHTTPSErrors:true});await ownerContext.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());const op=await ownerContext.newPage();
  await op.goto(origin+'/sign-in');await op.getByLabel('Email',{exact:true}).fill('owner-two@example.test');await op.getByLabel('Password',{exact:true}).fill(password);await op.getByRole('button',{name:'Sign in',exact:true}).click();await op.waitForURL('**/workspace');
  for(const name of ['Sales','Orders','Production','Inventory','Financials','Marketing','Website','Food Truck','Staff'])await op.getByRole('button',{name,exact:true}).waitFor();
  await op.getByRole('button',{name:'Staff',exact:true}).click();await op.getByRole('heading',{name:'Team access',exact:true}).waitFor();
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
 await check('customer bag persists without placing unpaid orders',async()=>{
  const before=await count('test_orders');await page.goto(origin+'/');await page.getByRole('button',{name:'Add Synthetic browser edit to bag',exact:true}).click();await page.goto(origin+'/cart');await page.getByRole('heading',{name:'Your bag',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Synthetic browser edit',exact:true}).waitFor();assert.equal(await count('test_orders'),before);assert.equal(await count('pickup_orders'),0);assert.equal(await page.getByRole('button',{name:'Place test order',exact:true}).count(),0);
 });
 await check('public design, artwork and navigation render on desktop and mobile with synthetic catalogue',async()=>{
  // Synthetic records only; match the preserved layout's five fresh and three frozen cards.
  for(let i=1;i<=7;i++)await db.execute('INSERT INTO products(id,name,description,price_cents,kind,available) VALUES(?,?,?,?,?,?)',['fixture-'+i,'Synthetic menu '+i,'Disposable test description. No customer data.',i<=4?800:2500,i<=4?'fresh':'frozen',i<=4?1:0]);
  const publicContext=await browser.newContext({ignoreHTTPSErrors:true});await publicContext.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());const pp=await publicContext.newPage();
  for(const [device,width,height] of [['desktop',1440,1000],['laptop',1280,900],['tablet',768,1024],['mobile',390,844]]){
   await pp.setViewportSize({width,height});await pp.goto(origin+'/');await pp.getByText('Synthetic test hours only',{exact:true}).waitFor();
   const logo=pp.locator('.hero-visual img');await logo.evaluate(im=>im.decode());assert.ok(await logo.evaluate(im=>im.naturalWidth>0&&im.naturalHeight>0));
   assert.equal(await pp.locator('.product,.extra').count(),5);assert.equal(await pp.locator('#frozen').count(),0);assert.equal(await pp.getByText('Factory',{exact:true}).count(),0);
   assert.equal(await pp.locator('.customer').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(21, 19, 15)');
   const copy=await pp.locator('.hero-copy').boundingBox(),art=await pp.locator('.hero-visual').boundingBox();assert.ok(device==='desktop'?art.x>copy.x+copy.width-2:art.y>=copy.y+copy.height-2);
   assert.ok(await pp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await pp.screenshot({path:'test-artifacts/screenshots/'+device+'-public-home.png',fullPage:true});
   await pp.screenshot({path:'test-artifacts/screenshots/'+device+'-public-hero.png',fullPage:false});
   for(const [name,hash] of [['The menu','#menu'],['Our story','#story'],['Pickup','#pickup']]){await pp.getByRole('link',{name,exact:true}).click();assert.equal(new URL(pp.url()).hash,hash)}
   await pp.getByRole('button',{name:'Add Synthetic browser edit to bag',exact:true}).click();await pp.getByRole('button',{name:/Open bag/}).click();await pp.getByRole('dialog',{name:'Your bag'}).waitFor();assert.equal(await pp.getByRole('button',{name:'Place test order',exact:true}).count(),0);await pp.getByRole('button',{name:'Close cart',exact:true}).click();
  }
  await publicContext.close();
 });
 await page.goto(origin+'/workspace?view=edit');await page.getByLabel('Name',{exact:true}).first().waitFor();
 await check('capture six synthetic desktop/mobile review screenshots',async()=>{
  mkdirSync('test-artifacts/screenshots',{recursive:true});
  for(const [device,width,height] of [['desktop',1440,1000],['laptop',1280,900],['tablet',768,1024],['mobile',390,844]]){
   await page.setViewportSize({width,height});
   await page.getByRole('button',{name:'Puna Home',exact:true}).click();
   await page.getByRole('img',{name:'Puna official logo'}).evaluate(im=>im.decode());
   await page.screenshot({path:'test-artifacts/screenshots/'+device+'-home.png',fullPage:true});
   await page.getByRole('button',{name:'Website',exact:true}).click();
   await page.getByRole('button',{name:'Products',exact:true}).click();
   await page.screenshot({path:'test-artifacts/screenshots/'+device+'-products.png',fullPage:true});
   await page.getByRole('button',{name:'Edit',exact:true}).click();
   await page.getByLabel('Name',{exact:true}).first().waitFor();
   await page.locator('article.panel').first().evaluate(el=>el.scrollIntoView({behavior:'instant',block:'start'}));
   await page.locator('article.panel').first().screenshot({path:'test-artifacts/screenshots/'+device+'-edit.png',animations:'disabled'});
  }
  writeFileSync('test-artifacts/screenshots/commit.txt',process.env.GITHUB_SHA+'\n');
 });
 await check('browser orbital home and logout work',async()=>{
  await page.getByRole('button',{name:'Puna Home',exact:true}).click();await page.getByRole('img',{name:'Puna official logo'}).waitFor();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/sign-in');
  await page.goto(origin+'/workspace');await page.waitForURL('**/sign-in');
 });
 await context.close();
 console.log('RESULT '+passed+' integration checks passed; synthetic data only; no deployment or backup restore.');
}finally{
 if(browser)await browser.close();
 if(proxy)await new Promise(resolve=>proxy.close(resolve));
 if(app){app.kill('SIGTERM');await new Promise(resolve=>{app.once('exit',resolve);setTimeout(()=>{app.kill('SIGKILL');resolve()},3000).unref()})}
 await db.end();
}

