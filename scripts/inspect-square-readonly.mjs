// Private identity/schema inspection. No sales queries or transaction mutations.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createDecipheriv} from 'node:crypto';
import {isAbsolute,resolve,relative} from 'node:path';
const [dir,out]=process.argv.slice(2);if(!dir||!out||!isAbsolute(dir)||!isAbsolute(out)||!relative(resolve('.'),resolve(out)).startsWith('..'))throw Error('Private paths outside repository required');
const r=JSON.parse(readFileSync(dir+'/credentials.enc.json')),d=createDecipheriv('aes-256-gcm',readFileSync(dir+'/encryption.key'),Buffer.from(r.iv,'base64'));d.setAAD(Buffer.from('puna-local-square-v1'));d.setAuthTag(Buffer.from(r.tag,'base64'));const credential=JSON.parse(Buffer.concat([d.update(Buffer.from(r.data,'base64')),d.final()]).toString());
async function get(path,body){const r=await fetch('https://connect.squareup.com'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+credential.accessToken,'Square-Version':'2026-09-16','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok)return {status:r.status};return {status:r.status,data:await r.json()};}
const status=await get('/oauth2/token/status',{});if(status.status!==200||status.data.merchant_id!==credential.merchantId||status.data.scopes.some(s=>!['MERCHANT_PROFILE_READ','ORDERS_READ','PAYMENTS_READ','REPORTING_READ'].includes(s)))throw Error('Read-only identity verification failed');
const merchant=await get('/v2/merchants/'+encodeURIComponent(credential.merchantId));if(merchant.status!==200)throw Error('Merchant read failed');
const m=merchant.data.merchant,locations=await get('/v2/locations');if(locations.status!==200)throw Error('Location read failed');
const identity={verifiedAt:new Date().toISOString(),environment:'production',merchant:{id:m.id,name:m.business_name,country:m.country,currency:m.currency,status:m.status},locations:locations.data.locations.map(l=>({id:l.id,name:l.name,status:l.status,country:l.country,currency:l.currency,timezone:l.timezone,createdAt:l.created_at})),scopes:status.data.scopes,expiresAt:status.data.expires_at};
mkdirSync(out,{recursive:true,mode:0o700});writeFileSync(out+'/square-identity.json',JSON.stringify(identity,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(identity));
if(m.country!=='CA'||m.currency!=='CAD')throw Error('Canadian CAD merchant verification required');
const meta=await get('/reporting/v1/meta');writeFileSync(out+'/square-reporting-metadata.json',JSON.stringify(meta,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({reportingStatus:meta.status,cubes:meta.data?.cubes?.map(c=>({name:c.name,type:c.type,measures:c.measures?.length,dimensions:c.dimensions?.length}))}));
