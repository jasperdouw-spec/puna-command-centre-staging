import 'server-only';
import {randomUUID} from 'node:crypto';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {database} from './db';
import {transaction,sqlDate,digest,audit} from './commerce';
import {CommerceError} from './commerce-model';
import {SalesError} from './sales-model';
import {squareAccess,squareRead,verifySquareIdentity,withSquareDeadline,reportingConfig} from './square-reporting';
import {verifySignature} from './square';
import {CATALOG_TYPES,CATALOG_POLL_MS,CATALOG_MAX_AGE_MS,flattenCatalog,catalogVariations,catalogHash,suggestedVariations,commercialIssue,type CatalogObject} from './square-catalog-model';

const iso=(v:unknown)=>v?new Date(v as string).toISOString():null;
function fail(code:string):never{throw new CommerceError(code)}
async function history(c:PoolConnection,product:string|null,actor:number|null,action:string,snapshot:unknown,now:number){await c.execute('INSERT INTO square_catalog_history(product_id,actor_id,action,snapshot,created_at) VALUES(?,?,?,?,?)',[product,actor,action,JSON.stringify(snapshot),sqlDate(now)]);await audit(c,actor,'catalog:'+action,product?'product':'square_catalog',product||'1');}
async function readObjects(c:PoolConnection){const [r]=await c.query<RowDataPacket[]>('SELECT payload FROM square_catalog_objects ORDER BY object_id');return r.map(o=>JSON.parse(o.payload)) as CatalogObject[];}
async function applyLinks(c:PoolConnection,state:RowDataPacket,actor:number|null,now:number){
 const variants=catalogVariations(await readObjects(c),state.location_id||'');
 const [links]=await c.query<RowDataPacket[]>('SELECT l.*,p.price_cents,p.version,u.draft FROM square_catalog_links l JOIN products p ON p.id=l.product_id LEFT JOIN product_menu u ON u.product_id=p.id FOR UPDATE');
 for(const l of links){
  const v=variants.find(v=>v.id===l.variation_id);
  const status=!state.location_verified_at||state.location_id!==l.location_id||state.merchant_id!==l.merchant_id?'location_unverified':!v?'missing':v.itemId!==l.item_id?'parent_changed':v.status;
  const price=status==='verified'?v!.priceCents:null;
  const changed=l.status!==status||l.commercial_hash!==v?.commercialHash||price!==null&&Number(l.price_cents)!==price;
  const tax=v?.taxes?JSON.stringify(v.taxes.map(t=>({...t,deposit_taxable:!!l.deposit_taxable}))):null;
  // Keep the last verified price if Square removes/archives/invalidates the item.
  await c.execute('UPDATE square_catalog_links SET status=?,verified_price_cents=COALESCE(?,verified_price_cents),verified_at=IF(?=\'verified\',?,verified_at),commercial_hash=?,configuration_hash=?,tax_snapshot=? WHERE product_id=?',[status,price,status,sqlDate(now),v?.commercialHash||null,v?.configurationHash||null,tax,l.product_id]);
  if(changed){
   await history(c,l.product_id,actor,'provider-sync',{previous:{priceCents:Number(l.price_cents),status:l.status,commercialHash:l.commercial_hash},current:{priceCents:price,status,variation:v||null}},now);
   await c.execute('UPDATE products SET price_cents=COALESCE(?,price_cents),version=version+1 WHERE id=?',[price,l.product_id]);
   // A price-only provider update must not discard an owner's unsaved description/photo draft.
   if(l.draft&&price!==null){const draft=JSON.parse(l.draft);draft.priceCents=price;await c.execute('UPDATE product_menu SET draft=? WHERE product_id=?',[JSON.stringify(draft),l.product_id]);}
   const reviewed=!!l.review_hash&&l.review_hash===v?.configurationHash&&tax!==null;
   await c.execute('UPDATE commerce_products SET price_confirmed=?,tax_rules=?,deposit_cents=?,version=version+1 WHERE product_id=?',[status==='verified',reviewed?tax:null,reviewed?l.deposit_cents:null,l.product_id]);
  }
 }
}

