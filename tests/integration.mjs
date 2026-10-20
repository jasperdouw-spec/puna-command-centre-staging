import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,scryptSync,createHash} from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import mysql from 'mysql2/promise';
import {chromium} from 'playwright';

assert.equal(process.env.GITHUB_ACTIONS,'true','Synthetic integration suite is CI-only');
assert.equal(process.env.DB_HOST,'127.0.0.1');
assert.equal(process.env.DB_NAME,'puna_ci_synthetic');
assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
const db=await mysql.createConnection({host:'127.0.0.1',port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,multipleStatements:true});
const origin='https://localhost:3443';
let app,proxy,browser;let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)};
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
 for(const file of ['001_initial.sql','003_auth_rate_limits.sql','004_product_versions.sql'])await db.query(readFileSync('db/'+file,'utf8'));
 await db.execute("INSERT INTO products(id,name,description,price_cents,kind) VALUES(?,?,?,?,?)",['synthetic-product','Synthetic product','Disposable integration fixture',1234,'fresh']);
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout','/tmp/puna-ci-key.pem','-out','/tmp/puna-ci-cert.pem','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],{stdio:'ignore'});
 app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{env:{...process.env,BOOTSTRAP_TOKEN:token,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
 // Only application diagnostics, never request bodies, session tokens or database rows.
 app.stdout.on('data',d=>process.stdout.write(d));app.stderr.on('data',d=>process.stderr.write(d));
 proxy=https.createServer({key:readFileSync('/tmp/puna-ci-key.pem'),cert:readFileSync('/tmp/puna-ci-cert.pem')},(req,res)=>{
  const upstream=http.request({host:'127.0.0.1',port:3100,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:3443','x-forwarded-proto':'https'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});
  upstream.on('error',()=>{res.writeHead(503);res.end()});req.pipe(upstream);
 });
 await new Promise(resolve=>proxy.listen(3443,'127.0.0.1',resolve));
 let ready=false;for(let i=0;i<60;i++){try{if((await request('/api/auth')).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}
 assert.ok(ready,'Production application starts within 30 seconds');
 await check('anonymous API and workspace denied',async()=>{assert.equal((await request('/api/products')).status,401);assert.equal((await request('/workspace')).status,307)});
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
  assert.equal((await request('/api/auth',{cookie})).data.user,null);
  cookie=await login();
 });
 await check('logout revokes session and replay is denied',async()=>{
  const old=cookie;assert.equal((await auth({action:'logout'},{cookie})).status,200);assert.equal((await request('/api/products',{cookie:old})).status,401);cookie=await login();
 });
 browser=await chromium.launch();
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='localhost'?route.continue():route.abort()});
 const page=await context.newPage();
 await check('browser login and explicit product edit persist after refresh',async()=>{
  await page.goto(origin+'/sign-in');await page.getByLabel('Email',{exact:true}).fill(owner.email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/workspace');
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
 await context.close();
 console.log('RESULT '+passed+' integration checks passed; synthetic data only; no deployment or backup restore.');
}finally{
 if(browser)await browser.close();
 if(proxy)await new Promise(resolve=>proxy.close(resolve));
 if(app){app.kill('SIGTERM');await new Promise(resolve=>{app.once('exit',resolve);setTimeout(()=>{app.kill('SIGKILL');resolve()},3000).unref()})}
 await db.end();
}
