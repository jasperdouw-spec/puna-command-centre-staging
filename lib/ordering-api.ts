import 'server-only';
import {cookies} from 'next/headers';
import {checkOrigin} from './auth';
import {json,failure} from './http';
import {CommerceError} from './commerce-model';
import {localRequest,boundedJson,seal,unseal,opaqueToken,orderingIntake} from './ordering-gates';
import {orderingInput} from './ordering-input';
import {orderingCatalogue,orderingLimit,orderingQuote,orderingReserve,orderingStatus,tokenOrder,reject} from './ordering';
import {payOrdering,reconcileOrdering} from './ordering-payments';
import {dispatchNotifications} from './ordering-notifications';
import {transaction} from './commerce';
export async function orderingGet(req:Request){if(!localRequest(req))return json({mode:'disabled'});try{return json({mode:'local-simulated',...(await orderingCatalogue())});}catch(e){return e instanceof CommerceError?json({error:e.code},e.status):failure(e);}}
export async function orderingPost(req:Request){if(!localRequest(req))return json({error:'Local ordering unavailable'},404);if(!checkOrigin(req))return json({error:'Invalid origin'},403);try{
 const parsed=orderingInput.safeParse(await boundedJson(req));if(!parsed.success)return json({error:'Invalid checkout request'},400);const p=parsed.data,jar=await cookies();let session='';try{const v=unseal<{id:string;expires:number}>(jar.get('puna-local-customer')?.value||'','customer-session');if(v.expires>Date.now())session=v.id;}catch{}
 if(p.action==='session'){await orderingLimit('session-global','loopback',300);if(!session)session=opaqueToken();const r=json({local:true,intakeOpen:orderingIntake()});r.cookies.set('puna-local-customer',seal({id:session,expires:Date.now()+86400000},'customer-session'),{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:86400});return r;}
 // Shared process limits also bound token-guess attempts across new cookie sessions.
 await orderingLimit(p.action+'-global','loopback',p.action==='status'?600:120);
 if(!session)reject('START_LOCAL_SESSION',401);await orderingLimit(p.action,session,p.action==='status'?200:p.action==='reserve'?6:30);
 if(p.action==='quote')return json(await orderingQuote(p.items));
 if(p.action==='reserve'){await orderingLimit('hold-email',p.email.toLowerCase(),6);return json(await orderingReserve(p,session),201);}
 if(p.action==='status')return json(await orderingStatus(p.token));
 if(p.action==='pay'){const r=await payOrdering(p.token);await dispatchNotifications();return json(r);}
 const id=await transaction(async(c,now)=>(await tokenOrder(c,p.token,now)).id);const r=await reconcileOrdering(id);await dispatchNotifications();return json(r);
 }catch(e){return e instanceof CommerceError?json({error:e.code},e.status):failure(e);}}
