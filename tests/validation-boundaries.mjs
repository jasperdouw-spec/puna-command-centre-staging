import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
mkdirSync('.domain-tests',{recursive:true});
for(const name of ['bounded-array','commerce-model','reference-model','ordering-input','kitchen-input']){
 const source=readFileSync('lib/'+name+'.ts','utf8').replaceAll("'./bounded-array'","'./bounded-array.mjs'");
 writeFileSync('.domain-tests/'+name+'.mjs',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
}
const {boundedArray,COLLECTION_NODE_LIMIT}=await import('../.domain-tests/bounded-array.mjs');
const {cartInput,taxRules}=await import('../.domain-tests/commerce-model.mjs');
const {referenceInput}=await import('../.domain-tests/reference-model.mjs');
test('Zod 3 baseline visits oversize elements; guarded schema rejects before any element work',()=>{
 let visits=0;const element=z.unknown().superRefine((v,c)=>{visits++;c.addIssue({code:'custom',message:'invalid'});});
 const data=Array(1000).fill(null);z.array(element).max(5).safeParse(data);assert.equal(visits,1000);
 visits=0;const result=boundedArray(element,5).safeParse(data);assert.equal(visits,0);assert.equal(result.error.issues.length,1);assert.equal(result.error.issues[0].code,'too_big');
});
test('valid boundaries and transformations retain output and ordinary element error paths',()=>{
 const schema=boundedArray(z.string().trim().min(1),2,1);assert.deepEqual(schema.parse([' a ','b']),['a','b']);
 assert.equal(schema.safeParse([]).success,false);assert.equal(schema.safeParse({}).success,false);assert.deepEqual(schema.safeParse(['ok','']).error.issues[0].path,[1]);
 const shared={id:'same'};assert.equal(boundedArray(z.object({id:z.string()}),2).safeParse([shared,shared]).success,true);
});
test('aggregate budget rejects nested amplification before element validation',()=>{
 let visits=0;const schema=boundedArray(z.unknown().transform(v=>{visits++;return v;}),100);
 const data=Array.from({length:100},()=>Array(300).fill(null));const r=schema.safeParse(data);assert.equal(r.success,false);assert.equal(visits,0);assert.equal(r.error.issues.length,1);assert.ok(data.length*300>COLLECTION_NODE_LIMIT);
});
test('excess depth and cyclic input fail without recursive validation',()=>{
 let data=null;for(let i=0;i<18;i++)data=[data];assert.equal(boundedArray(z.unknown(),10).safeParse(data).success,false);
 const cycle=[];cycle.push(cycle);assert.equal(boundedArray(z.unknown(),10).safeParse(cycle).success,false);
});
test('cart and tax schemas preserve accepted inputs and reject oversize or duplicate collections',()=>{
 assert.deepEqual(cartInput.parse([{id:'synthetic',quantity:1}]),[{id:'synthetic',quantity:1}]);
 assert.equal(cartInput.safeParse(Array(31).fill(null)).error.issues.length,1);
 assert.equal(cartInput.safeParse([{id:'same',quantity:1},{id:'same',quantity:2}]).success,false);
 assert.equal(taxRules.safeParse(Array(6).fill(null)).error.issues.length,1);
});
const reference={sourceKey:'synthetic',sourceUrl:'https://example.test/ref',title:'Synthetic',kind:'recipe',observedAt:'2026-11-08T12:00:00Z',columns:['A'],rows:[[null]],formulas:[],issues:[],sourceHash:'0'.repeat(64)};
test('reference accepts a full 500 by 40 bounded grid and rejects excessive rows or columns',()=>{
 assert.equal(referenceInput.safeParse({...reference,rows:Array.from({length:500},()=>Array(40).fill(null))}).success,true);
 for(const rows of [Array(501).fill(null),[Array(41).fill(null)]]){const r=referenceInput.safeParse({...reference,rows});assert.equal(r.success,false);assert.equal(r.error.issues.length,1);assert.equal(r.error.issues[0].path[0],'rows');}
});
test('batch aggregate budget requires oversized reference batches to be split',()=>{
 const schema=boundedArray(referenceInput,50,1),sheet={...reference,rows:Array.from({length:500},()=>Array(40).fill(null))};
 assert.equal(schema.safeParse([sheet]).success,true);assert.equal(schema.safeParse(JSON.parse(JSON.stringify([sheet,sheet]))).success,false);
});
test('application collection schemas use the reviewed early-bound helper',()=>{
 const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);
 const unguarded=walk('lib').concat(walk('app')).filter(p=>p.endsWith('.ts')&&p!=='lib/bounded-array.ts').filter(p=>/z\.(array|set|map|record)\s*\(/.test(readFileSync(p,'utf8')));
 assert.deepEqual(unguarded,[]);
});