export async function syncSquareCatalog(actor:number|null,force=false){return withSquareDeadline(async()=>{
 const lock=await database().getConnection();let acquired=false,runId:string|null=null;
 try{
  const [r]=await lock.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT(DATABASE(),':catalog-sync'),0) acquired");if(Number(r[0].acquired)!==1)return {busy:true};acquired=true;
  const [states]=await lock.query<RowDataPacket[]>('SELECT * FROM square_catalog_state WHERE id=1');const state=states[0];
  if(!force&&state.last_success_at&&Date.now()-new Date(state.last_success_at).getTime()<CATALOG_POLL_MS&&(!state.requested_at||new Date(state.requested_at)<=new Date(state.last_success_at)))return {skipped:true};
  const full=force||!state.last_full_at||Date.now()-new Date(state.last_full_at).getTime()>86400000;
  runId=randomUUID();await lock.execute("INSERT INTO square_catalog_runs(id,mode,status,started_at,actor_id) VALUES(?,?,'running',UTC_TIMESTAMP(3),?)",[runId,full?'full':'incremental',actor]);
  const {token}=await squareAccess(),identity=await verifySquareIdentity(token);
  const locations=(await squareRead('/v2/locations',token)).locations;
  if(!Array.isArray(locations))fail('SQUARE_LOCATIONS_INCOMPLETE');
  // Store discovery even when a permission upgrade is still needed. Never select a location automatically.
  await transaction(async c=>{const [s]=await c.query<RowDataPacket[]>('SELECT merchant_id FROM square_catalog_state WHERE id=1');if(s[0].merchant_id&&s[0].merchant_id!==identity.merchantId)fail('SQUARE_MERCHANT_MISMATCH');await c.execute('UPDATE square_catalog_state SET merchant_id=?,locations_json=? WHERE id=1',[identity.merchantId,JSON.stringify(locations.map((l:any)=>({id:l.id,name:l.name,address:l.address||null,status:l.status,country:l.country,currency:l.currency,timezone:l.timezone,merchantId:l.merchant_id||identity.merchantId}))) ]);});
  await database().execute('UPDATE sales_connection SET identity=?,verified_at=UTC_TIMESTAMP(3) WHERE id=1 AND merchant_id=?',[JSON.stringify(identity),identity.merchantId]);
  if(!identity.scopes.includes('ITEMS_READ'))fail('SQUARE_ITEMS_READ_REQUIRED');
  const started=Date.now(),objects:CatalogObject[]=[],seen=new Set<string>();let cursor:string|undefined,watermark:string|undefined;
  do{
   const response=await squareRead('/v2/catalog/search',token,{object_types:CATALOG_TYPES,include_deleted_objects:true,limit:100,...(!full&&state.last_success_at?{begin_time:state.provider_watermark||new Date(0).toISOString()}:{}),...(cursor?{cursor}:{})});
   if(typeof response.latest_time!=='string'||!Number.isFinite(Date.parse(response.latest_time)))fail('SQUARE_WATERMARK_MISSING');
   if(!watermark||Date.parse(response.latest_time)<Date.parse(watermark))watermark=response.latest_time;
   if(response.objects!==undefined&&!Array.isArray(response.objects))fail('SQUARE_CATALOG_INCOMPLETE');objects.push(...response.objects||[]);
   if(objects.length>10000)fail('SQUARE_CATALOG_LIMIT');
   cursor=response.cursor;if(cursor&&(typeof cursor!=='string'||cursor.length>10000||seen.has(cursor)))fail('SQUARE_CURSOR_INVALID');if(cursor)seen.add(cursor);
  }while(cursor);
  const flat=flattenCatalog(objects);
  await transaction(async(c,now)=>{
   const [s]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_state WHERE id=1 FOR UPDATE');
   if(s[0].merchant_id!==identity.merchantId)fail('SQUARE_MERCHANT_MISMATCH');
   // Full snapshots retain tombstones for missing objects; historical relationships are never removed.
   const old=await readObjects(c),present=new Set(flat.map(o=>o.id));
   if(full)for(const o of old)if(!present.has(o.id)){o.is_deleted=true;await c.execute('UPDATE square_catalog_objects SET payload=?,observed_at=? WHERE object_id=?',[JSON.stringify(o),sqlDate(now),o.id]);}
   for(const o of flat){const prior=old.find(p=>p.id===o.id);if(prior&&prior.version>o.version)continue;if(prior&&prior.version===o.version&&!prior.is_deleted&&catalogHash(prior)!==catalogHash(o))fail('SQUARE_OBJECT_VERSION_CONFLICT');await c.execute('INSERT INTO square_catalog_objects(object_id,object_type,provider_version,payload,observed_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE object_type=VALUES(object_type),provider_version=VALUES(provider_version),payload=VALUES(payload),observed_at=VALUES(observed_at)',[o.id,o.type,o.version,JSON.stringify(o),sqlDate(now)]);}
   const activeLocation=locations.find((l:any)=>l.id===s[0].location_id&&l.status==='ACTIVE'&&l.currency==='CAD'&&l.country==='CA'&&l.timezone==='America/Vancouver');
   if(s[0].location_id&&!activeLocation){s[0].location_verified_at=null;await c.execute('UPDATE square_catalog_state SET location_verified_at=NULL WHERE id=1');}
   await applyLinks(c,s[0],actor,now);
   await c.execute('UPDATE square_catalog_state SET pickup_address_matches=? WHERE id=1',[/^ucluelet$/i.test(activeLocation?.address?.locality||'')]);
   await c.execute('UPDATE square_catalog_state SET last_success_at=?,provider_watermark=?,last_full_at=IF(?,?,last_full_at),failure_code=NULL,generation=generation+1 WHERE id=1',[sqlDate(started),watermark!,full,sqlDate(started)]);
   await c.execute("UPDATE square_catalog_runs SET status='complete',completed_at=?,object_count=? WHERE id=?",[sqlDate(now),flat.length,runId]);
  });
  return {ok:true,objects:flat.length,mode:full?'full':'incremental'};
 }catch(e){
  const code=e instanceof SalesError||e instanceof CommerceError?e.code:/^SQUARE_[A-Z_]+$/.test((e as Error).message)?(e as Error).message:'SQUARE_CATALOG_SYNC_FAILED';
  await database().execute('UPDATE square_catalog_state SET failure_code=? WHERE id=1',[code]);if(runId)await database().execute("UPDATE square_catalog_runs SET status='failed',failure_code=?,completed_at=UTC_TIMESTAMP(3) WHERE id=?",[code,runId]);throw new CommerceError(code,503);
 }finally{if(acquired)await lock.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':catalog-sync'))");lock.release();}
});}

