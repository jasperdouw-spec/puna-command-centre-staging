import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('lib/kitchen-model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {capacity,effectiveStatus,freshness,expiresAutomatically}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const now=Date.parse('2026-11-09T02:00:00Z'),state={mode:'open',reviewedAt:new Date(now).toISOString(),heartbeatAt:new Date(now-89000).toISOString()},lot={id:'batch-a',online_ready:6,truck_ready:4,online_baking:0,truck_baking:0,estimatedReadyAt:new Date(now).toISOString()},allocation={id:'a',channel:'online',state:'paid',pickupAt:new Date(now+60000).toISOString(),expiresAt:new Date(now-1).toISOString(),lines:[{lotId:'batch-a',quantity:2,readyUnits:2,setAsideUnits:2}]};
let count=0;function check(name,fn){fn();console.log('PASS kitchen domain '+name);count++;}
check('heartbeat expires exactly at ninety seconds',()=>{assert.equal(freshness(state,now),true);assert.equal(freshness(state,now+1000),false);assert.equal(effectiveStatus(state,now+1000,[lot],[allocation]).status,'paused');});
check('an unattended but connected screen cannot extend the stock-review deadline',()=>{assert.equal(freshness({...state,heartbeatAt:new Date(now).toISOString(),reviewedAt:new Date(now-900000).toISOString()},now),false);});
check('a future heartbeat is not proof of freshness',()=>assert.equal(freshness({...state,heartbeatAt:new Date(now+1).toISOString()},now),false));
check('ordinary expiry never releases pending uncertain paid or counter reservations',()=>{assert.equal(expiresAutomatically({...allocation,state:'unpaid'},now),true);for(const s of ['pending','uncertain','paid','counter_pending'])assert.equal(expiresAutomatically({...allocation,state:s},now),false);});
check('physical stock and commitments are separate from channel free capacity',()=>{assert.deepEqual(capacity(lot,[allocation]),{online:4,truck:4,ready:10,baking:0,reserved:2,deficit:0});});
check('wastage below a commitment creates a shortage instead of negative availability',()=>{const l={...lot,online_ready:1};assert.equal(capacity(l,[allocation]).online,0);assert.equal(capacity(l,[allocation]).deficit,1);assert.equal(effectiveStatus(state,now,[l],[allocation]).status,'paused');});
check('handover reduces physical and commitment once leaving free availability unchanged',()=>{assert.equal(capacity(lot,[allocation]).online,capacity({...lot,online_ready:4},[{...allocation,state:'consumed'}]).online);});
check('a different batch does not satisfy or inherit an order commitment',()=>{assert.equal(capacity({...lot,id:'batch-b'},[allocation]).reserved,0);});
check('late or delayed commitments block open state while explicit Closed remains closed',()=>{const pending={...allocation,lines:[{...allocation.lines[0],readyUnits:0}]},delayed={...lot,online_ready:0,online_baking:6,estimatedReadyAt:new Date(now+120000).toISOString()};assert.equal(effectiveStatus(state,now,[delayed],[pending]).status,'paused');assert.equal(effectiveStatus({...state,mode:'closed'},now,[lot],[{...allocation,state:'late_exception'}]).status,'closed');});
console.log('RESULT '+count+' kitchen domain checks passed');
