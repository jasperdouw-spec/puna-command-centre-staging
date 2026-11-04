// Private, offline preparation. Does not connect to a database or Square.
// node scripts/prepare-square-import.mjs /absolute/private/manifest.json /absolute/private/output
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const [manifestPath,outArg]=process.argv.slice(2);
if(!manifestPath||!outArg||!isAbsolute(manifestPath)||!isAbsolute(outArg))throw Error('Two private absolute paths required');
const root=realpathSync('.'),out=resolve(outArg);
if(!relative(root,out).startsWith('..'))throw Error('Private output must be outside the repository');
mkdirSync(out,{recursive:true,mode:0o700});
if(!relative(root,realpathSync(out)).startsWith('..'))throw Error('Private output symlink resolves inside repository');
const source=readFileSync('lib/sales-model.ts','utf8');
writeFileSync(out+'/sales-model.mjs',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,{mode:0o600});
const {previewCsv}=await import(pathToFileURL(out+'/sales-model.mjs'));
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
if(!Array.isArray(manifest.files)||!manifest.files.length)throw Error('Manifest files required');
const files=manifest.files.map(f=>{if(!isAbsolute(f.path)||!f.sha256?.match(/^[a-f0-9]{64}$/))throw Error('Every original requires a private absolute path and registered SHA-256');return {name:f.name,bytes:readFileSync(f.path),expectedHash:f.sha256};});
const p=previewCsv(files);
const summary={id:p.id,manifest:p.manifest,preview:p.preview,rejections:p.stages.filter(r=>r.error).map(r=>({fileHash:r.fileHash,sourceRow:r.sourceRow,error:r.error})),unresolvedProducts:[...new Map(p.stages.filter(r=>r.line).map(r=>[r.line.productKey,{key:r.line.productKey,item:r.line.item,variant:r.line.variant,sku:r.line.sku}])).values()]};
writeFileSync(out+'/dry-run.json',JSON.stringify(summary,null,2)+'\n',{mode:0o600});
writeFileSync(out+'/minimized-rows.json',JSON.stringify(p.stages)+'\n',{mode:0o600});
console.log(JSON.stringify({status:p.preview.rejected?'rejected':'prepared',privateReport:out+'/dry-run.json',hostedImport:false}));
