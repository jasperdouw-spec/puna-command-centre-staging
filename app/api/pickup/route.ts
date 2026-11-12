import {requireRole,checkOrigin} from '@/lib/auth';
import {json,failure} from '@/lib/http';
import {CommerceError} from '@/lib/commerce-model';
import {localRequest,boundedJson} from '@/lib/ordering-gates';
import {pickupInput} from '@/lib/ordering-input';
import {orderingLimit,workerQueue,workerInspect,workerMutation} from '@/lib/ordering';
import {dispatchNotifications} from '@/lib/ordering-notifications';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){if(!localRequest(req))return json({error:'Local pickup unavailable'},404);try{await requireRole(['owner','manager','staff']);return json(await workerQueue());}catch(e){return e instanceof CommerceError?json({error:e.code},e.status):failure(e);}}
export async function POST(req:Request){if(!localRequest(req))return json({error:'Local pickup unavailable'},404);if(!checkOrigin(req))return json({error:'Invalid origin'},403);try{const actor=await requireRole(['owner','manager','staff']);await orderingLimit('worker',String(actor.id),120);const input=pickupInput.safeParse(await boundedJson(req));if(!input.success)return json({error:'Invalid pickup action'},400);const p=input.data;if(p.action==='inspect')return json(await workerInspect(actor,p));if(p.action==='manual-lookup')return json(await workerInspect(actor,p,true));const r=await workerMutation(actor,p);await dispatchNotifications();return json(r);}catch(e){return e instanceof CommerceError?json({error:e.code},e.status):failure(e);}}
