import {boundedArray} from '@/lib/bounded-array';
import {z} from 'zod';
import type {RowDataPacket} from 'mysql2';
import {checkOrigin,requireRole} from '@/lib/auth';
import {json,failure} from '@/lib/http';
import {database} from '@/lib/db';
import {salesDashboard} from '@/lib/sales-dashboard';
import {today} from '@/lib/sales-periods';
import {SalesError,validDay} from '@/lib/sales-model';
import {prepareSales,commitSales,salesReport,mapSalesProduct,reportingAvailable,referenceInput,prepareReferences,commitReferences,referenceRecords} from '@/lib/sales';
import {beginSquareAuthorization,inspectSquareAccess,captureSquareReport} from '@/lib/square-reporting';
import {createSalesRun,advanceSalesRun,reconcileSalesOrder,restartSalesCursor} from '@/lib/sales-refresh';
export const runtime='nodejs';
export const maxDuration=60;
const hex=z.string().regex(/^[a-f0-9]{64}$/),day=z.string().refine(validDay);
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('import'),id:hex}).strict(),
 z.object({action:z.literal('map'),key:hex,productId:z.string().max(64).nullable(),version:z.number().int().positive()}).strict(),
 z.object({action:z.literal('authorize')}).strict(),z.object({action:z.literal('inspect')}).strict(),
 z.object({action:z.literal('report'),from:day,to:day,profile:z.enum(['sales','items'])}).strict(),
 z.object({action:z.literal('refresh')}).strict(),
 z.object({action:z.literal('backfill'),start:z.string().datetime({offset:true}),end:z.string().datetime({offset:true})}).strict(),
 z.object({action:z.literal('continue'),id:z.string().uuid()}).strict(),
 z.object({action:z.literal('restart-cursor'),id:z.string().uuid()}).strict(),
 z.object({action:z.literal('reconcile'),id:z.string().min(1).max(191),version:z.number().int().positive(),choice:z.enum(['csv','api'])}).strict(),
 z.object({action:z.literal('preview-references'),items:boundedArray(referenceInput,50,1)}).strict(),
 z.object({action:z.literal('import-references'),id:hex}).strict()
]);
function error(e:unknown){return e instanceof SalesError?json({error:e.code},e.status):e instanceof z.ZodError||e instanceof SyntaxError||e instanceof TypeError?json({error:'Invalid reporting input'},400):failure(e);}
async function boundedBody(req:Request,max:number){
 const reader=req.body?.getReader();if(!reader)throw new SalesError('EMPTY_REQUEST');const chunks:Uint8Array[]=[];let n=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();throw new SalesError('REQUEST_TOO_LARGE',413);}chunks.push(value);}}finally{reader.releaseLock();}
 return Buffer.concat(chunks);
}
export async function GET(req:Request){try{
 await requireRole(['owner']);const q=new URL(req.url).searchParams;
 if(q.get('view')==='dashboard'){const kind=z.enum(['day','week','month']).parse(q.get('period')||'day'),date=day.parse(q.get('date')||today()),product=q.get('product')?hex.parse(q.get('product')):undefined;if(date>today()||date<'2000-01-01')throw new SalesError('INVALID_DATE_RANGE');return json(await salesDashboard(kind,date,product));}
 if(q.get('references')==='true')return json({references:await referenceRecords()});
 if(q.has('batch')){
  const id=hex.parse(q.get('batch'));const [rows]=await database().execute<RowDataPacket[]>('SELECT file_hash,source_row,error_code FROM sales_stage WHERE batch_id=? AND error_code IS NOT NULL ORDER BY ordinal LIMIT 100',[id]);return json({rejections:rows,limit:100});
 }
 if(q.has('trace')){
  const key=z.string().max(180).parse(q.get('trace'));const [rows]=await database().execute<RowDataPacket[]>('SELECT d.*,s.file_hash,s.source_row,b.manifest FROM sales_details d LEFT JOIN sales_stage s ON s.row_hash=d.row_hash LEFT JOIN sales_batches b ON b.id=s.batch_id WHERE d.source_key=? LIMIT 100',[key]);return json({provenance:rows.map(r=>({...r,manifest:r.manifest?JSON.parse(r.manifest):null}))});
 }
 const from=day.parse(q.get('from')||'2000-01-01'),to=day.parse(q.get('to')||new Date().toISOString().slice(0,10)),group=z.enum(['day','month','product','category','location']).parse(q.get('group')||'month');if(from>to)throw new SalesError('INVALID_DATE_RANGE');
 return json(await salesReport(from,to,group));
 }catch(e){return error(e)}}
export async function POST(req:Request){
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const actor=await requireRole(['owner']);if(!await reportingAvailable())throw new SalesError('REPORTING_MIGRATION_REQUIRED',409);
  if(req.headers.get('content-type')?.startsWith('multipart/form-data')){
   const bytes=await boundedBody(req,41*1024*1024),form=await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')!}}).formData();
   const entries=form.getAll('files');if(!entries.length||entries.length>8||entries.some(f=>typeof f==='string'))throw new SalesError('CSV_FILES_REQUIRED');
   const files=await Promise.all((entries as File[]).map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())})));return json(await prepareSales(actor.id,files));
  }
  const p=input.parse(JSON.parse((await boundedBody(req,2*1024*1024)).toString('utf8')));
  if(p.action==='import')return json(await commitSales(actor.id,p.id));
  if(p.action==='map')return json(await mapSalesProduct(actor.id,p.key,p.productId,p.version));
  if(p.action==='authorize')return json(await beginSquareAuthorization(actor.id));
  if(p.action==='inspect')return json(await inspectSquareAccess());
  if(p.action==='report')return json(await captureSquareReport(actor.id,p.from,p.to,p.profile));
  if(p.action==='refresh')return json(await createSalesRun(actor.id,'refresh'));
  if(p.action==='backfill')return json(await createSalesRun(actor.id,'backfill',p.start,p.end));
  if(p.action==='continue')return json(await advanceSalesRun(actor.id,p.id));
  if(p.action==='restart-cursor')return json(await restartSalesCursor(actor.id,p.id));
  if(p.action==='reconcile')return json(await reconcileSalesOrder(actor.id,p.id,p.version,p.choice));
  if(p.action==='preview-references')return json(await prepareReferences(actor.id,p.items));
  return json(await commitReferences(actor.id,p.id));
 }catch(e){return error(e)}
}
