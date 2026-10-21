import {beginGoogle,googleConfigured} from '@/lib/google-identity';
import {checkOrigin} from '@/lib/auth';
import {json} from '@/lib/http';
import {CommerceError} from '@/lib/commerce-model';
export const runtime='nodejs';
export async function GET(){return json({configured:googleConfigured()})}
export async function POST(req:Request){if(!checkOrigin(req))return json({error:'Invalid origin'},403);try{const p=await req.json();if(p.invitation&&(!/^[a-f0-9]{64}$/.test(p.invitation)))return json({error:'Invalid invitation'},400);return json({url:await beginGoogle(p.invitation,p.link===true)})}catch(e){return json({error:e instanceof CommerceError?e.code:'Identity unavailable'},e instanceof CommerceError?e.status:503)}}
