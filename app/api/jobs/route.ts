import {timingSafeEqual,randomUUID} from 'node:crypto';
import type {RowDataPacket} from 'mysql2';
import {transaction,expireDefiniteHolds,sqlDate} from '@/lib/commerce';
import {reconcilePayment,processRefund} from '@/lib/square';
import {json} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){
 const token=process.env.PUNA_JOB_TOKEN,provided=req.headers.get('authorization')||'';
 if(!token||token.length<32)return json({error:'Jobs disabled'},503);
 const a=Buffer.from('Bearer '+token),b=Buffer.from(provided);if(a.length!==b.length||!timingSafeEqual(a,b))return json({error:'Access denied'},403);
 let processed=0,blocked=0;
 await transaction(async(c,now)=>expireDefiniteHolds(c,now));
 for(let n=0;n<10;n++){
  const job=await transaction(async(c,now)=>{
   const [rows]=await c.query<RowDataPacket[]>("SELECT * FROM provider_jobs WHERE (status='pending' OR (status='running' AND locked_until<UTC_TIMESTAMP(3))) AND available_at<=UTC_TIMESTAMP(3) AND kind<>'receipt' ORDER BY available_at LIMIT 1 FOR UPDATE");
   if(!rows[0])return null;const j=rows[0];
   await c.execute("UPDATE provider_jobs SET status='running',locked_until=?,attempt_count=attempt_count+1 WHERE id=?",[sqlDate(now+90000),j.id]);return j;
  });if(!job)break;
  try{
   const result=job.kind==='refund'?await processRefund(job.order_id):await reconcilePayment(job.order_id);
   const pending='state' in result&&['pending','uncertain'].includes(result.state);
   await transaction(async(c,now)=>{await c.execute("UPDATE provider_jobs SET status=?,locked_until=NULL,available_at=? WHERE id=?",[pending?'pending':'done',sqlDate(now+60000),job.id]);});
  }catch{
   const stop=Number(job.attempt_count)+1>=8;
   await transaction(async(c,now)=>{await c.execute("UPDATE provider_jobs SET status=?,locked_until=NULL,available_at=?,last_error_code='RECONCILIATION_REQUIRED' WHERE id=?",[stop?'blocked':'pending',sqlDate(now+Math.min(3600,30*2**Number(job.attempt_count))*1000),job.id]);
    if(stop)await c.execute("INSERT INTO operations_notices(id,actor_id,kind,message) SELECT ?,id,'payment',? FROM users WHERE role='owner' AND active=1 ORDER BY id LIMIT 1",[randomUUID(),'Payment reconciliation blocked for order '+job.order_id]);});
   if(stop)blocked++;
  }processed++;
 }
 return json({processed,blocked});
}
