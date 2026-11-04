import 'server-only';
import {randomUUID} from 'node:crypto';
import type {PoolConnection} from 'mysql2/promise';
import type {RowDataPacket} from 'mysql2';
import {database} from './db';
import {audit} from './commerce';
import {SalesError,hash,localDay} from './sales-model';
import {salesTransaction,insertSalesLines} from './sales';
import {squareAccess,squareRead,verifySquareIdentity,reportingConfig,withSquareDeadline} from './square-reporting';
import {normalizeSquareOrder,normalizeRefund} from './square-reporting-model';

async function csvMatches(c:PoolConnection,order:ReturnType<typeof normalizeSquareOrder>['payload']){
 const [matches]=await c.query<RowDataPacket[]>("SELECT DISTINCT transaction_id FROM sales_details WHERE source_kind='csv' AND (transaction_id=? OR payment_id IN (?))",[order.id,order.paymentIds.length?order.paymentIds:['']]);
 return matches.map(m=>m.transaction_id as string);
}
async function storeOrder(c:PoolConnection,raw:Record<string,any>,run:string,actor:number|null,merchant:string){
 const n=normalizeSquareOrder(raw),p=n.payload;
 if(!reportingConfig().locations.includes(p.locationId))throw new SalesError('SQUARE_LOCATION_MISMATCH',409);
 const [old]=await c.execute<RowDataPacket[]>('SELECT * FROM sales_api_orders WHERE id=? FOR UPDATE',[p.id]);
 if(old[0]&&Date.parse(old[0].updated_at)>Date.parse(p.updatedAt))return;
 if(old[0]?.content_hash===n.contentHash)return;
 const matches=await csvMatches(c,p);
 const [range]=await c.execute<RowDataPacket[]>("SELECT COUNT(*) n FROM sales_details WHERE source_kind='csv' AND ? BETWEEN (SELECT MIN(local_date) FROM sales_details WHERE source_kind='csv') AND (SELECT MAX(local_date) FROM sales_details WHERE source_kind='csv') LIMIT 1",[p.localDate]);
 const overlap=matches.length>0||Number(range[0].n)>0;
 const state=n.reason?'unsupported':overlap?'overlap':'included',reason=n.reason||(overlap?'CSV_IDENTITY_OR_PERIOD_OVERLAP':null);
 if(old.length)await c.execute('INSERT INTO sales_revisions(entity_key,content_hash,payload,actor_id) VALUES(?,?,?,?)',[p.id,old[0].content_hash,old[0].payload,actor]);
 // Deactivate old revisions, retain their immutable financial rows and audit.
 await c.execute("UPDATE sales_details SET included=0 WHERE source_kind='api' AND order_id=?",[p.id]);
 // A changed API record invalidates an earlier source choice. Restore its CSV
 // counterpart until the changed API evidence has been reviewed again.
 if(overlap&&matches.length)await c.query("UPDATE sales_details SET included=1 WHERE source_kind='csv' AND transaction_id IN (?)",[matches]);
 await c.execute('INSERT INTO sales_api_orders(id,merchant_id,updated_at,content_hash,payload,state,reason,matched_csv,run_id) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at),content_hash=VALUES(content_hash),payload=VALUES(payload),state=VALUES(state),reason=VALUES(reason),matched_csv=VALUES(matched_csv),run_id=VALUES(run_id),version=version+1',[p.id,merchant,p.updatedAt,n.contentHash,JSON.stringify(p),state,reason,JSON.stringify(matches),run]);
 if(p.lines.length)await insertSalesLines(c,p.lines.map(l=>({key:'api:'+hash(l.key+':'+n.contentHash),line:l.line})),'api',null,merchant,state==='included');
 // Replayed historical revision might already exist but have been deactivated.
 if(state==='included')for(const line of p.lines)await c.execute('UPDATE sales_details SET included=1 WHERE source_key=?',['api:'+hash(line.key+':'+n.contentHash)]);
 await audit(c,actor,'sales:api-revision','square_order',p.id);
}
export async function createSalesRun(actor:number|null,kind:'refresh'|'backfill',start?:string,end?:string){
 reportingConfig();
 return salesTransaction(async c=>{
  const [active]=await c.query<RowDataPacket[]>("SELECT id,state FROM sales_runs WHERE state<>'complete' ORDER BY started_at LIMIT 1");
  if(active.length)return {id:active[0].id,state:active[0].state,resumed:true};
  const [conn]=await c.query<RowDataPacket[]>('SELECT watermark FROM sales_connection WHERE id=1');if(!conn.length)throw new SalesError('SQUARE_PRIVATE_AUTHORIZATION_REQUIRED',409);
  const latest=new Date(Date.now()-15*60000).toISOString();
  if(kind==='refresh'){
   start=conn[0].watermark?new Date(Date.parse(conn[0].watermark)-72*3600000).toISOString():process.env.SQUARE_REPORTING_START_AT;
   if(!start)throw new SalesError('SQUARE_HISTORY_START_REQUIRED',409);
   end=new Date(Math.min(Date.parse(latest),Date.parse(start)+7*86400000)).toISOString();
  }
  if(!start||!end||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(start)>=Date.parse(end)||Date.parse(end)>Date.parse(latest)||Date.parse(end)-Date.parse(start)>31*86400000)throw new SalesError('BOUNDED_PAST_WINDOW_REQUIRED');
  localDay(start);localDay(end);const id=randomUUID();
  await c.execute("INSERT INTO sales_runs(id,kind,state,start_at,end_at,actor_id) VALUES(?,?,'pending',?,?,?)",[id,kind,start,end,actor]);await audit(c,actor,'sales:run-created','sales_run',id);return {id,state:'pending',resumed:false};
 });
}
export async function advanceSalesRun(actor:number|null,id:string){return withSquareDeadline(()=>advanceBoundedSalesRun(actor,id));}
async function advanceBoundedSalesRun(actor:number|null,id:string){
 const lease=await database().getConnection();let locked=false;
 try{
  const [l]=await lease.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT(DATABASE(),':sales-run'),0) acquired");if(Number(l[0].acquired)!==1)throw new SalesError('REFRESH_BUSY',409);locked=true;
  const [rs]=await database().execute<RowDataPacket[]>('SELECT * FROM sales_runs WHERE id=?',[id]);const run=rs[0];if(!run)throw new SalesError('RUN_NOT_FOUND',404);if(run.state==='complete')return {id,state:'complete',duplicate:true};
  if(Number(run.pages)>=10000)throw new SalesError('BACKFILL_PAGE_LIMIT',409);
  await database().execute("UPDATE sales_runs SET state='running',failure_code=NULL WHERE id=?",[id]);await database().query('UPDATE sales_connection SET last_attempt=UTC_TIMESTAMP(3) WHERE id=1');
  const {token}=await squareAccess(),identity=await verifySquareIdentity(token);
  await database().execute('UPDATE sales_connection SET verified_at=UTC_TIMESTAMP(3) WHERE id=1');
  // One bounded provider page per request. A scheduler or owner continues the
  // persisted cursor. Cursor and accepted records commit in the same transaction.
  let response:any;
  if(run.phase==='orders')response=await squareRead('/v2/orders/search',token,{location_ids:identity.locations.map((l:any)=>l.id),limit:100,...(run.checkpoint_cursor?{cursor:run.checkpoint_cursor}:{}),query:{filter:{date_time_filter:{updated_at:{start_at:run.start_at,end_at:run.end_at}}},sort:{sort_field:'UPDATED_AT',sort_order:'ASC'}}});
  else{
   const q=new URLSearchParams({begin_time:'1970-01-01T00:00:00Z',end_time:run.end_at,updated_at_begin_time:run.start_at,updated_at_end_time:run.end_at,sort_field:'UPDATED_AT',sort_order:'ASC',limit:'100',location_id:identity.locations[Number(run.location_index)].id});if(run.checkpoint_cursor)q.set('cursor',run.checkpoint_cursor);response=await squareRead('/v2/refunds?'+q,token);
  }
  const cursor=response.cursor||null;if(cursor===run.checkpoint_cursor&&cursor)throw new SalesError('SQUARE_CURSOR_STALLED',409);
  return await salesTransaction(async c=>{
   if(run.phase==='orders')for(const order of response.orders||[])await storeOrder(c,order,id,actor,identity.merchantId);
   else for(const raw of response.refunds||[]){const r=normalizeRefund(raw);if(!identity.locations.some((l:any)=>l.id===r.locationId))throw new SalesError('SQUARE_LOCATION_MISMATCH',409);
    const [old]=await c.execute<RowDataPacket[]>('SELECT * FROM sales_refunds WHERE id=?',[r.id]);
    if(old[0]&&Date.parse(old[0].updated_at)>Date.parse(r.updatedAt))continue;
    if(old[0]&&(old[0].updated_at!==r.updatedAt||old[0].status!==r.status))await c.execute('INSERT INTO sales_revisions(entity_key,content_hash,payload,actor_id) VALUES(?,?,?,?)',[r.id,hash(JSON.stringify(old[0])),JSON.stringify(old[0]),actor]);
    await c.execute('INSERT INTO sales_refunds(id,payment_id,order_id,location_id,status,amount_cents,created_at,updated_at,local_date,run_id) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),amount_cents=VALUES(amount_cents),updated_at=VALUES(updated_at),run_id=VALUES(run_id)',[r.id,r.paymentId,r.orderId,r.locationId,r.status,r.amountCents,r.createdAt,r.updatedAt,r.localDate,id]);
   }
   let phase=run.phase,locationIndex=Number(run.location_index),complete=false;
   if(!cursor){if(phase==='orders')phase='refunds';else if(locationIndex+1<identity.locations.length)locationIndex++;else complete=true;}
   await c.execute('UPDATE sales_runs SET state=?,phase=?,checkpoint_cursor=?,location_index=?,pages=pages+1,records=records+?,completed_at=IF(?,UTC_TIMESTAMP(3),NULL) WHERE id=?',[complete?'complete':'pending',phase,cursor,locationIndex,(response.orders||response.refunds||[]).length,complete?1:0,id]);
   if(complete){await c.execute('UPDATE sales_connection SET last_success=UTC_TIMESTAMP(3),failure_code=NULL,watermark=IF(?=\'refresh\' AND (watermark IS NULL OR watermark<?),?,watermark) WHERE id=1',[run.kind,run.end_at,run.end_at]);await audit(c,actor,'sales:run-completed','sales_run',id);}
   return {id,state:complete?'complete':'pending',phase,pages:Number(run.pages)+1,records:Number(run.records)+(response.orders||response.refunds||[]).length};
  });
 }catch(e){
  if(locked){const code=e instanceof SalesError?e.code:'SQUARE_REFRESH_FAILED';await database().execute("UPDATE sales_runs SET state='failed',failure_code=? WHERE id=? AND state<>'complete'",[code,id]);await database().execute('UPDATE sales_connection SET failure_code=? WHERE id=1',[code]);}
  throw e;
 }finally{if(locked)await lease.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':sales-run'))");lease.release();}
}
export async function restartSalesCursor(actor:number,id:string){return salesTransaction(async c=>{
 const [r]=await c.execute("UPDATE sales_runs SET checkpoint_cursor=NULL,state='pending',failure_code=NULL WHERE id=? AND state='failed'",[id]);if(!(r as {affectedRows:number}).affectedRows)throw new SalesError('FAILED_RUN_REQUIRED',409);await audit(c,actor,'sales:cursor-restart','sales_run',id);return {id,state:'pending'};
});}
export async function reconcileSalesOrder(actor:number,id:string,version:number,choice:'csv'|'api'){
 return salesTransaction(async c=>{
  const [rs]=await c.execute<RowDataPacket[]>('SELECT * FROM sales_api_orders WHERE id=? FOR UPDATE',[id]);const r=rs[0];if(!r||Number(r.version)!==version)throw new SalesError('RECONCILIATION_CHANGED',409);
  if(r.state!=='overlap')throw new SalesError('OVERLAP_REVIEW_REQUIRED',409);
  const p=JSON.parse(r.payload),matches=await csvMatches(c,p);
  if(choice==='api'&&!matches.length)throw new SalesError('CSV_IDENTITY_LINK_REQUIRED',409);
  // Refuse partial replacement of a CSV transaction with several unmatched
  // tenders. Every recorded payment identity must belong to this API order.
  if(choice==='api'){
   const [other]=await c.query<RowDataPacket[]>("SELECT DISTINCT o.id FROM sales_api_orders o JOIN sales_details a ON a.order_id=o.id JOIN sales_details csv ON csv.source_kind='csv' AND (csv.transaction_id=a.order_id OR (csv.payment_id<>'' AND csv.payment_id=a.payment_id)) WHERE a.source_kind='api' AND o.id<>? AND csv.transaction_id IN (?)",[id,matches]);
   if(other.length)throw new SalesError('AMBIGUOUS_TRANSACTION_MATCH',409);
   const [payments]=await c.query<RowDataPacket[]>("SELECT DISTINCT payment_id FROM sales_details WHERE source_kind='csv' AND transaction_id IN (?)",[matches]);
   if(payments.some(r=>!r.payment_id||!p.paymentIds.includes(r.payment_id)))throw new SalesError('PARTIAL_TRANSACTION_MATCH',409);
  }
  await c.execute('INSERT INTO sales_revisions(entity_key,content_hash,payload,actor_id) VALUES(?,?,?,?)',[id,r.content_hash,JSON.stringify({choice,previousState:r.state,matchedCsv:matches,api:p}),actor]);
  if(matches.length)await c.query("UPDATE sales_details SET included=? WHERE source_kind='csv' AND transaction_id IN (?)",[choice==='csv'?1:0,matches]);
  await c.execute("UPDATE sales_details SET included=0 WHERE source_kind='api' AND order_id=?",[id]);
  if(choice==='api')for(const line of p.lines)await c.execute('UPDATE sales_details SET included=1 WHERE source_key=?',['api:'+hash(line.key+':'+r.content_hash)]);
  await c.execute('UPDATE sales_api_orders SET state=?,reason=NULL,matched_csv=?,version=version+1 WHERE id=?',[choice==='api'?'included':'excluded',JSON.stringify(matches),id]);await audit(c,actor,'sales:choose-'+choice,'square_order',id);return {id,choice};
 });
}
