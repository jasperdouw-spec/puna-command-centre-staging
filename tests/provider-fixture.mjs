// CI-only interception of outbound provider traffic. Never selected by application configuration.
import assert from 'node:assert/strict';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');assert.equal(process.env.DB_NAME,'puna_ci_synthetic');assert.equal(process.env.DB_HOST,'127.0.0.1');
import {generateKeyPairSync,sign} from 'node:crypto';
const identityKeys=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...identityKeys.publicKey.export({format:'jwk'}),kid:'synthetic-ci-key',alg:'RS256',use:'sig'};
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');

const original=globalThis.fetch,orders=new Map(),payments=new Map(),keys=new Map();let sequence=0;
const reply=(data,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}}));
globalThis.fetch=async function(input,init){
 const url=String(input instanceof Request?input.url:input);
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
