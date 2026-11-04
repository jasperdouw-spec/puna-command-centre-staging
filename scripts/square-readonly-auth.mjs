// Desktop PKCE authorization; no transaction, catalogue or customer operations.
// Requires Square Console OAuth redirect: http://localhost:<port> (literal port).
// Usage: node scripts/square-readonly-auth.mjs APPLICATION_ID /absolute/private/directory
import http from 'node:http';
import {randomBytes,createHash,createCipheriv} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync,readFileSync,realpathSync,chmodSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
const [applicationId,privateDir,...flags]=process.argv.slice(2);
if(!applicationId?.startsWith('sq0idp-')||!privateDir||!isAbsolute(privateDir)||flags.some(f=>f!=='--without-reporting'))throw Error('Production application ID and private absolute directory required');
const dir=resolve(privateDir);mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
if(!relative(realpathSync('.'),realpathSync(dir)).startsWith('..'))throw Error('Credentials must be outside the repository');
const scopes=['MERCHANT_PROFILE_READ','ORDERS_READ','PAYMENTS_READ',...(flags.includes('--without-reporting')?[]:['REPORTING_READ'])];
const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
const keyFile=dir+'/encryption.key';if(!existsSync(keyFile))writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:'wx'});const key=readFileSync(keyFile);if(key.length!==32)throw Error('Invalid private encryption key');
let consumed=false;
const server=http.createServer(async(req,res)=>{
 const q=new URL(req.url,'http://localhost').searchParams;
 if(q.get('state')!==state){res.writeHead(400,{'Content-Type':'text/plain'});res.end('Invalid authorization state. Return to Square authorization.');return;}
 if(consumed){res.writeHead(409);res.end('Authorization already handled.');return;}consumed=true;
 if(q.get('error')||!q.get('code')){res.writeHead(400,{'Content-Type':'text/plain'});res.end('Square authorization was declined or unavailable. No credentials saved.');console.log('AUTHORIZATION_UNAVAILABLE');server.close();return;}
 try{
  const r=await fetch('https://connect.squareup.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/json','Square-Version':'2026-09-16'},body:JSON.stringify({client_id:applicationId,code:q.get('code'),code_verifier:verifier,grant_type:'authorization_code',redirect_uri:redirect}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!r.ok)throw Error('TOKEN_EXCHANGE_FAILED');const t=await r.json();if(!t.access_token||!t.refresh_token||!t.merchant_id||!t.expires_at)throw Error('INVALID_TOKEN_RESPONSE');
  const s=await fetch('https://connect.squareup.com/oauth2/token/status',{method:'POST',headers:{Authorization:'Bearer '+t.access_token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000),redirect:'error'});if(!s.ok)throw Error('TOKEN_STATUS_UNAVAILABLE');const status=await s.json();
  if(status.client_id!==applicationId||status.merchant_id!==t.merchant_id||scopes.some(s=>!status.scopes.includes(s))||status.scopes.some(s=>!scopes.includes(s)))throw Error('READ_ONLY_SCOPE_VERIFICATION_FAILED');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('puna-local-square-v1'));
  const data=Buffer.concat([cipher.update(JSON.stringify({applicationId,accessToken:t.access_token,refreshToken:t.refresh_token,expiresAt:t.expires_at,merchantId:t.merchant_id,scopes})),cipher.final()]);
  writeFileSync(dir+'/credentials.enc.json',JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}),{mode:0o600});
  res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end('Read-only Square authorization saved privately. You can close this tab and return to PUNA.');console.log(JSON.stringify({authorized:true,merchantId:t.merchant_id,scopes,privateDirectory:dir}));server.close();
 }catch{res.writeHead(400,{'Content-Type':'text/plain'});res.end('Authorization could not be verified. No usable connection was established.');console.log('AUTHORIZATION_VERIFICATION_FAILED');server.close();}
});
await new Promise(resolve=>server.listen(0,'localhost',resolve));
const redirect='http://localhost:'+server.address().port;
const url='https://connect.squareup.com/oauth2/authorize?'+new URLSearchParams({client_id:applicationId,scope:scopes.join(' '),session:'false',state,code_challenge:challenge,code_challenge_method:'S256',redirect_uri:redirect,response_type:'code'});
console.log('Opening Square browser authorization with read-only scopes. No tokens will be printed.');
spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'}).unref();
const timer=setTimeout(()=>{console.log('AUTHORIZATION_TIMED_OUT');server.close();},10*60000);server.on('close',()=>clearTimeout(timer));
