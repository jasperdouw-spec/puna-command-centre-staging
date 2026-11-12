import {z} from 'zod';
import type {RowDataPacket} from 'mysql2/promise';
import {fixtureAccess,boundedJson,unseal} from '@/lib/ordering-gates';
import {transaction,sqlDate} from '@/lib/commerce';
import {json,failure} from '@/lib/http';
import {CommerceError} from '@/lib/commerce-model';
import {reconcileDue,reconcileOrdering,eventSignature,localProviderWebhook} from '@/lib/ordering-payments';
import {dispatchNotifications} from '@/lib/ordering-notifications';
import {loadOrder,reject} from '@/lib/ordering';
export const runtime='nodejs';
const number=z.string().regex(/^PUNA-[A-F0-9]{10}$/);
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('payment-scenario'),orderNumber:number,scenario:z.enum(['success','decline','failure','timeout','uncertain','delayed_success','wrong_amount','wrong_currency','wrong_merchant','wrong_location']),latencyMs:z.number().int().min(0).max(5000).optional()}).strict(),
 z.object({action:z.literal('provider-state'),orderNumber:number,state:z.enum(['COMPLETED','FAILED','CANCELED','PENDING']),eventId:z.string().uuid(),invalidSignature:z.boolean().optional(),eventStatus:z.string().max(30).optional()}).strict(),
 z.object({action:z.literal('run-jobs')}).strict(),
 z.object({action:z.literal('email-failures'),orderNumber:number,count:z.number().int().min(0).max(5)}).strict(),
 z.object({action:z.literal('captures'),orderNumber:number}).strict(),
 z.object({action:z.literal('reconcile'),orderNumber:number}).strict()
]);
export async function POST(req:Request){if(!fixtureAccess(req))return json({error:'Not found'},404);try{const parsed=input.safeParse(await boundedJson(req));if(!parsed.success)return json({error:'Invalid local fixture'},400);const p=parsed.data;if(p.action==='run-jobs')return json({payment:await reconcileDue(),notifications:await dispatchNotifications()});const id=await transaction(async c=>{const [r]=await c.execute<RowDataPacket[]>('SELECT order_id FROM kitchen_order_details WHERE order_number=?',[p.orderNumber]);if(!r[0])reject('ORDER_NOT_FOUND',404);return r[0].order_id;});
 if(p.action==='payment-scenario'){await transaction(async c=>{await c.execute('UPDATE local_payment_simulations SET scenario=?,latency_ms=? WHERE order_id=? AND calls=0',[p.scenario,p.latencyMs||0,id]);});return json({ok:true});}
 if(p.action==='provider-state'){const event=await transaction(async c=>{await c.execute('UPDATE local_payment_simulations SET state=? WHERE order_id=?',[p.state,id]);const [r]=await c.execute<RowDataPacket[]>('SELECT provider_payment_id FROM local_payment_simulations WHERE order_id=?',[id]);return {eventId:p.eventId,orderId:id,paymentId:r[0].provider_payment_id,merchant:'local-merchant',location:'local-truck',status:p.eventStatus||p.state};});const raw=JSON.stringify(event);return json(await localProviderWebhook(raw,p.invalidSignature?'invalid':eventSignature(raw)));}
 if(p.action==='email-failures'){await transaction(async c=>{await c.execute("UPDATE kitchen_notifications SET fixture_failures=? WHERE order_id=? AND state='pending'",[p.count,id]);});return json({ok:true});}
 if(p.action==='reconcile')return json(await reconcileOrdering(id,true));
 const captures=await transaction(async c=>{const [r]=await c.execute<RowDataPacket[]>('SELECT e.sealed_content,n.kind,n.state,n.attempts FROM local_email_captures e JOIN kitchen_notifications n ON n.id=e.notification_id WHERE n.order_id=? ORDER BY e.created_at',[id]);return r.map(x=>({type:x.kind,state:x.state,attempts:x.attempts,content:unseal(x.sealed_content,'email-capture')}));});return json({captures});
 }catch(e){return e instanceof CommerceError?json({error:e.code},e.status):failure(e);}}
