import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('lib/sales-periods.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {periods,buckets,metrics,comparisonText,wall}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let passed=0;function check(label,fn){fn();console.log('PASS '+label);passed++;}
check('Vancouver midnight does not follow UTC date',()=>assert.equal(wall(new Date('2025-06-02T00:30:00Z')).slice(0,10),'2025-06-01'));
check('fall day has 25 distinct offset-aware hours',()=>{const p=periods('day','2025-11-02',new Date('2025-11-04T12:00:00Z'));const b=buckets('day',p.current);assert.equal(b.length,25);assert.equal(new Set(b.map(p=>p.key)).size,25);assert.ok(b.some(p=>/PDT/.test(p.label)));assert.ok(b.some(p=>/PST/.test(p.label)));});
check('spring day has 23 actual hours',()=>{const p=periods('day','2025-03-09',new Date('2025-03-11T12:00:00Z'));assert.equal(buckets('day',p.current).length,23);});
check('ongoing week compares matching local elapsed days and time',()=>{const p=periods('week','2025-06-04',new Date('2025-06-04T19:30:00Z'));assert.equal(p.current.start,'2025-06-02');assert.equal(p.previous.start,'2025-05-26');assert.equal(wall(new Date(p.previous.cutoff)),'2025-05-28T12:30:00');});
check('ongoing day compares same weekday previous week',()=>{const p=periods('day','2025-06-04',new Date('2025-06-04T19:30:00Z'));assert.equal(p.previous.start,'2025-05-28');assert.equal(p.previous.partial,true);});
check('month does not silently compare 31 elapsed days with 28',()=>{const p=periods('month','2025-03-31',new Date('2025-03-31T19:00:00Z'));assert.equal(p.comparable,false);assert.equal(p.previous.end,'2025-03-01');});
check('complete months use actual calendar boundaries',()=>{const p=periods('month','2024-03-10',new Date('2025-01-01T12:00:00Z'));assert.equal(p.previous.start,'2024-02-01');assert.equal(p.previous.through,'2024-02-29');assert.equal(p.current.partial,false);});
check('missing rows stay unavailable, observed zero is preserved',()=>{assert.equal(metrics({records:0,net:0,transactions:0}).net,null);assert.equal(metrics({records:1,net:0,transactions:1}).net,0);assert.equal(metrics({records:1,net:800,transactions:0}).aov,null);});
check('net includes returns once and AOV uses distinct ledger transactions',()=>{const m=metrics({records:4,net:1500,transactions:2,quantity:2,refunds:700,tax:75,discounts:100});assert.equal(m.net,1500);assert.equal(m.aov,750);assert.equal(m.refunds,700);assert.equal(m.quantity,2);assert.equal(m.tips,null);});
check('ambiguous partial-period figures fail closed',()=>assert.equal(metrics({records:2,net:800,transactions:1},true).net,null));
check('zero, negative and unavailable baselines do not fabricate percentages',()=>{assert.match(comparisonText(100,0),/zero baseline/);assert.match(comparisonText(100,null),/missing/);assert.match(comparisonText(100,-10),/negative/);assert.match(comparisonText(100,50,false),/unequal/);assert.equal(comparisonText(100,50),'+100.0% observed change');});
console.log(`${passed} dashboard domain checks passed`);