export async function ownerCatalog(){return transaction(async(c,now)=>{
 const [s]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_state WHERE id=1'),state=s[0];
 const [l]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_links');
 const [p]=await c.query<RowDataPacket[]>('SELECT id,name,version FROM products ORDER BY name');
 const [h]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_history ORDER BY id DESC LIMIT 100');
 const [runs]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_runs ORDER BY started_at DESC LIMIT 12');
 const [connections]=await c.query<RowDataPacket[]>('SELECT identity FROM sales_connection WHERE id=1');
 const scopes=connections[0]?.identity?JSON.parse(connections[0].identity).scopes:[];
 const variants=catalogVariations(await readObjects(c),state.location_id||'');
 return {state:{...state,last_success_at:iso(state.last_success_at),last_full_at:iso(state.last_full_at),location_verified_at:iso(state.location_verified_at),locations:JSON.parse(state.locations_json||'[]'),locations_json:undefined},scopes,stale:!state.last_success_at||now-new Date(state.last_success_at).getTime()>CATALOG_MAX_AGE_MS,
  schedulerEnabled:process.env.PUNA_REPORTING_SCHEDULE_ENABLED==='true'&&process.env.PUNA_CATALOG_ENABLED!=='false',products:p.map(p=>{const link=l.find(l=>l.product_id===p.id);return {...p,link:link?{...link,verified_at:iso(link.verified_at),tax_snapshot:link.tax_snapshot?JSON.parse(link.tax_snapshot):null}:null,issue:commercialIssue(link,state,now),suggestions:suggestedVariations(p.id,p.name,variants)};}),variants,history:h.map(h=>({...h,snapshot:JSON.parse(h.snapshot),created_at:iso(h.created_at)})),runs};
});}
export type CatalogCommand={action:'location'|'map'|'review';key:string;generation:number;locationId?:string;note?:string;productId?:string;variationId?:string;version?:number;commercialHash?:string;depositCents?:number;depositTaxable?:boolean};
export async function changeCatalog(actor:number,p:CatalogCommand){return transaction(async(c,now)=>{
 const fingerprint=digest(JSON.stringify(p)),[old]=await c.execute<RowDataPacket[]>('SELECT * FROM menu_operations WHERE operation_key=?',[p.key]);if(old[0]){if(Number(old[0].actor_id)!==actor||old[0].request_hash!==fingerprint)fail('ACTION_CONFLICT');return JSON.parse(old[0].result);}
 const [s]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_state WHERE id=1 FOR UPDATE');const state=s[0];if(Number(state.generation)!==p.generation)fail('Catalog changed. Reload before confirming.');
 if(!state.merchant_id)fail('Verify the Square connection first.');
 if(p.action==='location'){
  const location=JSON.parse(state.locations_json||'[]').find((l:any)=>l.id===p.locationId);
  if(!location||location.status!=='ACTIVE'||location.currency!=='CAD'||location.country!=='CA'||location.timezone!=='America/Vancouver'||location.merchantId!==state.merchant_id)fail('Square location is not eligible.');
  if(!p.note||p.note.trim().length<20)fail('Record how this Square location relates to the Ucluelet pickup truck.');
  await c.execute('UPDATE square_catalog_state SET location_id=?,location_verified_at=?,location_verified_by=?,location_note=?,pickup_address_matches=?,generation=generation+1 WHERE id=1',[p.locationId!,sqlDate(now),actor,p.note!,/^ucluelet$/i.test(location.address?.locality||'')]);
  await history(c,null,actor,'location-reviewed',{previous:state.location_id,location,note:p.note},now);
  await applyLinks(c,{...state,location_id:p.locationId,location_verified_at:sqlDate(now)},actor,now);
 }else{
  if(!state.location_verified_at||state.failure_code||!state.last_success_at||now-new Date(state.last_success_at).getTime()>CATALOG_MAX_AGE_MS)fail('Synchronize Square and verify the Square POS location mapping first.');
  const [products]=await c.execute<RowDataPacket[]>('SELECT * FROM products WHERE id=? FOR UPDATE',[p.productId!]);const product=products[0];if(!product||Number(product.version)!==p.version)fail('Product changed. Reload before mapping.');
  const [links]=await c.execute<RowDataPacket[]>('SELECT * FROM square_catalog_links WHERE product_id=?',[p.productId!]);const link=links[0];
  const v=catalogVariations(await readObjects(c),state.location_id).find(v=>v.id===(p.action==='map'?p.variationId:link?.variation_id));
  if(!v||v.status!=='verified')fail('Choose an active, fixed CAD price at the verified location.');
  if(p.action==='map'){
   if(link&&(link.variation_id!==v.id||link.location_id!==state.location_id))fail('Existing links require a reviewed remapping migration. Create a separate special for a new identity.');
   const [used]=await c.execute<RowDataPacket[]>('SELECT product_id FROM square_catalog_links WHERE variation_id=? AND product_id<>?',[v.id,p.productId!]);if(used.length)fail('This Square variation already belongs to another product.');
   await c.execute('INSERT INTO square_catalog_links(product_id,variation_id,item_id,merchant_id,location_id,mapped_by,mapped_at) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE mapped_by=VALUES(mapped_by)',[p.productId!,v.id,v.itemId,state.merchant_id,state.location_id,actor,sqlDate(now)]);
   await c.execute('INSERT INTO product_menu(product_id,square_candidate) VALUES(?,?) ON DUPLICATE KEY UPDATE square_candidate=VALUES(square_candidate)',[p.productId!,v.id]);
   await history(c,p.productId!,actor,'mapping-confirmed',{itemId:v.itemId,variationId:v.id,locationId:state.location_id,name:v.name,variation:v.variationName},now);await applyLinks(c,state,actor,now);
  }else{
   if(!link||v.commercialHash!==p.commercialHash||v.taxWarning||v.modifierIds.length)fail('Commercial setup changed or uses unsupported taxes/modifiers. Provider-level review required.');
   if(!p.note||p.note.trim().length<20||p.depositCents===undefined||p.depositTaxable===undefined)fail('Record a verified deposit/tax source before approval.');
   const taxes=v.taxes!.map(t=>({...t,deposit_taxable:p.depositTaxable}));
   await c.execute('UPDATE square_catalog_links SET review_hash=?,deposit_cents=?,deposit_taxable=?,review_note=? WHERE product_id=?',[v.configurationHash,p.depositCents!,p.depositTaxable!,p.note!,p.productId!]);
   await c.execute('UPDATE commerce_products SET tax_rules=?,deposit_cents=?,version=version+1 WHERE product_id=?',[JSON.stringify(taxes),p.depositCents,p.productId!]);await c.execute('UPDATE products SET version=version+1 WHERE id=?',[p.productId!]);
   await history(c,p.productId!,actor,'commercial-reviewed',{variationId:v.id,hash:v.commercialHash,taxes,depositCents:p.depositCents,note:p.note},now);
  }
  await c.execute('UPDATE square_catalog_state SET generation=generation+1 WHERE id=1');
 }
 const result={ok:true};await c.execute('INSERT INTO menu_operations(operation_key,actor_id,request_hash,result) VALUES(?,?,?,?)',[p.key,actor,fingerprint,JSON.stringify(result)]);return result;
});}

