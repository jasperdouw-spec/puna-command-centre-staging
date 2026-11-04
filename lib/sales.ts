import 'server-only';
import {z} from 'zod';
import {referenceInput} from './reference-model';
export {referenceInput} from './reference-model';
import type {PoolConnection} from 'mysql2/promise';
import type {RowDataPacket} from 'mysql2';
import {database} from './db';
import {audit} from './commerce';
import {hash,previewCsv,SalesError,type CsvFile,type SalesLine} from './sales-model';

export async function salesTransaction<T>(fn:(c:PoolConnection)=>Promise<T>):Promise<T>{
 const c=await database().getConnection();let locked=false;
 try{
  const [r]=await c.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT(DATABASE(),':sales'),5) acquired");
  if(Number(r[0].acquired)!==1)throw new SalesError('REPORTING_BUSY_RETRY',409);locked=true;
  await c.query("SET time_zone='+00:00'");await c.beginTransaction();const out=await fn(c);await c.commit();return out;
 }catch(e){await c.rollback();throw e;}finally{if(locked)await c.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':sales'))");c.release();}
}
export async function reportingAvailable(){
 const [r]=await database().query<RowDataPacket[]>("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('sales_batches','sales_details','sales_stage','source_reference_versions','sales_connection','sales_runs','sales_api_orders','sales_mappings','sales_refunds','sales_revisions','sales_oauth_states','sales_report_snapshots')");
 return Number(r[0].n)===12;
}
export async function historicalSummary(){
 if(!await reportingAvailable())return [{records:0,period_start:null,period_end:null,gross_cents:null,discount_cents:null,net_cents:null,refund_cents:null,tax_cents:null,tip_cents:null,reporting_available:false}];
 const [rows]=await database().query<RowDataPacket[]>('SELECT COUNT(*) records,MIN(d.local_date) period_start,MAX(d.local_date) period_end,SUM(h.gross_cents) gross_cents,SUM(h.discount_cents) discount_cents,SUM(d.net_cents) net_cents,SUM(h.refund_cents) refund_cents,SUM(h.tax_cents) tax_cents,NULL tip_cents FROM historical_sales h JOIN sales_details d USING(source_key) WHERE d.included=1 AND h.is_test=0');return rows;
}
export async function prepareSales(actor:number,files:CsvFile[]){
 const p=previewCsv(files);
 return salesTransaction(async c=>{
  const [old]=await c.execute<RowDataPacket[]>('SELECT state,preview FROM sales_batches WHERE id=?',[p.id]);
  if(old.length)return {id:p.id,state:old[0].state,preview:JSON.parse(old[0].preview),existing:true};
  const hashes=[...new Set(p.stages.filter(r=>r.line).map(r=>r.rowHash))];let alreadyImported=0;
  for(let i=0;i<hashes.length;i+=500){const [r]=await c.query<RowDataPacket[]>('SELECT COUNT(*) n FROM historical_sales WHERE source_key IN (?)',[hashes.slice(i,i+500).map(h=>'csv:'+h)]);alreadyImported+=Number(r[0].n);}
  const [before]=await c.query<RowDataPacket[]>('SELECT COUNT(*) records,COALESCE(SUM(d.net_cents),0) net_cents FROM sales_details d JOIN historical_sales h USING(source_key) WHERE d.included=1 AND h.is_test=0');
  const preview={...p.preview,alreadyImported,newRows:p.preview.uniqueRows-alreadyImported,before:before[0]};
  await c.execute('INSERT INTO sales_batches(id,kind,manifest,preview,actor_id) VALUES(?,\'csv\',?,?,?)',[p.id,JSON.stringify(p.manifest),JSON.stringify(preview),actor]);
  for(let i=0;i<p.stages.length;i+=500){const values=p.stages.slice(i,i+500).map(r=>[p.id,r.ordinal,r.fileHash,r.sourceRow,r.rowHash,r.line?JSON.stringify(r.line):null,r.error]);await c.query('INSERT INTO sales_stage(batch_id,ordinal,file_hash,source_row,row_hash,payload,error_code) VALUES ?',[values]);}
  await audit(c,actor,'sales:preview','sales_batch',p.id);return {id:p.id,state:'preview',preview,existing:false};
 });
}
export async function insertSalesLines(c:PoolConnection,lines:Array<{key:string;line:SalesLine}>,source:'csv'|'api',batchId:string|null,merchantId:string|null,included=true){
 const unique=new Map(lines.map(l=>[l.key,l]));
 const mappings=new Map(lines.map(({line:l})=>[l.productKey,[l.productKey,l.item,l.variant,l.sku]]));
 for(let i=0;i<mappings.size;i+=500)await c.query('INSERT INTO sales_mappings(source_product_key,item_name,variant_name,sku) VALUES ? ON DUPLICATE KEY UPDATE source_product_key=VALUES(source_product_key)',[Array.from(mappings.values()).slice(i,i+500)]);
 const values=[...unique.values()];
 for(let i=0;i<values.length;i+=300){const chunk=values.slice(i,i+300);
  await c.query('INSERT INTO historical_sales(source_key,source_hash,sold_at,gross_cents,discount_cents,refund_cents,tax_cents,tip_cents,quantity,is_test,source_reference) VALUES ? ON DUPLICATE KEY UPDATE source_key=VALUES(source_key)',[chunk.map(({key,line:l})=>[key,l.rowHash,l.soldAt,l.grossCents,l.discountCents,l.refundCents,l.taxCents,0,l.quantity,0,source==='csv'?'batch:'+batchId:'square:order:'+l.orderId])]);
  await c.query('INSERT INTO sales_details(source_key,source_kind,batch_id,row_hash,merchant_id,transaction_id,payment_id,order_id,source_product_key,category_name,location_key,local_date,original_timestamp,source_timezone,timestamp_status,event_type,net_cents,included) VALUES ? ON DUPLICATE KEY UPDATE source_key=VALUES(source_key)',[chunk.map(({key,line:l})=>[key,source,batchId,l.rowHash,merchantId,l.transactionId,l.paymentId,l.orderId,l.productKey,l.category,l.location,l.localDate,l.originalTimestamp,l.timezone,l.timestampStatus,l.event,l.netCents,included?1:0])]);
 }
}
export async function commitSales(actor:number,id:string){
 try{return await salesTransaction(async c=>{
  const [batch]=await c.execute<RowDataPacket[]>('SELECT * FROM sales_batches WHERE id=? FOR UPDATE',[id]);
  const b=batch[0];if(!b||b.kind!=='csv')throw new SalesError('BATCH_NOT_FOUND',404);
  if(b.state==='complete')return {id,state:'complete',duplicate:true,preview:JSON.parse(b.preview)};
  const p=JSON.parse(b.preview);if(p.rejected)throw new SalesError('REJECTED_ROWS_REQUIRE_CORRECTED_FILE',409);
  const [rows]=await c.execute<RowDataPacket[]>('SELECT row_hash,payload FROM sales_stage WHERE batch_id=? ORDER BY ordinal',[id]);
  // One transaction publishes the whole batch. An interrupted request rolls back;
  // the persisted preview can be retried without resending originals.
  await insertSalesLines(c,rows.map(r=>({key:'csv:'+r.row_hash,line:JSON.parse(r.payload)})),'csv',id,null);
  // A later CSV upload can overlap already-refreshed API data. Quarantine API
  // orders over this observed interval until an owner reconciles source identity.
  await c.execute("UPDATE sales_api_orders o JOIN sales_details d ON d.order_id=o.id SET o.state='overlap',o.reason='CSV_RANGE_OVERLAP',o.version=o.version+1 WHERE d.source_kind='api' AND (d.local_date BETWEEN ? AND ? OR EXISTS(SELECT 1 FROM sales_details csv WHERE csv.source_kind='csv' AND csv.batch_id=? AND (csv.transaction_id=o.id OR (csv.payment_id<>'' AND csv.payment_id=d.payment_id)))) AND o.state='included'",[p.minDate,p.maxDate,id]);
  await c.execute("UPDATE sales_details d JOIN sales_api_orders o ON o.id=d.order_id SET d.included=0 WHERE d.source_kind='api' AND o.state<>'included'");
  await c.query("UPDATE sales_details csv JOIN sales_api_orders o ON JSON_CONTAINS(o.matched_csv,JSON_QUOTE(csv.transaction_id)) SET csv.included=1 WHERE csv.source_kind='csv' AND o.state='overlap'");
  const [after]=await c.query<RowDataPacket[]>('SELECT COUNT(*) records,COALESCE(SUM(d.net_cents),0) net_cents FROM sales_details d JOIN historical_sales h USING(source_key) WHERE d.included=1 AND h.is_test=0');
  const final={...p,after:after[0]};await c.execute("UPDATE sales_batches SET state='complete',completed_at=UTC_TIMESTAMP(3),failure_code=NULL,preview=? WHERE id=?",[JSON.stringify(final),id]);
  await audit(c,actor,'sales:import','sales_batch',id);return {id,state:'complete',duplicate:false,preview:final};
 });}catch(e){
  // No error message, SQL, row data, credentials, or provider body enters logs.
  if(!(e instanceof SalesError))await database().execute("UPDATE sales_batches SET state='failed',failure_code='IMPORT_ROLLED_BACK' WHERE id=? AND state<>'complete'",[id]);
  throw e;
 }
}
export async function mapSalesProduct(actor:number,key:string,productId:string|null,version:number){
 return salesTransaction(async c=>{
  if(productId){const [p]=await c.execute<RowDataPacket[]>('SELECT id FROM products WHERE id=?',[productId]);if(!p.length)throw new SalesError('PRODUCT_NOT_FOUND',404);}
  const [r]=await c.execute('UPDATE sales_mappings SET product_id=?,version=version+1,reviewed_by=?,reviewed_at=UTC_TIMESTAMP(3) WHERE source_product_key=? AND version=?',[productId,actor,key,version]);
  if(!(r as {affectedRows:number}).affectedRows)throw new SalesError('MAPPING_CHANGED',409);
  await audit(c,actor,'sales:map','sales_mapping',key);return {version:version+1};
 });
}
export async function prepareReferences(actor:number,items:z.infer<typeof referenceInput>[]){
 for(const item of items){
  const {sourceHash,observedAt,...data}=item;if(hash(JSON.stringify(data))!==sourceHash)throw new SalesError('REFERENCE_HASH_MISMATCH');
  if(item.columns.some(s=>/customer|card number|card token|email|phone|password|access token/i.test(s)))throw new SalesError('REFERENCE_PRIVATE_FIELDS');
 }
 const id=hash(JSON.stringify(['references-v1',items.map(i=>[i.sourceKey,i.sourceHash]).sort()]));
 return salesTransaction(async c=>{
  const [old]=await c.execute<RowDataPacket[]>('SELECT state,preview FROM sales_batches WHERE id=?',[id]);if(old.length)return {id,state:old[0].state,preview:JSON.parse(old[0].preview),existing:true};
  const preview={sources:items.map(i=>({title:i.title,kind:i.kind,rows:i.rows.length,issues:i.issues,hash:i.sourceHash})),state:'Source evidence only; unverified costs and yields cannot drive production.'};
  await c.execute("INSERT INTO sales_batches(id,kind,manifest,preview,actor_id) VALUES(?,'reference',?,?,?)",[id,JSON.stringify(items.map(i=>({sourceKey:i.sourceKey,sourceHash:i.sourceHash}))),JSON.stringify(preview),actor]);
  for(let i=0;i<items.length;i++)await c.execute('INSERT INTO sales_stage(batch_id,ordinal,file_hash,source_row,row_hash,payload) VALUES(?,?,?,?,?,?)',[id,i+1,items[i].sourceHash,1,items[i].sourceHash,JSON.stringify(items[i])]);
  await audit(c,actor,'reference:preview','sales_batch',id);return {id,state:'preview',preview};
 });
}
export async function commitReferences(actor:number,id:string){return salesTransaction(async c=>{
 const [bs]=await c.execute<RowDataPacket[]>('SELECT * FROM sales_batches WHERE id=? FOR UPDATE',[id]);if(!bs.length||bs[0].kind!=='reference')throw new SalesError('BATCH_NOT_FOUND',404);
 if(bs[0].state==='complete')return {id,state:'complete',duplicate:true};
 const [rs]=await c.execute<RowDataPacket[]>('SELECT payload FROM sales_stage WHERE batch_id=? ORDER BY ordinal',[id]);
 for(const r of rs){const i=referenceInput.parse(JSON.parse(r.payload));const key=hash(JSON.stringify([i.sourceKey,i.sourceHash]));
  await c.execute('INSERT IGNORE INTO source_reference_versions(id,source_key,source_hash,source_url,title,kind,observed_at,payload,batch_id,imported_by) VALUES(?,?,?,?,?,?,?,?,?,?)',[key,i.sourceKey,i.sourceHash,i.sourceUrl,i.title,i.kind,i.observedAt,JSON.stringify(i),id,actor]);
 }
 await c.execute("UPDATE sales_batches SET state='complete',completed_at=UTC_TIMESTAMP(3),failure_code=NULL WHERE id=?",[id]);await audit(c,actor,'reference:import','sales_batch',id);return {id,state:'complete',sources:rs.length};
});}

