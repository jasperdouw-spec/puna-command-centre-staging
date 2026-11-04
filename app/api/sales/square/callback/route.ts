import {requireRole} from '@/lib/auth';
import {finishSquareAuthorization,withSquareDeadline} from '@/lib/square-reporting';
export const runtime='nodejs';
export async function GET(req:Request){
 // No code, state, token or provider error body is returned or logged.
 let ok=false;
 try{const u=await requireRole(['owner']),q=new URL(req.url).searchParams,state=q.get('state'),code=q.get('code');if(state&&code&&state.length<200&&code.length<1000){await withSquareDeadline(()=>finishSquareAuthorization(u.id,state,code));ok=true;}}catch{}
 return new Response(null,{status:303,headers:{Location:'/workspace?view=today&tab=sales&square='+(ok?'connected':'authorization-failed'),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