export async function catalogWebhook(raw:string,signature:string|null){
 const key=process.env.SQUARE_CATALOG_WEBHOOK_SIGNATURE_KEY,url=process.env.SQUARE_CATALOG_WEBHOOK_URL;
 if(!key||!url||!verifySignature(raw,signature,url,key))throw new CommerceError('INVALID_SIGNATURE',403);
 const e=JSON.parse(raw);if(e.type!=='catalog.version.updated'||e.merchant_id!==reportingConfig().merchant||typeof e.event_id!=='string'||e.event_id.length>150||!Number.isFinite(Date.parse(e.data?.object?.catalog_version?.updated_at)))throw new CommerceError('INVALID_EVENT',400);
 return transaction(async(c,now)=>{const [old]=await c.execute<RowDataPacket[]>('SELECT body_hash FROM square_catalog_events WHERE event_id=?',[e.event_id]);if(old.length){if(old[0].body_hash!==digest(raw))fail('EVENT_CONFLICT');return {duplicate:true};}await c.execute('INSERT INTO square_catalog_events(event_id,body_hash,received_at) VALUES(?,?,?)',[e.event_id,digest(raw),sqlDate(now)]);await c.execute('UPDATE square_catalog_state SET requested_at=? WHERE id=1',[sqlDate(now)]);return {accepted:true};});
}

export async function revalidateCatalogPrices(ids:string[],expected?:Map<string,number>){
 const result=await syncSquareCatalog(null,true);if('busy' in result)throw new CommerceError('PRICE_CHECK_BUSY_RETRY',503);
 return transaction(async(c,now)=>{const [states]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_state WHERE id=1');const [links]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_links WHERE product_id IN (?)',[ids]);
 for(const id of ids){const link=links.find(l=>l.product_id===id),issue=commercialIssue(link,states[0],now);if(issue)throw new CommerceError(issue);if(expected&&Number(link!.verified_price_cents)!==expected.get(id))throw new CommerceError('PRICES_CHANGED_REVIEW_BAG');}
 });
}
