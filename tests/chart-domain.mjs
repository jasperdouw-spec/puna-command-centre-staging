import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const {chartDomain,chartSegments}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync('lib/chart-model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
let n=0;function test(name,fn){fn();n++;console.log('PASS chart '+name);}
test('missing values split segments without interpolating or manufacturing zero',()=>assert.deepEqual(chartSegments([1,null,0,2,null,-3]),[[{index:0,value:1}],[{index:2,value:0},{index:3,value:2}],[{index:5,value:-3}]]));
test('invalid observations are gaps',()=>assert.deepEqual(chartSegments([NaN,null,Infinity]),[]));
test('all zero and missing domains are finite and nondegenerate',()=>{for(const values of [[0,0],[null],[]]){const d=chartDomain(values);assert.equal(d.min,0);assert.ok(Number.isFinite(d.max)&&d.max>d.min);}});
test('negative returns and positive sales share a true zero baseline',()=>{const d=chartDomain([-125,450]);assert.ok(d.min<=-125&&d.max>=450);assert.ok(d.ticks.includes(0));});
test('exact fractional units and unsmoothed values survive plotting',()=>assert.deepEqual(chartSegments([.125,900,-12.4])[0].map(p=>p.value),[.125,900,-12.4]));
test('scale encloses every supplied finite value',()=>{for(const values of [[-1,-2],[1e7,3e7],[.0002,.0003],[-3500,7000]]){const d=chartDomain(values);assert.ok(values.every(v=>v>=d.min&&v<=d.max));assert.ok(d.ticks.length>=2&&d.ticks.length<=7);}});
console.log('RESULT '+n+' chart checks passed');
