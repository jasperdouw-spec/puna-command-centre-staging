import {syncSquareCatalog} from '@/lib/square-catalog';
import {timingSafeEqual} from 'node:crypto';
import {json} from '@/lib/http';
import {createSalesRun,advanceSalesRun} from '@/lib/sales-refresh';
import {SalesError} from '@/lib/sales-model';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){
 const expected=process.env.PUNA_REPORTING_JOB_TOKEN,supplied=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 const expectedBytes=Buffer.from(expected||''),suppliedBytes=Buffer.from(supplied);
 if(process.env.PUNA_REPORTING_SCHEDULE_ENABLED!=='true'||!expected||expected.length<32||expectedBytes.length!==suppliedBytes.length||!timingSafeEqual(expectedBytes,suppliedBytes))return json({error:'Access denied'},403);
 const [reporting,catalog]=await Promise.allSettled([(async()=>{const run=await createSalesRun(null,'refresh');return advanceSalesRun(null,run.id);})(),process.env.PUNA_CATALOG_ENABLED==='false'?Promise.resolve({disabled:true}):syncSquareCatalog(null)]);
 const catalogStatus=catalog.status==='fulfilled'?catalog.value:{error:'CATALOG_SYNC_NEEDS_ATTENTION'};
 if(reporting.status==='fulfilled')return json({...reporting.value,catalog:catalogStatus});
 return json({error:reporting.reason instanceof SalesError?reporting.reason.code:'REPORTING_JOB_FAILED',catalog:catalogStatus},503);
}
