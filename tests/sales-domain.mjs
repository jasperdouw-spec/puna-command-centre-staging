import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
import {headers,row,csv,order,money} from './sales-fixtures.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
mkdirSync('.domain-tests',{recursive:true});
for(const name of ['sales-model','square-reporting-model'])writeFileSync('.domain-tests/'+name+'.mjs',ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8').replaceAll("'./sales-model'","'./sales-model.mjs'"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const {previewCsv,decimalUnits,csvRecords,localDay,hash}=await import('../.domain-tests/sales-model.mjs');
const {normalizeSquareOrder,normalizeRefund,reportingCents}=await import('../.domain-tests/square-reporting-model.mjs');
let passed=0;function check(n,f){f();passed++;console.log('PASS sales domain '+n)}
const file=(rows,name='synthetic.csv')=>({name,bytes:Buffer.from(csv(rows))});
check('dedup compares all 33 fields before projection and preserves legitimate repeated lines',()=>{
 const a=row(),b=row({Notes:'DIFFERENT EXCLUDED NOTE'}),p=previewCsv([file([a,a,b])]);assert.equal(headers.length,33);assert.equal(p.preview.rawRows,3);assert.equal(p.preview.duplicates,1);assert.equal(p.preview.uniqueRows,2);assert.equal(p.preview.netCents,1400);assert.equal(p.preview.transactions,1);
 assert.doesNotMatch(JSON.stringify(p.stages),/EXCLUDED|excluded@example|Card Token|Customer Name/);
 assert.deepEqual({...p.stages[0].line,rowHash:''},{...p.stages[2].line,rowHash:''});
});
check('duplicate files, overlapping exports, byte hashes and stable manifest identity',()=>{
 const a=file([row()]),b=file([row(),row({'Transaction ID':'synthetic-tx-2'})],'overlap.csv');const p=previewCsv([a,a,b]);assert.equal(p.preview.duplicateFiles,1);assert.equal(p.preview.uniqueRows,2);assert.equal(p.preview.duplicates,1);assert.equal(p.id,previewCsv([b,a]).id);assert.throws(()=>previewCsv([{...a,expectedHash:'0'.repeat(64)}]),/HASH_MISMATCH/);assert.equal(p.manifest[0].sha256,hash(a.bytes));
});
check('RFC4180 commas, quotes, embedded newlines and source record references',()=>{
 const p=previewCsv([file([row({Item:'Synthetic, "special"',Notes:'private\nline'})])]);assert.equal(p.stages[0].sourceRow,2);assert.equal(p.stages[0].line.item,'Synthetic, "special"');assert.throws(()=>csvRecords('"unclosed'),/UNCLOSED/);assert.throws(()=>csvRecords('a"b'),/QUOTES/);
});
check('monetary exactness and refund signs do not deduct returns twice',()=>{
 assert.equal(decimalUnits('CAD $1,234.56',2),123456);assert.equal(decimalUnits('($0.01)',2),-1);assert.throws(()=>decimalUnits('0.001',2));assert.throws(()=>decimalUnits('1e3',2));assert.throws(()=>decimalUnits('1,23',2));
 const p=previewCsv([file([row(),row({'Event Type':'Refund',Qty:'-1','Gross Sales':'-$8.00',Discounts:'$1.00','Net Sales':'-$7.00',Tax:'-$0.35'})])]);assert.equal(p.preview.netCents,0);assert.equal(p.stages[1].line.refundCents,700);assert.equal(p.stages[1].line.discountCents,-100);
});
check('malformed money and missing fields are rejected without private content',()=>{
 const p=previewCsv([file([row({'Net Sales':'123.45',Notes:'PRIVATE'}),row({'Transaction ID':''}),row().slice(0,32)])]);assert.equal(p.preview.rejected,3);assert.equal(p.preview.uniqueRows,0);assert.doesNotMatch(JSON.stringify(p),/PRIVATE|EXCLUDED/);
});
check('Vancouver source date survives UTC boundary, ambiguous clocks and invalid dates',()=>{
 assert.equal(localDay('2025-06-02T00:30:00Z'),'2025-06-01');const p=previewCsv([file([row({Date:'2025-11-02',Time:'01:30:00'}),row({Date:'2025-03-09',Time:'02:30:00'}),row({Date:'2025-02-30'})])]);assert.equal(p.stages[0].line.timestampStatus,'ambiguous_wall_time');assert.equal(p.preview.rejected,2);
});
check('API line totals, order tips and source privacy remain at their own grain',()=>{
 const n=normalizeSquareOrder(order());assert.equal(n.reason,null);assert.equal(n.payload.lines[0].line.netCents,700);assert.equal(n.payload.tipCents,100);assert.equal(n.payload.localDate,'2025-06-01');assert.doesNotMatch(JSON.stringify(n),/EXCLUDED|last_4|9999/);
 const o=order();o.line_items.push({...o.line_items[0],uid:'b'});o.total_money=money(1570);assert.equal(normalizeSquareOrder(o).payload.lines.length,2);
});
check('itemized returns reconcile, unsupported charges fail closed, payment refund is separate',()=>{
 const o=order();o.line_items=[];o.total_money=money(0);o.total_tip_money=money(0);o.returns=[{uid:'return',return_line_items:[{uid:'r',name:'Synthetic',quantity:'1',gross_return_money:money(800),total_discount_money:money(100),total_tax_money:money(35),total_money:money(735)}]}];o.net_amounts={total_money:money(-735),tip_money:money(0)};const n=normalizeSquareOrder(o);assert.equal(n.reason,null);assert.equal(n.payload.lines[0].line.netCents,-700);
 assert.equal(normalizeSquareOrder({...order(),service_charges:[{}]}).payload.lines.length,0);
 assert.throws(()=>normalizeRefund({id:'r',payment_id:'p',location_id:'l',status:'COMPLETED',amount_money:{currency:'USD',amount:100},created_at:o.created_at,updated_at:o.updated_at}));
});
check('cash rounding stays outside item revenue and Cube serialization rounds only exact cents',()=>{
 const o=order();o.rounding_adjustment={amount_money:money(-1)};o.total_money=money(834);const n=normalizeSquareOrder(o);assert.equal(n.reason,null);assert.equal(n.payload.lines[0].line.netCents,700);assert.equal(n.payload.roundingCents,-1);assert.equal(reportingCents(112212.69999999984),11221270);assert.throws(()=>reportingCents('1.234'));assert.equal(reportingCents(null),null);
});
console.log('RESULT '+passed+' synthetic sales domain checks passed');
