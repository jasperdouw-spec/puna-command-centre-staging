import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
mkdirSync('.domain-tests',{recursive:true});
for(const name of ['commerce-model','costing']){
 const source=readFileSync('lib/'+name+'.ts','utf8').replaceAll("'./commerce-model'","'./commerce-model.mjs'");
 writeFileSync('.domain-tests/'+name+'.mjs',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
}
const {quoteCart,localInstant,planBatches,batchFits,capacityConfig}=await import('../.domain-tests/commerce-model.mjs');
const {recipeCost,reconcileExpenseSum}=await import('../.domain-tests/costing.mjs');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS domain '+name)}
const p={id:'synthetic',name:'Synthetic',price_cents:800,available:true,kind:'fresh',category:'empanada',publication:'staging',price_confirmed:true,ingredients_confirmed:true,tax_rules:[{name:'Synthetic tax',basis_points:500}],deposit_cents:0,oven_units:1,packing_seconds:0,physical_units:50,committed_units:10,known:true,version:1};
const q=quantity=>quoteCart([{id:p.id,quantity}],[p],20);
test('integer cents and line-specific taxes',()=>{assert.equal(q(1).total_cents,840);const drink={...p,id:'drink',category:'drink',price_cents:350,tax_rules:[{name:'Synthetic drink tax',basis_points:1200}],deposit_cents:10,oven_units:0};const total=quoteCart([{id:p.id,quantity:1},{id:'drink',quantity:1}],[p,drink],20);assert.equal(total.tax_cents,82);assert.equal(total.deposit_cents,10);assert.equal(total.oven_units,1)});
test('unknown stock and incomplete tax cannot be ordered',()=>{for(const change of [{known:false},{tax_rules:null},{deposit_cents:null},{ingredients_confirmed:false},{price_confirmed:false},{packing_seconds:null}])assert.throws(()=>quoteCart([{id:p.id,quantity:1}],[{...p,...change}],20))});
test('all future commitments reduce available stock',()=>assert.throws(()=>quoteCart([{id:p.id,quantity:41}],[p],100),/INSUFFICIENT_STOCK/));
test('max order size does not silently split',()=>assert.throws(()=>q(21),/ORDER_TOO_LARGE/));
test('five remaining accepts five and rejects six',()=>{const b={state:'open',cutoff_at:'2030-01-01T18:00:00Z',oven_capacity:20,oven_committed:15,packing_capacity_seconds:0,packing_committed_seconds:0};assert.equal(batchFits(b,q(5),Date.parse('2030-01-01T17:59:59Z')),true);assert.equal(batchFits(b,q(6),Date.parse('2030-01-01T17:59:59Z')),false)});
test('server cutoff rejects exact cutoff and past times',()=>{const b={state:'open',cutoff_at:'2030-01-01T18:00:00Z',oven_capacity:20,oven_committed:0,packing_capacity_seconds:0,packing_committed_seconds:0};assert.equal(batchFits(b,q(1),Date.parse(b.cutoff_at)),false)});
test('Vancouver respects historical DST and current permanent Pacific time',()=>{assert.equal(new Date(localInstant('2025-01-15','10:00')).toISOString(),'2025-01-15T18:00:00.000Z');assert.equal(new Date(localInstant('2025-07-15','10:00')).toISOString(),'2025-07-15T17:00:00.000Z');assert.equal(new Date(localInstant('2027-01-15','10:00')).toISOString(),'2027-01-15T17:00:00.000Z');assert.equal(new Date(localInstant('2027-07-15','10:00')).toISOString(),'2027-07-15T17:00:00.000Z')});
test('ambiguous or nonexistent local times are refused',()=>{assert.throws(()=>localInstant('2025-03-09','02:30'));assert.throws(()=>localInstant('2025-11-02','01:30'))});
const config={timezone:'America/Vancouver',ovenCount:1,piecesPerOven:20,cycleMinutes:30,turnaroundMinutes:0,preheatMinutes:10,packingMinutes:0,handoffMinutes:0,pickupWindowMinutes:10,packingStaff:1,packingCapacitySeconds:0,counterReserve:0,maxItems:20,holdSeconds:120,horizonDays:7,safetyStock:0,services:[{weekday:5,staffStart:'09:50',firstBake:'10:00',lastPickup:'12:00'}],closedDates:[],downtime:[],paused:false,verified:true};
test('20-piece 30-minute fixture starts pickup at 10:30',()=>{const slots=planBatches(config,'2027-01-15');assert.equal(slots[0].ovenCapacity,20);assert.equal(slots[0].pickupAt,'2027-01-15T17:30:00.000Z')});
test('preheat packing handoff holidays and downtime constrain service',()=>{assert.throws(()=>planBatches({...config,preheatMinutes:11},'2027-01-15'));assert.equal(planBatches({...config,closedDates:['2027-01-15']},'2027-01-15').length,0);assert.equal(planBatches({...config,downtime:[{from:'2027-01-15T16:50:00Z',until:'2027-01-15T20:00:00Z'}]},'2027-01-15').length,0);const slots=planBatches({...config,packingMinutes:5,handoffMinutes:2},'2027-01-15');assert.equal(slots[0].pickupAt,'2027-01-15T17:37:00.000Z');assert.equal(capacityConfig.safeParse({...config,packingCapacitySeconds:30}).success,false)});
test('incomplete source inputs do not produce margins',()=>{assert.equal(recipeCost({yieldUnits:null,ingredients:[],labourMinutes:null,labourRateCents:null,packagingCents:null,includesLabour:false}).complete,false)});
test('source total discrepancy stays explicit',()=>assert.deepEqual(reconcileExpenseSum([12000,4000],17000),{sum:16000,statedTotal:17000,difference:1000,agrees:false}));
console.log('RESULT '+passed+' synthetic domain checks passed');
