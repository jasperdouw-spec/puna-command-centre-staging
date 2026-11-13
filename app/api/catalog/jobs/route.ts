import {timingSafeEqual} from 'node:crypto';
import {json} from '@/lib/http';
import {syncSquareCatalog} from '@/lib/square-catalog';
import {CommerceError} from '@/lib/commerce-model';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){
 const expected=Buffer.from(process.env.PUNA_REPORTING_JOB_TOKEN||''),supplied=Buffer.from(req.headers.get('authorization')?.replace(/^Bearer /,'')||'');
 if(process.env.PUNA_REPORTING_SCHEDULE_ENABLED!=='true'||process.env.PUNA_CATALOG_ENABLED==='false'||expected.length<32||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return json({error:'Access denied'},403);
 try{return json(await syncSquareCatalog(null));}catch(e){return json({error:e instanceof CommerceError?e.code:'CATALOG_JOB_FAILED'},503);}
}
