import assert from 'node:assert/strict';
import {createHash,createCipheriv,randomBytes} from 'node:crypto';
import {row,csv} from './sales-fixtures.mjs';
export async function runSalesChecks({db,request,check,cookie,staffCookie}){
 const post=(body,who=cookie)=>request('/api/sales',{method:'POST',cookie:who,body});
 const report=()=>request('/api/sales?from=2025-01-01&to=2025-12-31',{cookie});
 async function preview(rows,who=cookie,duplicateFile=false){const f=new FormData();f.append('files',new Blob([csv(rows)],{type:'text/csv'}),'synthetic.csv');if(duplicateFile)f.append('files',new Blob([csv(rows)],{type:'text/csv'}),'synthetic-copy.csv');const encoded=new Request('https://example.test',{method:'POST',body:f});return request('/api/sales',{method:'POST',cookie:who,rawBody:Buffer.from(await encoded.arrayBuffer()),extraHeaders:{'content-type':encoded.headers.get('content-type')}});}
 let batch;
 await check('sales denies anonymous, staff and foreign-origin controls',async()=>{
  assert.equal((await request('/api/sales')).status,401);assert.equal((await request('/api/sales?references=true',{cookie:staffCookie})).status,403);assert.equal((await preview([row()],staffCookie)).status,403);
  assert.equal((await request('/api/sales',{method:'POST',cookie,originHeader:'https://other.example.test',body:{action:'refresh'}})).status,403);assert.equal((await request('/api/sales/jobs',{method:'POST'})).status,403);
 });
 await check('preview keeps only minimized data, hashes and source rows without publishing',async()=>{
  const r=await preview([row(),row(),row({Notes:'legitimate different source line'})],cookie,true);assert.equal(r.status,200);batch=r.data.id;assert.equal(r.data.preview.uniqueRows,2);assert.equal(r.data.preview.duplicates,1);assert.equal(r.data.preview.duplicateFiles,1);assert.equal(r.data.preview.netCents,1400);assert.equal(Number((await report()).data.totals.records),0);
  const [stages]=await db.execute('SELECT * FROM sales_stage WHERE batch_id=?',[batch]);assert.equal(stages.length,3);assert.doesNotMatch(JSON.stringify(stages),/EXCLUDED|excluded@example|legitimate different/);assert.equal(stages[0].source_row,2);
 });
 await check('atomic repeat import preserves legitimate repeated lines and audit history',async()=>{
  assert.equal((await post({action:'import',id:batch})).status,200);const [before]=await db.query("SELECT COUNT(*) n FROM audit_log WHERE action='sales:import'");assert.equal((await post({action:'import',id:batch})).data.duplicate,true);
  const [after]=await db.query("SELECT COUNT(*) n FROM audit_log WHERE action='sales:import'");assert.equal(after[0].n,before[0].n);const r=await report();assert.equal(Number(r.data.totals.records),2);assert.equal(Number(r.data.totals.net_cents),1400);assert.equal(Number(r.data.totals.transactions),1);assert.equal(r.data.tipsCents,null);assert.equal(r.data.coverageComplete,false);
  const repeat=await preview([row(),row(),row({Notes:'legitimate different source line'})]);assert.equal(repeat.data.existing,true);
 });
 await check('overlapping exports add only new 33-field rows and retain all provenance',async()=>{
  const r=await preview([row(),row({'Transaction ID':'synthetic-tx-3','Payment ID':'synthetic-pay-3'})]);assert.equal(r.data.preview.alreadyImported,1);assert.equal(r.data.preview.newRows,1);await post({action:'import',id:r.data.id});assert.equal(Number((await report()).data.totals.net_cents),2100);
  const [facts]=await db.query("SELECT source_key FROM sales_details WHERE transaction_id='synthetic-tx-1' LIMIT 1");const trace=await request('/api/sales?trace='+facts[0].source_key,{cookie});assert.ok(trace.data.provenance.length>=1);assert.ok(trace.data.provenance[0].file_hash);
 });
 await check('malformed rows block the batch instead of silently importing a partial total',async()=>{
  const r=await preview([row({'Net Sales':'broken'})]);assert.equal(r.data.preview.rejected,1);assert.equal((await post({action:'import',id:r.data.id})).status,409);const rejected=await request('/api/sales?batch='+r.data.id,{cookie});assert.equal(rejected.data.rejections[0].source_row,2);assert.equal(rejected.data.rejections[0].error_code,'INVALID_DECIMAL');
 });
 await check('audit failure rolls back all sales and retry resumes the saved batch',async()=>{
  const before=(await report()).data.totals.net_cents,r=await preview([row({'Transaction ID':'synthetic-rollback','Payment ID':'synthetic-rollback-payment'})]);
  await db.query("CREATE TRIGGER synthetic_sales_failure BEFORE INSERT ON audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic rollback'");
  try{assert.equal((await post({action:'import',id:r.data.id})).status,503);}finally{await db.query('DROP TRIGGER synthetic_sales_failure');}
  assert.equal((await report()).data.totals.net_cents,before);const [st]=await db.execute('SELECT state FROM sales_batches WHERE id=?',[r.data.id]);assert.equal(st[0].state,'failed');assert.equal((await post({action:'import',id:r.data.id})).status,200);
 });
 await check('mapping is versioned and never changes catalogue or stock',async()=>{
  const before=(await db.query('SELECT id,name,price_cents,version FROM products ORDER BY id'))[0];const m=(await report()).data.mappings[0];assert.equal(m.product_id,null);assert.equal((await post({action:'map',key:m.source_product_key,productId:'synthetic-product',version:m.version})).status,200);assert.equal((await post({action:'map',key:m.source_product_key,productId:'synthetic-product',version:m.version})).status,409);assert.deepEqual((await db.query('SELECT id,name,price_cents,version FROM products ORDER BY id'))[0],before);
 });
 await check('private reference import is hashed, versioned, idempotent and cannot drive production',async()=>{
  const sha=s=>createHash('sha256').update(s).digest('hex');const base={sourceKey:'synthetic-workbook:1',sourceUrl:'https://example.test/recipe',title:'Synthetic source recipe',kind:'recipe',columns:['Ingredient','Source quantity'],rows:[['Synthetic flour','100'],['Yield',null]],formulas:[],issues:['Unverified yield']};const item={...base,observedAt:'2025-01-01T00:00:00Z',sourceHash:sha(JSON.stringify(base))};
  assert.equal((await post({action:'preview-references',items:[{...item,sourceHash:'0'.repeat(64)}]})).status,400);const p=await post({action:'preview-references',items:[item]});assert.equal(p.status,200);assert.equal((await post({action:'import-references',id:p.data.id})).status,200);assert.equal((await post({action:'import-references',id:p.data.id})).data.duplicate,true);
  assert.equal((await post({action:'preview-references',items:[{...item,observedAt:'2025-02-01T00:00:00Z'}]})).data.existing,true);const result=await request('/api/sales?references=true',{cookie});assert.equal(result.data.references.length,1);assert.equal(result.data.references[0].payload.rows[1][1],null);
 });
 await check('Square OAuth validates owner state and stores only encrypted credentials',async()=>{
  const a=await post({action:'authorize'});assert.equal(a.status,200);const u=new URL(a.data.url);assert.doesNotMatch(u.searchParams.get('scope'),/WRITE|CUSTOMERS/);const callback='/api/sales/square/callback?state='+u.searchParams.get('state')+'&code=synthetic-code';
  assert.match((await request(callback,{cookie:staffCookie})).headers.location,/failed/);assert.match((await request(callback,{cookie})).headers.location,/connected/);assert.match((await request(callback,{cookie})).headers.location,/failed/);
  const [conn]=await db.query('SELECT credentials FROM sales_connection');assert.doesNotMatch(conn[0].credentials,/synthetic-reporting-token|synthetic-reporting-refresh/);assert.equal((await post({action:'inspect'})).data.metadataStatus,'available');
 });
 await check('verified Reporting API aggregates remain separate from accepted item facts',async()=>{
  const before=(await report()).data.totals.net_cents;const r=await post({action:'report',from:'2025-06-01',to:'2025-06-30',profile:'sales'});assert.equal(r.status,200);assert.equal(r.data.snapshot.payload.rows[0].values['Sales.net_sales'],700);assert.equal((await report()).data.totals.net_cents,before);assert.equal((await report()).data.snapshots.length,1);
 });
 let run;
 await check('bounded refresh checkpoints hold CSV overlap and import non-overlap once',async()=>{
  const p=await post({action:'backfill',start:'2025-06-01T00:00:00Z',end:'2025-06-10T00:00:00Z'});run=p.data.id;assert.equal(p.status,200);
  await db.query("CREATE TRIGGER synthetic_page_failure BEFORE INSERT ON audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic page rollback'");try{assert.equal((await post({action:'continue',id:run})).status,503);}finally{await db.query('DROP TRIGGER synthetic_page_failure');}
  const [rolled]=await db.execute('SELECT pages,checkpoint_cursor FROM sales_runs WHERE id=?',[run]);assert.equal(rolled[0].pages,0);assert.equal(rolled[0].checkpoint_cursor,null);assert.equal((await db.query('SELECT COUNT(*) n FROM sales_api_orders'))[0][0].n,0);
  const first=await post({action:'continue',id:run});assert.equal(first.status,200);assert.equal(first.data.state,'pending');assert.equal((await report()).data.conflicts[0].id,'synthetic-api-1');
  const [checkpoint]=await db.execute('SELECT checkpoint_cursor FROM sales_runs WHERE id=?',[run]);assert.equal(checkpoint[0].checkpoint_cursor,'synthetic-next');const before=Number((await report()).data.totals.net_cents);
  assert.equal((await post({action:'continue',id:run})).status,200);assert.equal(Number((await report()).data.totals.net_cents),before+700);const final=await post({action:'continue',id:run});assert.equal(final.data.state,'complete');assert.equal((await post({action:'continue',id:run})).data.duplicate,true);
  const reportData=(await report()).data;assert.equal(Number(reportData.cashRefunds.cash_refund_cents),100);assert.equal(Number(reportData.totals.net_cents),before+700);assert.doesNotMatch(JSON.stringify(reportData),/EXCLUDED|Bearer|accessToken|refreshToken/);
 });
 await check('owner source choice replaces the entire matched transaction without doubling sales',async()=>{
  const r=await report(),conflict=r.data.conflicts.find(c=>c.id==='synthetic-api-1'),before=Number(r.data.totals.net_cents);assert.equal((await post({action:'reconcile',id:conflict.id,version:conflict.version,choice:'api'})).status,200);assert.equal(Number((await report()).data.totals.net_cents),before-1400+700);assert.equal((await post({action:'reconcile',id:conflict.id,version:conflict.version,choice:'api'})).status,409);
 });
 await check('late API changes retain old evidence and reopen a previous source decision',async()=>{
  const before=Number((await report()).data.totals.net_cents);const r=await post({action:'backfill',start:'2025-07-01T00:00:00Z',end:'2025-07-05T00:00:00Z'});assert.equal((await post({action:'continue',id:r.data.id})).status,200);const reportData=(await report()).data;assert.equal(Number(reportData.totals.net_cents),before-700+1400);const changed=reportData.conflicts.find(c=>c.id==='synthetic-api-1');assert.equal(changed.api.net_cents,900);assert.equal(Number(changed.csv.net_cents),1400);
  const [history]=await db.query("SELECT COUNT(*) n FROM sales_revisions WHERE entity_key='synthetic-api-1'");assert.ok(Number(history[0].n)>=2);assert.equal((await post({action:'continue',id:r.data.id})).data.state,'complete');
 });
 await check('later CSV import quarantines previously included API facts and exposes linked totals',async()=>{
  const before=Number((await report()).data.totals.net_cents);const r=await preview([row({Date:'2025-06-02','Transaction ID':'synthetic-later-csv','Payment ID':'synthetic-pay-2'})]);assert.equal((await post({action:'import',id:r.data.id})).status,200);const result=(await report()).data;assert.equal(Number(result.totals.net_cents),before);const conflict=result.conflicts.find(c=>c.id==='synthetic-api-2');assert.equal(Number(conflict.csv.net_cents),700);assert.equal(conflict.api.net_cents,700);assert.deepEqual(conflict.matched_csv,['synthetic-later-csv']);
 });
 await check('revoked Square credentials fail visibly without changing accepted sales',async()=>{
  const [saved]=await db.query('SELECT credentials FROM sales_connection');const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',Buffer.from('a'.repeat(64),'hex'),iv);c.setAAD(Buffer.from('puna-square-reporting-v1'));const data=Buffer.concat([c.update(JSON.stringify({accessToken:'synthetic-revoked',refreshToken:'synthetic-refresh'})),c.final()]);const enc=JSON.stringify({iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:data.toString('base64')});await db.execute('UPDATE sales_connection SET credentials=?',[enc]);
  const before=(await report()).data.totals.net_cents;const p=await post({action:'backfill',start:'2025-06-01T00:00:00Z',end:'2025-06-10T00:00:00Z'});assert.equal((await post({action:'continue',id:p.data.id})).status,409);assert.equal((await report()).data.connection.failure_code,'SQUARE_ACCESS_UNAVAILABLE');assert.equal((await report()).data.totals.net_cents,before);await db.execute('UPDATE sales_connection SET credentials=?',[saved[0].credentials]);assert.equal((await post({action:'restart-cursor',id:p.data.id})).status,200);
 });
 await check('scheduled bearer authorization continues the persisted run without an owner session',async()=>{
  const denied=await request('/api/sales/jobs',{method:'POST',extraHeaders:{authorization:'Bearer '+String.fromCharCode(233).repeat(41)}});assert.equal(denied.status,403);
  const r=await request('/api/sales/jobs',{method:'POST',extraHeaders:{authorization:'Bearer synthetic-reporting-job-token-32-characters'}});assert.equal(r.status,200);assert.equal(r.data.state,'pending');
 });
 await check('completed refresh advances its watermark while backfills and replays preserve it',async()=>{
  const [active]=await db.query("SELECT id FROM sales_runs WHERE state<>'complete'");
  for(const r of active)for(let i=0;i<5;i++){const p=await post({action:'continue',id:r.id});assert.equal(p.status,200);if(p.data.state==='complete')break;}
  assert.equal((await db.query('SELECT watermark FROM sales_connection'))[0][0].watermark,null);
  const refresh=await post({action:'refresh'});assert.equal(refresh.status,200);
  for(let i=0;i<5;i++){const p=await post({action:'continue',id:refresh.data.id});assert.equal(p.status,200);if(p.data.state==='complete')break;}
  const [run]=await db.execute('SELECT state,end_at FROM sales_runs WHERE id=?',[refresh.data.id]);assert.equal(run[0].state,'complete');
  assert.equal((await db.query('SELECT watermark FROM sales_connection'))[0][0].watermark,run[0].end_at);
  assert.equal((await post({action:'continue',id:refresh.data.id})).data.duplicate,true);
  const historical=await post({action:'backfill',start:'2024-08-01T00:00:00.000Z',end:'2024-09-01T00:00:00.000Z'});
  for(let i=0;i<5;i++){const p=await post({action:'continue',id:historical.data.id});assert.equal(p.status,200);if(p.data.state==='complete')break;}
  const [empty]=await db.execute('SELECT state,pages,records FROM sales_runs WHERE id=?',[historical.data.id]);assert.equal(empty[0].state,'complete');assert.equal(empty[0].pages,2);assert.equal(empty[0].records,0);
  assert.equal((await db.query('SELECT watermark FROM sales_connection'))[0][0].watermark,run[0].end_at);
 });

 await check('dashboard reads the same included ledger without changing records or audit',async()=>{
  const before=(await db.query('SELECT COUNT(*) n FROM audit_log'))[0][0].n;
  const dash=await request('/api/sales?view=dashboard&period=month&date=2025-06-15',{cookie});assert.equal(dash.status,200);
  const legacy=await request('/api/sales?from=2025-06-01&to=2025-06-30&group=product',{cookie});
  assert.equal(dash.data.current.totals.net,Number(legacy.data.totals.net_cents));assert.equal(dash.data.current.totals.transactions,Number(legacy.data.totals.transactions));
  assert.equal(dash.data.current.totals.aov,Number(legacy.data.totals.net_cents)/Number(legacy.data.totals.transactions));assert.equal(dash.data.current.totals.quantity,Number(legacy.data.totals.quantity));
  assert.equal(dash.data.current.products.reduce((n,p)=>n+p.metrics.net,0),dash.data.current.totals.net);assert.equal(dash.data.current.totals.tips,null);assert.equal(dash.data.coverage.complete,false);
  assert.equal((await db.query('SELECT COUNT(*) n FROM audit_log'))[0][0].n,before);
 });
 await check('dashboard denies staff, validates filters, and never calls empty periods zero',async()=>{
  assert.equal((await request('/api/sales?view=dashboard',{cookie:staffCookie})).status,403);assert.equal((await request('/api/sales?view=dashboard')).status,401);
  assert.equal((await request('/api/sales?view=dashboard&period=year',{cookie})).status,400);assert.equal((await request('/api/sales?view=dashboard&date=2999-01-01',{cookie})).status,400);
  const empty=await request('/api/sales?view=dashboard&period=day&date=2001-01-01',{cookie});assert.equal(empty.data.current.totals.net,null);assert.equal(empty.data.current.totals.aov,null);assert.ok(empty.data.current.points.every(p=>p.metrics.net===null));
 });
 await check('product drill-down filters the reconciled ledger without reallocating refunds or tips',async()=>{
  const all=await request('/api/sales?view=dashboard&period=month&date=2025-06-15',{cookie});const p=all.data.current.products[0];
  const detail=await request('/api/sales?view=dashboard&period=month&date=2025-06-15&product='+p.key,{cookie});assert.equal(detail.status,200);assert.equal(detail.data.current.totals.net,p.metrics.net);assert.equal(detail.data.current.totals.refunds,p.metrics.refunds);assert.equal(detail.data.current.totals.tips,null);assert.equal(detail.data.current.products.length,1);
 });

}
