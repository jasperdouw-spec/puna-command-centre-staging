// Production-like Linux acceptance of an exact committed archive. Own containers
// only, synthetic database, no provider/test flags in the application process.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,cpSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,createHash,scryptSync} from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import mysql from 'mysql2/promise';
import {chromium} from 'playwright';
import {csv,row} from './sales-fixtures.mjs';

const archive=resolve(process.argv[2]||'test-artifacts/prestaging/puna-source.zip');
const manifest=JSON.parse(readFileSync(join(resolve(archive,'..'),'manifest.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(readFileSync(archive)),manifest.archive_sha256);
const run=randomBytes(16).toString('hex'),image='node:22.23.4-bookworm@sha256:7702d8aa4d5910871692af4480eb3ba86f23047a6417a44d857d06c95d060d3f';
const reuse=process.argv[3];
const output=resolve(reuse||'work/linux-'+run.slice(0,12));mkdirSync(output,{recursive:true});
const source=join(output,'source');
if(!reuse){mkdirSync(source);
execFileSync('python3',['-c',`import zipfile,json,pathlib,hashlib,sys
archive,root=sys.argv[1:];manifest=json.loads(pathlib.Path(archive).with_name('manifest.json').read_text())
with zipfile.ZipFile(archive) as z:
 assert sorted(z.namelist())==sorted(f['path'] for f in manifest['files'])
 for f in manifest['files']:
  p=pathlib.PurePosixPath(f['path']);assert not p.is_absolute() and '..' not in p.parts
  assert not p.name.startswith('.env') or str(p)=='.env.example'
  assert hashlib.sha256(z.read(str(p))).hexdigest()==f['sha256']
 z.extractall(root)
`,archive,source]);
// Reproduce the observed Hostinger standalone wrapper, preserving our headers.
const nextConfig=join(source,'next.config.mjs');writeFileSync(join(source,'hostinger-original.next.config.mjs'),readFileSync(nextConfig));
writeFileSync(nextConfig,'import config from "./hostinger-original.next.config.mjs";\nexport default {...config,output:"standalone"};\n');
}else{
 // Retry smoke checks only against a completed build of these exact bytes.
 assert.match(readFileSync(join(output,'build.log'),'utf8'),/Static.*prerendered/);
 assert.ok(readFileSync(join(source,'.next/BUILD_ID'),'utf8').trim());
 for(const f of manifest.files){
  if(f.path==='next-env.d.ts')continue; // Next-generated type declarations.
  const path=f.path==='next.config.mjs'?'hostinger-original.next.config.mjs':f.path;
  assert.equal(sha(readFileSync(join(source,path))),f.sha256,'Reused source '+f.path);
 }
 assert.equal(readFileSync(join(source,'next.config.mjs'),'utf8'),'import config from "./hostinger-original.next.config.mjs";\nexport default {...config,output:"standalone"};\n');
}
const docker=(args,opts={})=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:20*1024*1024,...opts});
const containers=[];let db,browser,proxy;const cert=mkdtempSync(join(tmpdir(),'puna-linux-cert-'));let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS Linux '+name)};
const owned=id=>{const [c]=JSON.parse(docker(['inspect',id]));assert.equal(c.Config.Labels['puna.prestaging.run'],run);return c;};
try{
 const builder=docker(['run','--detach','--platform','linux/amd64','--name','puna-linux-build-'+run.slice(0,12),'--label','puna.prestaging.run='+run,'--memory=1600m','--cpus=2','--mount','type=bind,src='+source+',dst=/app','-w','/app','-e','NODE_ENV=production','-e','NEXT_TELEMETRY_DISABLED=1','-e','NODE_OPTIONS=--max-old-space-size=512',image,'sleep','infinity']).trim();containers.push(builder);owned(builder);
 if(!reuse){const build=docker(['exec','-e','NEXT_TEST_WASM=1',builder,'sh','-c',`node --version && npm --version && npm ci --no-audit --no-fund && npm run typecheck && node -e 'require("next/dist/build/swc").loadBindings().then(b=>{require("node:assert/strict").equal(b.isWasm,true);console.log("VERIFIED WASM fallback")})' && npm run build`],{timeout:900000});writeFileSync(join(output,'build.log'),build);}console.log('Linux production install/typecheck/WASM build '+(reuse?'verified from prior successful build':'completed'));
 const native=JSON.parse(docker(['exec',builder,'node','--input-type=module','-e',`import sharp from 'sharp';import fs from 'node:fs';const output=await sharp('public/social/puna-social.jpg').resize(120).png().toBuffer();const swc=await import('next/dist/build/swc/index.js');const bindings=await swc.loadBindings();console.log(JSON.stringify({node:process.version,arch:process.arch,platform:process.platform,glibc:process.report.getReport().header.glibcVersionRuntime,sharp:sharp.versions.sharp,vips:sharp.versions.vips,pngBytes:output.length,svgPngBytes:(await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>')).png().toBuffer()).length,swcIsWasm:bindings.isWasm,lockHash:(await import('node:crypto')).createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex')}));`]));
 assert.equal(native.platform,'linux');assert.equal(native.arch,'x64');assert.equal(native.sharp,'0.35.5');assert.equal(native.swcIsWasm,false);assert.ok(native.pngBytes>0);assert.ok(native.svgPngBytes>0);
 // Current hosted logs show native SWC cannot load on its older glibc and Next
 // uses its WASM fallback. Exercise that build path too, without claiming our
 // Debian glibc is the exact hosted OS image.
 native.wasmBuildPassed=true;
 cpSync(join(source,'public'),join(source,'.next/standalone/public'),{recursive:true});cpSync(join(source,'.next/static'),join(source,'.next/standalone/.next/static'),{recursive:true});
 const database=docker(['run','--detach','--name','puna-linux-db-'+run.slice(0,12),'--label','puna.prestaging.run='+run,'--memory=1g','--tmpfs','/var/lib/mysql:rw,size=536870912','-p','127.0.0.1::3306','-p','127.0.0.1::3100','-e','MARIADB_ROOT_PASSWORD=synthetic-ci-root-only','-e','MARIADB_DATABASE=puna_ci_synthetic','-e','MARIADB_USER=puna_ci','-e','MARIADB_PASSWORD=synthetic-ci-user-only','mariadb:11.8.9']).trim();containers.push(database);
 const info=owned(database);assert.equal(info.HostConfig.Tmpfs['/var/lib/mysql'],'rw,size=536870912');assert.ok(info.Mounts.every(m=>m.Type==='tmpfs'));
 for(const mappings of Object.values(info.NetworkSettings.Ports))for(const p of mappings||[])assert.equal(p.HostIp,'127.0.0.1');
 const dbPort=Number(info.NetworkSettings.Ports['3306/tcp'][0].HostPort),appPort=Number(info.NetworkSettings.Ports['3100/tcp'][0].HostPort);
 let ready=false;for(let n=0;n<60;n++){if(spawnSync('docker',['exec',database,'healthcheck.sh','--connect','--innodb_initialized']).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}assert.ok(ready);
 db=await mysql.createConnection({host:'127.0.0.1',port:dbPort,user:'puna_ci',password:'synthetic-ci-user-only',database:'puna_ci_synthetic',multipleStatements:true});
 await db.query('ALTER DATABASE puna_ci_synthetic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
 for(const file of ['001_initial','003_auth_rate_limits','004_product_versions','005_unified_staging','006_commerce','008_reporting'])await db.query(readFileSync(join(source,'db',file+'.sql'),'utf8'));
 const password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex'),passwordHash='scrypt:'+salt+':'+scryptSync(password,salt,64).toString('hex');
 for(const role of ['owner','staff'])await db.execute('INSERT INTO users(email,display_name,role,password_hash) VALUES(?,?,?,?)',[role+'@example.test','Synthetic '+role,role,passwordHash]);
 for(let n=1;n<=5;n++)await db.execute('INSERT INTO products(id,name,description,price_cents,kind) VALUES(?,?,?,?,?)',['synthetic-'+n,'Synthetic pastry '+n,'Linux acceptance fixture',800,'fresh']);
 const app=docker(['run','--detach','--platform','linux/amd64','--name','puna-linux-app-'+run.slice(0,12),'--label','puna.prestaging.run='+run,'--memory=1g','--network','container:'+database,'--mount','type=bind,src='+source+',dst=/app,readonly','-w','/app/.next/standalone','-e','NODE_ENV=production','-e','NEXT_TELEMETRY_DISABLED=1','-e','HOSTNAME=0.0.0.0','-e','PORT=3100','-e','DB_HOST=127.0.0.1','-e','DB_PORT=3306','-e','DB_NAME=puna_ci_synthetic','-e','DB_USER=puna_ci','-e','DB_PASSWORD=synthetic-ci-user-only',image,'node','server.js']).trim();containers.push(app);
 assert.ok(owned(app).Config.Env.every(v=>! /^(PUNA_|SQUARE_|GOOGLE_|BOOTSTRAP_|STAGING_TEST_)/.test(v)));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(cert,'key.pem'),'-out',join(cert,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],{stdio:'ignore'});
 proxy=https.createServer({key:readFileSync(join(cert,'key.pem')),cert:readFileSync(join(cert,'cert.pem'))},(req,res)=>{const upstream=http.request({host:'127.0.0.1',port:appPort,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-proto':'https'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream)});
 await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const origin='https://localhost:'+proxy.address().port;
 const request=(path,{method='GET',body,raw,headers={},cookie}={})=>new Promise((resolve,reject)=>{const bytes=raw??(body===undefined?undefined:JSON.stringify(body));const req=https.request(origin+path,{method,rejectUnauthorized:false,headers:{origin,...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const text=Buffer.concat(chunks).toString();let data;try{data=JSON.parse(text)}catch{data=text}resolve({status:res.statusCode,headers:res.headers,data})})});req.on('error',reject);req.end(bytes)});
 ready=false;for(let n=0;n<45;n++){if((await request('/api/checkout')).status===200){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}assert.ok(ready);
 await check('native sharp and SWC on Linux x64 glibc',async()=>assert.equal(native.swcIsWasm,false));
 await check('homepage noindex and private security headers',async()=>{const r=await request('/');assert.equal(r.status,200);assert.match(r.headers['x-robots-tag'],/noindex/);assert.equal(r.headers['x-frame-options'],'DENY');assert.match(r.data,/Andean roots/)});
 await check('static social image and cold/warm asset responses',async()=>{for(let n=0;n<2;n++){const r=await request('/social/puna-social.jpg');assert.equal(r.status,200);assert.match(r.headers['content-type'],/image\/jpeg/)}});
 await check('custom 404 and unpublished privacy page',async()=>{assert.equal((await request('/missing-linux-review')).status,404);assert.equal((await request('/privacy')).status,404)});
 await check('robots and empty staging sitemap',async()=>{assert.match((await request('/robots.txt')).data,/Disallow: \/workspace/);const r=await request('/sitemap.xml');assert.equal(r.status,200);assert.doesNotMatch(r.data,/<loc>/)});
 await check('five public products and default-off catalogue flags',async()=>{const r=await request('/api/puna');assert.equal(r.data.products.length,5);for(const f of ['testOrdersEnabled','kitchenPreview','orderingLocal'])assert.equal(r.data[f],false)});
 await check('checkout disabled without any provider configuration',async()=>assert.equal((await request('/api/checkout')).data.mode,'disabled'));
 await check('kitchen and availability disabled without C/D schema',async()=>{assert.equal((await request('/api/kitchen')).status,404);const r=await request('/api/kitchen/availability');assert.equal(r.status,200);assert.deepEqual(r.data,{enabled:false})});
 await check('fixture and local callback routes refuse public requests',async()=>{for(const path of ['/api/local-fixtures','/api/local-provider/webhook'])assert.equal((await request(path,{method:'POST',body:{}})).status,404)});
 await check('private navigation redirects and anonymous API denies',async()=>{assert.match((await request('/workspace')).headers.location,/sign-in/);for(const path of ['/api/sales','/api/workspace','/api/operations'])assert.equal((await request(path)).status,401)});
 const login=async role=>{const r=await request('/api/auth',{method:'POST',body:{action:'login',email:role+'@example.test',password}});assert.equal(r.status,200);assert.match(r.headers['set-cookie'][0],/HttpOnly/i);assert.match(r.headers['set-cookie'][0],/Secure/i);return r.headers['set-cookie'][0].split(';')[0]};
 const owner=await login('owner'),staff=await login('staff');
 await check('owner authentication and reporting access; staff denied reports',async()=>{assert.equal((await request('/api/sales',{cookie:owner})).status,200);assert.equal((await request('/api/sales',{cookie:staff})).status,403)});
 // Import an explicit synthetic row through the ordinary owner API; no provider.
 const form=new FormData();form.append('files',new Blob([csv([row()])]),'synthetic-linux.csv');const multipart=new Response(form);
 const preview=await request('/api/sales',{method:'POST',cookie:owner,raw:Buffer.from(await multipart.arrayBuffer()),headers:{'content-type':multipart.headers.get('content-type')}});assert.equal(preview.status,200);
 assert.equal((await request('/api/sales',{method:'POST',cookie:owner,body:{action:'import',id:preview.data.id}})).status,200);
 await check('Day Week Month dashboard API and product drill-down',async()=>{for(const period of ['day','week','month']){const r=await request('/api/sales?view=dashboard&period='+period+'&date=2025-06-01',{cookie:owner});assert.equal(r.status,200);assert.equal(r.data.current.totals.net,700);const key=r.data.current.products[0].key;assert.equal((await request('/api/sales?view=dashboard&period='+period+'&date=2025-06-01&product='+key,{cookie:owner})).status,200)}});
 await check('oversize reference batch is rejected safely by the actual API',async()=>assert.equal((await request('/api/sales',{method:'POST',cookie:owner,body:{action:'preview-references',items:Array(51).fill(null)}})).status,400));
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-gpu']});
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},reducedMotion:'reduce'});const external=[];
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();external.push(u.hostname);return route.abort()});const page=await context.newPage();
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]])await check(name+' homepage/footer render with no overflow',async()=>{await page.setViewportSize({width,height});await page.goto(origin+'/');await page.locator('.menu-card').first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.locator('footer').isVisible());await page.screenshot({path:join(output,name+'-homepage.png'),fullPage:true,animations:'disabled'})});
 await check('customer cart displays ordering disabled',async()=>{await page.evaluate(()=>localStorage.setItem('puna-cart-v1',JSON.stringify({'synthetic-1':1})));await page.goto(origin+'/cart');await page.getByText(/Online ordering is not open/).waitFor()});
 await context.addCookies([{name:'puna_session',value:owner.split('=')[1],url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);await page.setViewportSize({width:1440,height:1000});
 await check('owner CRM and dashboard Day Week Month rendering',async()=>{await page.goto(origin+'/workspace');await page.getByRole('tab',{name:'Sales reports',exact:true}).click();await page.getByLabel('Reporting date',{exact:true}).fill('2025-06-01');for(const tab of ['Day','Week','Month']){await page.getByRole('tab',{name:tab,exact:true}).click();await page.locator('.sd-product').first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}await page.locator('.sd-product').first().click();await page.getByRole('region',{name:'Selected product detail'}).waitFor();await page.locator('.sd-product-detail .sd-chart').waitFor();await page.screenshot({path:join(output,'desktop-dashboard.png'),fullPage:true,animations:'disabled'})});
 await check('worker page remains legacy/disabled for Live Kitchen',async()=>{await page.goto(origin+'/food-truck');await page.getByRole('heading',{name:'Welcome, Synthetic owner'}).waitFor();assert.equal(await page.locator('.live-kitchen-workspace').count(),0);assert.equal((await request('/api/kitchen',{cookie:staff})).status,404)});
 await check('no analytics or external service browser requests',async()=>{assert.deepEqual(external,[])});
 await check('no kitchen migration or ordering records created',async()=>{const [tables]=await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE 'kitchen_%'");assert.equal(tables.length,0);const [orders]=await db.query('SELECT COUNT(*) n FROM pickup_orders');assert.equal(Number(orders[0].n),0)});
 const result={commit:manifest.commit,archiveSha256:manifest.archive_sha256,image,native,browserVersion:browser.version(),checks,reusedVerifiedBuild:!!reuse,applicationFeatureVariables:[],syntheticOnly:true,sourceDirectory:source,outputDirectory:output};writeFileSync(join(output,'result.json'),JSON.stringify(result,null,2)+'\n');writeFileSync('work/linux-latest.json',JSON.stringify(result,null,2)+'\n');console.log('RESULT '+checks+' Linux production checks passed; '+output);
}finally{
 if(browser)await browser.close();if(proxy)await new Promise(r=>proxy.close(r));if(db)await db.end();
 for(const id of containers.reverse()){owned(id);docker(['rm','--force',id]);}rmSync(cert,{recursive:true,force:true});console.log('Removed only owned Linux containers and temporary TLS files');
}
