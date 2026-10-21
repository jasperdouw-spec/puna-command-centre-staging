import {z} from 'zod';
import {beginGoogle,googleConfigured} from '@/lib/google-identity';
import {checkOrigin} from '@/lib/auth';
import {json} from '@/lib/http';
import {CommerceError} from '@/lib/commerce-model';
import {transaction,rateLimit} from '@/lib/commerce';
export const runtime='nodejs';
const input=z.object({invitation:z.string().regex(/^[a-f0-9]{64}$/).optional(),link:z.boolean().optional()}).strict();
export async function GET(){return json({configured:googleConfigured()})}
export async function POST(req:Request){
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{const raw=await req.text();if(raw.length>1000)return json({error:'Request too large'},413);const p=input.safeParse(JSON.parse(raw));if(!p.success)return json({error:'Invalid identity request'},400);
 if(!await transaction(async(c,now)=>rateLimit(c,'google-start',now,30)))return json({error:'Please wait before trying again'},429);
 return json({url:await beginGoogle(p.data.invitation,p.data.link===true)});
 }catch(e){if(e instanceof SyntaxError)return json({error:'Invalid JSON'},400);return json({error:e instanceof CommerceError?e.code:'Identity unavailable'},e instanceof CommerceError?e.status:503)}
}
