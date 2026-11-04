import {timingSafeEqual} from 'node:crypto';
import {json} from '@/lib/http';
import {createSalesRun,advanceSalesRun} from '@/lib/sales-refresh';
import {SalesError} from '@/lib/sales-model';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){
 const expected=process.env.PUNA_REPORTING_JOB_TOKEN,supplied=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(process.env.PUNA_REPORTING_SCHEDULE_ENABLED!=='true'||!expected||expected.length<32||expected.length!==supplied.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return json({error:'Access denied'},403);
 try{const run=await createSalesRun(null,'refresh');return json(await advanceSalesRun(null,run.id));}catch(e){return json({error:e instanceof SalesError?e.code:'REPORTING_JOB_FAILED'},503);}
}