export const METRICS={gross:'Signed item gross sales, including negative returned item lines; excludes tax and tips.',discounts:'Signed deduction from gross to source net sales. A returned discount reverses the deduction.',net:'Source net sales in CAD cents, after item discounts and returns; excludes tax and tips. Not profit.',refunds:'Absolute net value of item return lines; already reflected in net sales. Never subtract again.',tax:'Signed item tax as supplied by the source, separate from revenue.',tips:'Unavailable in the historical item exports. API order tips remain at order grain, never allocated or multiplied across items.',cashRefunds:'Completed payment refund amounts, including any tax or tip portion. Reconciliation evidence only; never subtracted again from item net sales.',transactions:'Distinct source transaction IDs in the selected group. Counts across products/groups are not additive.',coverage:'Observed source dates only. Empty days/months are unknown unless a verified full API scan covers them.'};
export async function salesReport(from:string,to:string,group:'day'|'month'|'product'|'category'|'location'='month'){
 if(!await reportingAvailable())return {available:false,reason:'Reporting migration has not been applied.'};
 const db=database();
 const label={day:"DATE_FORMAT(d.local_date,'%Y-%m-%d')",month:"DATE_FORMAT(d.local_date,'%Y-%m')",product:"CONCAT(m.item_name,IF(m.variant_name='', '',CONCAT(' · ',m.variant_name)))",category:"COALESCE(cp.category,NULLIF(d.category_name,''),'Unspecified')",location:'d.location_key'}[group];
 const key=group==='product'?'d.source_product_key':label;
 const base='FROM historical_sales h JOIN sales_details d USING(source_key) JOIN sales_mappings m USING(source_product_key) LEFT JOIN commerce_products cp ON cp.product_id=m.product_id WHERE h.is_test=0 AND d.included=1 AND d.local_date BETWEEN ? AND ?';
 const sums='COUNT(*) records,COUNT(DISTINCT d.transaction_id) transactions,SUM(h.gross_cents) gross_cents,SUM(h.discount_cents) discount_cents,SUM(d.net_cents) net_cents,SUM(h.refund_cents) refund_cents,SUM(h.tax_cents) tax_cents,SUM(h.quantity) quantity';
 const [totals]=await db.execute<RowDataPacket[]>('SELECT '+sums+',MIN(d.local_date) period_start,MAX(d.local_date) period_end '+base,[from,to]);
 const [groups]=await db.execute<RowDataPacket[]>(`SELECT ${key} group_key,${label} label,${sums} ${base} GROUP BY ${key},${label} ORDER BY ${key} LIMIT 400`,[from,to]);
 const [coverage]=await db.query<RowDataPacket[]>("SELECT DATE_FORMAT(d.local_date,'%Y-%m') month,MIN(d.local_date) first_date,MAX(d.local_date) last_date,COUNT(DISTINCT d.local_date) observed_days,COUNT(*) records FROM sales_details d JOIN historical_sales h USING(source_key) WHERE d.included=1 AND h.is_test=0 GROUP BY month ORDER BY month");
 const [batches]=await db.query<RowDataPacket[]>('SELECT id,kind,state,manifest,preview,created_at,completed_at,failure_code FROM sales_batches ORDER BY created_at DESC LIMIT 30');
 const [mappings]=await db.query<RowDataPacket[]>('SELECT m.*,COUNT(d.source_key) records FROM sales_mappings m LEFT JOIN sales_details d USING(source_product_key) GROUP BY m.source_product_key ORDER BY (m.product_id IS NULL) DESC,m.item_name LIMIT 500');
 const [unresolved]=await db.query<RowDataPacket[]>('SELECT COUNT(*) n FROM sales_mappings WHERE product_id IS NULL');
 const [products]=await db.query('SELECT id,name FROM products ORDER BY name');
 const [conflicts]=await db.query<RowDataPacket[]>("SELECT id,state,reason,version,content_hash,matched_csv,payload FROM sales_api_orders WHERE state IN ('overlap','unsupported') ORDER BY updated_at DESC LIMIT 100");
 const [snapshots]=await db.query<RowDataPacket[]>('SELECT id,profile,start_date,end_date,payload,fetched_at FROM sales_report_snapshots ORDER BY fetched_at DESC LIMIT 10');
 const [connection]=await db.query<RowDataPacket[]>('SELECT merchant_id,identity,verified_at,last_success,last_attempt,failure_code,watermark FROM sales_connection WHERE id=1');
 const [runs]=await db.query<RowDataPacket[]>('SELECT id,kind,state,start_at,end_at,phase,pages,records,failure_code,started_at,completed_at FROM sales_runs ORDER BY started_at DESC LIMIT 20');
 const [legacy]=await db.query<RowDataPacket[]>('SELECT COUNT(*) n FROM historical_sales h LEFT JOIN sales_details d USING(source_key) WHERE d.source_key IS NULL AND h.is_test=0');
 const [refunds]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) records,SUM(amount_cents) cash_refund_cents FROM sales_refunds WHERE status='COMPLETED' AND local_date BETWEEN ? AND ?",[from,to]);
 return {available:true,from,to,group,totals:totals[0],groups,groupLimit:400,coverage,coverageComplete:false,metrics:METRICS,currency:'CAD',timezone:'America/Vancouver',tipsCents:null,paymentTotalsCents:null,snapshots:snapshots.map(s=>({...s,payload:JSON.parse(s.payload)})),
  batches:batches.map(b=>({...b,manifest:JSON.parse(b.manifest),preview:JSON.parse(b.preview)})),mappings,unresolvedMappings:Number(unresolved[0].n),products,conflicts:await Promise.all(conflicts.map(async c=>{const p=JSON.parse(c.payload);const [matched]=await db.query<RowDataPacket[]>("SELECT DISTINCT transaction_id FROM sales_details WHERE source_kind='csv' AND (transaction_id=? OR payment_id IN (?))",[c.id,p.paymentIds.length?p.paymentIds:['']]);const ids=matched.map(m=>m.transaction_id);const [csv]=await db.query<RowDataPacket[]>("SELECT COUNT(*) records,COALESCE(SUM(net_cents),0) net_cents FROM sales_details WHERE source_kind='csv' AND transaction_id IN (?)",[ids.length?ids:['']]);const {payload,...safe}=c;return {...safe,matched_csv:ids,csv:csv[0],api:{records:p.lines.length,net_cents:p.lines.reduce((n:number,l:any)=>n+l.line.netCents,0)}};})),connection:connection[0]?{...connection[0],identity:JSON.parse(connection[0].identity)}:null,runs,unclassifiedLegacyRows:Number(legacy[0].n),cashRefunds:refunds[0]};
}
export async function referenceRecords(){if(!await reportingAvailable())return [];
 const [rows]=await database().query<RowDataPacket[]>('SELECT r.* FROM source_reference_versions r ORDER BY kind,title,observed_at DESC,id DESC LIMIT 200');
 return rows.map(r=>({...r,payload:JSON.parse(r.payload)}));
}
