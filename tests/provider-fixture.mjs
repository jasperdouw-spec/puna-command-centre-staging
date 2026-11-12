import {assertSyntheticContext} from './disposable-context.mjs';
// CI-only interception of outbound provider traffic. Never selected by application configuration.
import assert from 'node:assert/strict';
assertSyntheticContext();
import {generateKeyPairSync,sign} from 'node:crypto';
import {order,money} from './sales-fixtures.mjs';
Object.assign(process.env,{PUNA_SQUARE_REPORTING_ENABLED:'true',PUNA_REPORTING_SCHEDULE_ENABLED:'true',PUNA_REPORTING_JOB_TOKEN:'synthetic-reporting-job-token-32-characters',SQUARE_REPORTING_APPLICATION_ID:'synthetic-reporting-app',SQUARE_REPORTING_APPLICATION_SECRET:'synthetic-secret',SQUARE_REPORTING_MERCHANT_ID:'synthetic-merchant',SQUARE_REPORTING_LOCATION_IDS:'synthetic-location',PUNA_REPORTING_ENCRYPTION_KEY:'a'.repeat(64),PUNA_REPORTING_ORIGIN:'https://localhost:3443',SQUARE_REPORTING_START_AT:'2025-06-01T00:00:00Z'});
const identityKeys=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...identityKeys.publicKey.export({format:'jwk'}),kid:'synthetic-ci-key',alg:'RS256',use:'sig'};
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');

