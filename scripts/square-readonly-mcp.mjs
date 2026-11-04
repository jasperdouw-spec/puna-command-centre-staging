// Local desktop MCP only. Hosted ingestion uses its own server OAuth flow.
import {readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {createDecipheriv,createCipheriv,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {isAbsolute} from 'node:path';
const [dir,server]=process.argv.slice(2);
if(!isAbsolute(dir||'')||!isAbsolute(server||''))throw Error('Private credential directory and pinned MCP entrypoint required');
const key=readFileSync(dir+'/encryption.key'),aad=Buffer.from('puna-local-square-v1');
let lock;
try{
 lock=openSync(dir+'/refresh.lock','wx',0o600);
 const r=JSON.parse(readFileSync(dir+'/credentials.enc.json')),d=createDecipheriv('aes-256-gcm',key,Buffer.from(r.iv,'base64'));d.setAAD(aad);d.setAuthTag(Buffer.from(r.tag,'base64'));
 let value=JSON.parse(Buffer.concat([d.update(Buffer.from(r.data,'base64')),d.final()]).toString());
 const allowed=['MERCHANT_PROFILE_READ','ORDERS_READ','PAYMENTS_READ','REPORTING_READ'];
 if(!value.scopes?.length||value.scopes.some(s=>!allowed.includes(s)))throw Error('Read-only OAuth scopes required');
 if(Date.parse(value.expiresAt)<Date.now()+86400000){
  const response=await fetch('https://connect.squareup.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/json','Square-Version':'2026-09-16'},body:JSON.stringify({client_id:value.applicationId,grant_type:'refresh_token',refresh_token:value.refreshToken}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)throw Error('Private Square authorization needs renewal');const t=await response.json();
  if(t.merchant_id!==value.merchantId||!t.access_token||!t.refresh_token||!t.expires_at)throw Error('Square renewal identity check failed');
  value={...value,accessToken:t.access_token,refreshToken:t.refresh_token,expiresAt:t.expires_at};
  const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(aad);const data=Buffer.concat([c.update(JSON.stringify(value)),c.final()]);
  writeFileSync(dir+'/credentials.next.json',JSON.stringify({iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:data.toString('base64')}),{mode:0o600});renameSync(dir+'/credentials.next.json',dir+'/credentials.enc.json');
 }
 closeSync(lock);lock=undefined;unlinkSync(dir+'/refresh.lock');
 const child=spawn(process.execPath,[server,'start'],{stdio:'inherit',env:{...process.env,ACCESS_TOKEN:value.accessToken,PRODUCTION:'true',SANDBOX:'false',DISALLOW_WRITES:'true',SQUARE_VERSION:'2026-09-16'}});
 child.on('exit',code=>process.exit(code??1));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
}catch{
 if(lock!==undefined){closeSync(lock);unlinkSync(dir+'/refresh.lock');}
 console.error('Square read-only MCP could not start. Check private authorization and refresh lock.');process.exit(1);
}
