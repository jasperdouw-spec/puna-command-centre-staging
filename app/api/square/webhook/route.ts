import {handleWebhook} from '@/lib/square';
import {CommerceError} from '@/lib/commerce-model';
import {json} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){
 if(Number(req.headers.get('content-length')||0)>65536)return json({error:'Payload too large'},413);
 try{const raw=await req.text();if(raw.length>65536)return json({error:'Payload too large'},413);return json(await handleWebhook(raw,req.headers.get('x-square-hmacsha256-signature')));}
 catch(e){return json({error:e instanceof CommerceError?e.code:'Event could not be accepted'},e instanceof CommerceError?e.status:503)}
}