const original=globalThis.fetch,orders=new Map(),payments=new Map(),keys=new Map();let sequence=0;
const reply=(data,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}}));
globalThis.fetch=async function(input,init){
 const url=String(input instanceof Request?input.url:input);
 if(url.startsWith('https://connect.squareup.com/')){
  const path=new URL(url).pathname,body=init?.body?JSON.parse(init.body):{};
  if(init?.headers?.Authorization==='Bearer synthetic-revoked')return reply({},401);
  if(path==='/oauth2/token')return reply({access_token:'synthetic-reporting-token',refresh_token:'synthetic-reporting-refresh',expires_at:'2030-01-01T00:00:00Z',merchant_id:'synthetic-merchant'});
  if(path==='/oauth2/token/status')return reply({merchant_id:'synthetic-merchant',client_id:'synthetic-reporting-app',scopes:['MERCHANT_PROFILE_READ','ORDERS_READ','PAYMENTS_READ','REPORTING_READ']});
  if(path==='/v2/merchants/synthetic-merchant')return reply({merchant:{id:'synthetic-merchant',country:'CA',currency:'CAD',business_name:'Synthetic merchant'}});
  if(path==='/v2/locations')return reply({locations:[{id:'synthetic-location',name:'Synthetic location',status:'ACTIVE',country:'CA',currency:'CAD',timezone:'America/Vancouver'}]});
  if(path==='/reporting/v1/meta')return reply({cubes:[{name:'Sales',type:'view',measures:['net_sales','order_count','top_line_product_sales','discounts_amount','itemized_returns','refunds_by_amount_amount','tips_amount','sales_tax_amount','total_collected_amount'].map(n=>({name:'Sales.'+n,type:'number'})),dimensions:[{name:'Sales.local_reporting_timestamp',type:'time'},{name:'Sales.location_id',type:'string'}],segments:[]}]});
  if(path==='/reporting/v1/load'){assert.equal(init.method,'POST');assert.equal(body.query.timezone,undefined);return reply({data:[{'Sales.local_reporting_timestamp.month':'2025-06-01T00:00:00.000','Sales.location_id':'synthetic-location',...Object.fromEntries(body.query.measures.map(m=>[m,m.endsWith('order_count')?1:m.endsWith('net_sales')?7:0]))}]});}
  if(path==='/v2/orders/search'){
   assert.equal(init.method,'POST');assert.deepEqual(body.location_ids,['synthetic-location']);assert.equal(body.limit,100);
   if(body.query.filter.date_time_filter.updated_at.start_at.startsWith('2024-08-'))return reply({});
   if(body.query.filter.date_time_filter.updated_at.start_at==='2025-07-01T00:00:00Z'){const revised=order();revised.updated_at='2025-07-02T12:00:00Z';Object.assign(revised.line_items[0],{gross_sales_money:money(1000),total_tax_money:money(45),total_money:money(945)});revised.total_money=money(1045);return reply({orders:[revised]});}
   if(!body.cursor)return reply({orders:[order()],cursor:'synthetic-next'});
   assert.equal(body.cursor,'synthetic-next');return reply({orders:[order('synthetic-api-2','synthetic-pay-2','2025-06-02T20:30:00Z')]});
  }
  if(path==='/v2/refunds'){assert.equal(init.method,'GET');if(new URL(url).searchParams.get('updated_at_begin_time')?.startsWith('2024-08-'))return reply({});return reply({refunds:[{id:'synthetic-refund-report',payment_id:'synthetic-pay-2',order_id:'synthetic-api-2',location_id:'synthetic-location',status:'COMPLETED',amount_money:money(100),created_at:'2025-06-03T12:00:00Z',updated_at:'2025-06-04T12:00:00Z',reason:'EXCLUDED REFUND NOTE'}]});}
  throw Error('Unauthorized production Square operation in synthetic fixture');
 }
 if(url==='https://www.googleapis.com/oauth2/v3/certs')return reply({keys:[jwk]});
 if(url==='https://oauth2.googleapis.com/token'){const params=new URLSearchParams(init.body);assert.ok(params.get('code_verifier').length>=43);const supplied=JSON.parse(Buffer.from(params.get('code'),'base64url').toString());const claims={iss:'https://accounts.google.com',aud:'synthetic-google-client',exp:Math.floor(Date.now()/1000)+300,iat:Math.floor(Date.now()/1000),email_verified:true,...supplied};const signing=encode({alg:'RS256',kid:jwk.kid})+'.'+encode(claims);return reply({id_token:signing+'.'+sign('RSA-SHA256',Buffer.from(signing),identityKeys.privateKey).toString('base64url')});}
 if(!url.startsWith('https://connect.squareupsandbox.com/v2/'))return original(input,init);
 const path=new URL(url).pathname.slice(3),body=init?.body?JSON.parse(init.body):undefined;
 if(path==='/orders'&&body){
  const existing=keys.get('order:'+body.idempotency_key);if(existing)return reply({order:orders.get(existing)});
  const id='synthetic-square-order-'+(++sequence);let total=0;
  for(const line of body.order.line_items){const base=Number(line.quantity)*line.base_price_money.amount;total+=base;for(const tax of line.applied_taxes||[]){const rule=body.order.taxes.find(t=>t.uid===tax.tax_uid);total+=Math.floor((base*Number(rule.percentage)+50)/100);}}
  const o={...body.order,id,total_money:{amount:total,currency:'CAD'},tenders:[]};orders.set(id,o);keys.set('order:'+body.idempotency_key,id);return reply({order:o});
 }
 if(path.startsWith('/orders/'))return reply({order:orders.get(decodeURIComponent(path.slice(8)))});
 if(path==='/payments'&&body){
  const existing=keys.get('payment:'+body.idempotency_key);if(existing)return reply({payment:payments.get(existing)});
  if(body.source_id==='synthetic-decline')return reply({errors:[{code:'CARD_DECLINED',category:'PAYMENT_METHOD_ERROR'}]},400);
  const id='synthetic-square-payment-'+(++sequence),p={id,status:'COMPLETED',order_id:body.order_id,location_id:body.location_id,total_money:body.amount_money,amount_money:body.amount_money,created_at:new Date().toISOString()};
  payments.set(id,p);keys.set('payment:'+body.idempotency_key,id);orders.get(body.order_id).tenders.push({payment_id:id});
  if(body.source_id==='synthetic-lost-response')throw new TypeError('Synthetic provider response loss');
  return reply({payment:p});
 }
 if(path.startsWith('/payments/'))return reply({payment:payments.get(decodeURIComponent(path.slice(10)))});
 if(path==='/refunds'&&body){const p=payments.get(body.payment_id);if(p)p.refunded_money=body.amount_money;return reply({refund:{id:'synthetic-refund-'+body.idempotency_key,status:'COMPLETED',amount_money:body.amount_money}});}
 throw Error('Unexpected synthetic Square operation');
};
