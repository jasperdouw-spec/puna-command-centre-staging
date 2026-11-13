import 'server-only';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import type {RowDataPacket} from 'mysql2';
import {database} from './db';
import {audit} from './commerce';
import {salesTransaction} from './sales';
import {hash,SalesError} from './sales-model';
import {reportingCents} from './square-reporting-model';

export const REPORTING_SCOPES=['MERCHANT_PROFILE_READ','ORDERS_READ','PAYMENTS_READ','REPORTING_READ'];
export const SQUARE_READ_SCOPES=[...REPORTING_SCOPES,'ITEMS_READ'];
const BASE='https://connect.squareup.com';
const VERSION='2026-09-16';
const deadline=new AsyncLocalStorage<number>();
export const withSquareDeadline=<T>(fn:()=>Promise<T>)=>deadline.run(Date.now()+40000,fn);
const date=(s:string)=>new Date(s).toISOString().slice(0,23).replace('T',' ');
export function reportingConfig(){
 const e=process.env,locations=(e.SQUARE_REPORTING_LOCATION_IDS||'').split(',').filter(Boolean);
 if(e.PUNA_SQUARE_REPORTING_ENABLED!=='true')throw new SalesError('SQUARE_REPORTING_DISABLED',409);
 if(!e.SQUARE_REPORTING_APPLICATION_ID||!e.SQUARE_REPORTING_APPLICATION_SECRET||!e.SQUARE_REPORTING_MERCHANT_ID||!/^([a-f0-9]{64})$/.test(e.PUNA_REPORTING_ENCRYPTION_KEY||'')||!locations.length||locations.length>10)throw new SalesError('SQUARE_REPORTING_CONFIGURATION_REQUIRED',409);
 const origin=e.PUNA_REPORTING_ORIGIN;if(!origin||!/^https:\/\/[a-z0-9.:-]+$/.test(origin))throw new SalesError('SQUARE_REDIRECT_CONFIGURATION_REQUIRED',409);
 return {appId:e.SQUARE_REPORTING_APPLICATION_ID,secret:e.SQUARE_REPORTING_APPLICATION_SECRET,merchant:e.SQUARE_REPORTING_MERCHANT_ID,locations,redirect:origin+'/api/sales/square/callback',key:Buffer.from(e.PUNA_REPORTING_ENCRYPTION_KEY!,'hex')};
}
function encrypt(value:unknown){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',reportingConfig().key,iv);cipher.setAAD(Buffer.from('puna-square-reporting-v1'));const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});}
function decrypt(text:string){const r=JSON.parse(text),cipher=createDecipheriv('aes-256-gcm',reportingConfig().key,Buffer.from(r.iv,'base64'));cipher.setAAD(Buffer.from('puna-square-reporting-v1'));cipher.setAuthTag(Buffer.from(r.tag,'base64'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(r.data,'base64')),cipher.final()]).toString('utf8'));}
// Semantic allowlist: POST search, introspection and token exchange are allowed;
// no create/update/cancel/payment/refund/catalogue mutation is reachable here.
export async function squareRead(path:string,token:string|null,body?:unknown){
 const pathname=path.split('?')[0];
 const permitted=(pathname==='/v2/orders/search'&&body!==undefined)||(['/oauth2/token','/oauth2/token/status'].includes(pathname)&&body!==undefined)||(/^\/v2\/(merchants\/[A-Za-z0-9_-]+|orders\/[A-Za-z0-9_-]+|locations|refunds)$/.test(pathname)&&body===undefined)||(pathname==='/reporting/v1/meta'&&body===undefined)||(pathname==='/reporting/v1/load'&&body!==undefined);
 if(!permitted||path.includes('://')||path.includes('#'))throw new SalesError('SQUARE_OPERATION_DENIED',403);
 for(let attempt=0;attempt<3;attempt++){
  try{
   const remaining=(deadline.getStore()??Date.now()+8000)-Date.now();if(remaining<1000)throw new SalesError('SQUARE_EXECUTION_BUDGET',503);
   const response=await fetch(BASE+path,{method:body===undefined?'GET':'POST',headers:{'Square-Version':VERSION,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(Math.min(8000,remaining)),cache:'no-store',redirect:'error'});
   if(response.status===401||response.status===403)throw new SalesError('SQUARE_ACCESS_UNAVAILABLE',409);
   if(response.status===429||response.status>=500){if(attempt<2){const delay=Math.min(2000,Math.max(250,Number(response.headers.get('retry-after')||0)*1000,250*2**attempt));await new Promise(r=>setTimeout(r,delay));continue;}throw new SalesError('SQUARE_RETRY_EXHAUSTED',503);}
   if(!response.ok)throw new SalesError(response.status===400?'SQUARE_QUERY_REJECTED':'SQUARE_REQUEST_FAILED',409);
   const text=await response.text();if(text.length>8*1024*1024)throw new SalesError('SQUARE_RESPONSE_LIMIT',503);const result=JSON.parse(text);
   if(result.error==='Continue wait'&&attempt<2){await new Promise(r=>setTimeout(r,500));continue;}
   if(result.errors?.length||result.error)throw new SalesError('SQUARE_QUERY_INCOMPLETE',503);return result;
  }catch(e){if(e instanceof SalesError)throw e;if(attempt===2)throw new SalesError('SQUARE_NETWORK_UNAVAILABLE',503);await new Promise(r=>setTimeout(r,250*2**attempt));}
 }
 throw new SalesError('SQUARE_RETRY_EXHAUSTED',503);
}
export async function verifySquareIdentity(token:string){
 const cfg=reportingConfig(),status=await squareRead('/oauth2/token/status',token,{});
 if(status.merchant_id!==cfg.merchant||status.client_id!==cfg.appId)throw new SalesError('SQUARE_MERCHANT_MISMATCH',409);
 const required=REPORTING_SCOPES.filter(s=>s!=='REPORTING_READ');
 if(required.some(s=>!status.scopes?.includes(s))||status.scopes.some((s:string)=>!SQUARE_READ_SCOPES.includes(s)))throw new SalesError('SQUARE_READ_SCOPES_REQUIRED',409);
 const merchant=(await squareRead('/v2/merchants/'+encodeURIComponent(cfg.merchant),token)).merchant;
 if(!merchant||merchant.id!==cfg.merchant||merchant.country!=='CA'||merchant.currency!=='CAD')throw new SalesError('SQUARE_CANADIAN_MERCHANT_REQUIRED',409);
 const response=await squareRead('/v2/locations',token),locations=(response.locations||[]).filter((l:any)=>cfg.locations.includes(l.id));
 if(locations.length!==cfg.locations.length||locations.some((l:any)=>l.currency!=='CAD'||l.country!=='CA'||l.timezone!=='America/Vancouver'))throw new SalesError('SQUARE_LOCATION_MISMATCH',409);
 return {merchantId:merchant.id,businessName:merchant.business_name,country:merchant.country,currency:merchant.currency,environment:'production',scopes:status.scopes,locations:locations.map((l:any)=>({id:l.id,name:l.name,status:l.status,timezone:l.timezone,currency:l.currency})),history:'Not established until bounded backfills complete.'};
}
export function minimizeMetadata(raw:any){
 if(!Array.isArray(raw.cubes))throw new SalesError('SQUARE_METADATA_INVALID',409);
 return {discoveredAt:new Date().toISOString(),cubes:raw.cubes.map((c:any)=>({name:c.name,type:c.type,measures:(c.measures||[]).map((m:any)=>({name:m.name,type:m.type})),dimensions:(c.dimensions||[]).map((d:any)=>({name:d.name,type:d.type})),segments:(c.segments||[]).map((s:any)=>({name:s.name}))}))};
}
export async function beginSquareAuthorization(actor:number){
 const cfg=reportingConfig(),state=randomBytes(32).toString('base64url');
 await salesTransaction(async c=>{await c.execute('DELETE FROM sales_oauth_states WHERE expires_at<UTC_TIMESTAMP(3)');await c.execute('INSERT INTO sales_oauth_states(state_hash,actor_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 10 MINUTE))',[hash(state),actor]);});
 const [connections]=await database().query<RowDataPacket[]>('SELECT identity FROM sales_connection WHERE id=1');
 const existing:string[]=connections[0]?JSON.parse(connections[0].identity).scopes:[];
 const scopes=[...new Set([...(process.env.SQUARE_REPORTING_REQUEST_REPORTING_SCOPE==='false'?REPORTING_SCOPES.filter(s=>s!=='REPORTING_READ'):REPORTING_SCOPES),...existing.filter(s=>SQUARE_READ_SCOPES.includes(s)),'ITEMS_READ'])];
 return {url:'https://connect.squareup.com/oauth2/authorize?'+new URLSearchParams({client_id:cfg.appId,scope:scopes.join(' '),session:'false',state,redirect_uri:cfg.redirect}).toString()};
}
export async function finishSquareAuthorization(actor:number,state:string,code:string){
 const cfg=reportingConfig();await salesTransaction(async c=>{const [r]=await c.execute('DELETE FROM sales_oauth_states WHERE state_hash=? AND actor_id=? AND expires_at>UTC_TIMESTAMP(3)',[hash(state),actor]);if(!(r as {affectedRows:number}).affectedRows)throw new SalesError('SQUARE_AUTH_STATE_INVALID',403);});
 const tokens=await squareRead('/oauth2/token',null,{client_id:cfg.appId,client_secret:cfg.secret,grant_type:'authorization_code',code,redirect_uri:cfg.redirect});
 if(!tokens.access_token||!tokens.refresh_token||!tokens.expires_at||tokens.merchant_id!==cfg.merchant)throw new SalesError('SQUARE_AUTH_RESPONSE_INVALID',409);
 const identity=await verifySquareIdentity(tokens.access_token);let metadata:any=null,metadataStatus='SQUARE_REPORTING_SCOPE_UNAVAILABLE';
 if(identity.scopes.includes('REPORTING_READ'))try{metadata=minimizeMetadata(await squareRead('/reporting/v1/meta',tokens.access_token));metadataStatus='available';}catch(e){metadataStatus=e instanceof SalesError?e.code:'SQUARE_METADATA_UNAVAILABLE';}
 await salesTransaction(async c=>{
  const [old]=await c.execute<RowDataPacket[]>('SELECT merchant_id FROM sales_connection WHERE id=1');if(old.length&&old[0].merchant_id!==identity.merchantId)throw new SalesError('SQUARE_MERCHANT_CHANGE_DENIED',409);
  await c.execute('INSERT INTO sales_connection(id,merchant_id,credentials,expires_at,identity,metadata,verified_at) VALUES(1,?,?,?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE credentials=VALUES(credentials),expires_at=VALUES(expires_at),identity=VALUES(identity),metadata=VALUES(metadata),verified_at=UTC_TIMESTAMP(3),failure_code=NULL,version=version+1',[identity.merchantId,encrypt({accessToken:tokens.access_token,refreshToken:tokens.refresh_token}),date(tokens.expires_at),JSON.stringify({...identity,metadataStatus}),metadata?JSON.stringify(metadata):null]);
  await audit(c,actor,'sales:square-authorized','sales_connection','1');
 });return {connected:true,identity,metadataStatus};
}
export async function squareAccess(){
 const cfg=reportingConfig();return salesTransaction(async c=>{
  const [r]=await c.query<RowDataPacket[]>('SELECT * FROM sales_connection WHERE id=1 FOR UPDATE');if(!r.length)throw new SalesError('SQUARE_PRIVATE_AUTHORIZATION_REQUIRED',409);
  if(r[0].merchant_id!==cfg.merchant)throw new SalesError('SQUARE_MERCHANT_MISMATCH',409);
  let credentials=decrypt(r[0].credentials);
  if(new Date(r[0].expires_at).getTime()<Date.now()+24*3600000){
   const t=await squareRead('/oauth2/token',null,{client_id:cfg.appId,client_secret:cfg.secret,grant_type:'refresh_token',refresh_token:credentials.refreshToken,scopes:JSON.parse(r[0].identity).scopes});
   if(t.merchant_id!==cfg.merchant||!t.access_token||!t.refresh_token||!t.expires_at)throw new SalesError('SQUARE_REFRESH_RESPONSE_INVALID',409);
   credentials={accessToken:t.access_token,refreshToken:t.refresh_token};await c.execute('UPDATE sales_connection SET credentials=?,expires_at=?,version=version+1 WHERE id=1',[encrypt(credentials),date(t.expires_at)]);
  }
  return {token:credentials.accessToken as string,identity:JSON.parse(r[0].identity),metadata:r[0].metadata?JSON.parse(r[0].metadata):null};
 });
}
export async function inspectSquareAccess(){return withSquareDeadline(async()=>{
 const {token}=await squareAccess(),identity=await verifySquareIdentity(token);let metadata=null,metadataStatus='SQUARE_REPORTING_SCOPE_UNAVAILABLE';
 if(identity.scopes.includes('REPORTING_READ'))try{metadata=minimizeMetadata(await squareRead('/reporting/v1/meta',token));metadataStatus='available';}catch(e){metadataStatus=e instanceof SalesError?e.code:'SQUARE_METADATA_UNAVAILABLE';}
 await database().execute('UPDATE sales_connection SET identity=?,metadata=?,verified_at=UTC_TIMESTAMP(3) WHERE id=1',[JSON.stringify({...identity,metadataStatus}),metadata?JSON.stringify(metadata):null]);return {identity,metadata,metadataStatus};
 });
}

export async function captureSquareReport(actor:number,from:string,to:string,profile:'sales'|'items'){
 return withSquareDeadline(async()=>{
  if(Date.parse(to)-Date.parse(from)>3660*86400000||from>to)throw new SalesError('REPORT_DATE_RANGE');
  const {token}=await squareAccess(),identity=await verifySquareIdentity(token);
  if(!identity.scopes.includes('REPORTING_READ'))throw new SalesError('SQUARE_REPORTING_SCOPE_UNAVAILABLE',409);
  const metadata=minimizeMetadata(await squareRead('/reporting/v1/meta',token));
  const cube=profile==='sales'?'Sales':'ItemSales',time=cube+'.local_reporting_timestamp',location=cube+'.location_id';
  const measures=(profile==='sales'?['net_sales','order_count','top_line_product_sales','discounts_amount','itemized_returns','refunds_by_amount_amount','tips_amount','sales_tax_amount','total_collected_amount']:['item_net_sales','net_quantity','order_count','sales_gross_amount','item_discount_money','returns_net_amount','item_tax_money']).map(s=>cube+'.'+s);
  const meta=metadata.cubes.find((c:any)=>c.name===cube);
  if(!meta||measures.some(m=>!meta.measures.some((x:any)=>x.name===m))||[time,location].some(d=>!meta.dimensions.some((x:any)=>x.name===d)))throw new SalesError('SQUARE_REPORT_PROFILE_UNAVAILABLE',409);
  // Local-reporting timestamp already encodes the location's wall clock. A
  // Vancouver query timezone would convert it twice; omit timezone as instructed
  // by the merchant's metadata. Monthly range is bounded below the result limit.
  const query={measures,dimensions:[location],timeDimensions:[{dimension:time,dateRange:[from,to],granularity:'month'}],filters:[{member:location,operator:'equals',values:identity.locations.map((l:any)=>l.id)}],limit:2000};
  const raw=await squareRead('/reporting/v1/load',token,{query});
  if(!Array.isArray(raw.data)||raw.data.length>=2000)throw new SalesError('SQUARE_REPORT_INCOMPLETE',409);
  const rows=raw.data.map((r:any)=>{
   if(!identity.locations.some((l:any)=>l.id===r[location])||!/^\d{4}-\d{2}-/.test(r[time+'.month']))throw new SalesError('SQUARE_REPORT_DIMENSION_INVALID',409);
   const values=Object.fromEntries(measures.map(m=>{const count=m.endsWith('.order_count')||m.endsWith('.net_quantity');const v=r[m];if(count&&v!=null&&(!Number.isFinite(Number(v))||Math.abs(Number(v))>1e12))throw new SalesError('SQUARE_REPORT_NUMBER_INVALID');return [m,count?(v==null?null:String(v)):reportingCents(v)];}));
   return {month:r[time+'.month'].slice(0,7),locationId:r[location],values};
  });
  const payload={currency:'CAD',timezone:'America/Vancouver',moneyUnit:'integer cents',quantityUnit:'source decimal',rows,grain:'provider aggregate; separate from item facts',freshness:'Square propagation can take at least 15 minutes; absence is not certified zero.'};
  const id=hash(JSON.stringify([query,payload])),fetchedAt=new Date().toISOString();
  await salesTransaction(async c=>{await c.execute('INSERT INTO sales_report_snapshots(id,profile,start_date,end_date,query_json,payload,fetched_at,actor_id) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fetched_at=VALUES(fetched_at)',[id,profile,from,to,JSON.stringify(query),JSON.stringify(payload),date(fetchedAt),actor]);await audit(c,actor,'sales:report-snapshot','square_report',id);});
  return {snapshot:{id,profile,from,to,payload,fetchedAt}};
 });
}
