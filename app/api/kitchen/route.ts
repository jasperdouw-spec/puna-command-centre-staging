import {checkOrigin,requireRole} from '@/lib/auth';
import {json,failure} from '@/lib/http';
import {kitchenEnabled,kitchenSnapshot,kitchenAction,KitchenError} from '@/lib/kitchen';
import {kitchenInput} from '@/lib/kitchen-input';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{if(!kitchenEnabled())return json({error:'Live Kitchen is disabled'},404);await requireRole(['owner','manager','staff']);return json(await kitchenSnapshot());}catch(e){return e instanceof KitchenError?json({error:e.message},e.status):failure(e);}}
export async function POST(req:Request){
 if(!kitchenEnabled())return json({error:'Live Kitchen is disabled'},404);
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const actor=await requireRole(['owner','manager','staff']),reader=req.body?.getReader();if(!reader)return json({error:'Missing request'},400);
  const chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16000){await reader.cancel();return json({error:'Request too large'},413);}chunks.push(value);}}finally{reader.releaseLock();}
  const p=kitchenInput.safeParse(JSON.parse(Buffer.concat(chunks).toString()));if(!p.success)return json({error:'Invalid kitchen action'},400);
  return json(await kitchenAction(actor,p.data));
 }catch(e){return e instanceof KitchenError?json({error:e.message},e.status):e instanceof SyntaxError?json({error:'Invalid JSON'},400):failure(e);}
}
