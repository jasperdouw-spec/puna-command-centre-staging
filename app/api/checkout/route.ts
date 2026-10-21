import {z} from 'zod';
import {checkOrigin} from '@/lib/auth';
import {json,failure} from '@/lib/http';
import {CommerceError,cartInput} from '@/lib/commerce-model';
import {checkoutQuote,reserve,commerceEnabled,transaction,rateLimit,orderAccess} from '@/lib/commerce';
import {startPayment} from '@/lib/square';
import type {RowDataPacket} from 'mysql2';
export const runtime='nodejs';
const key=z.string().regex(/^[a-f0-9]{64}$/),id=z.string().uuid();
const payload=z.discriminatedUnion('action',[
 z.object({action:z.literal('quote'),cart:cartInput}).strict(),
 z.object({action:z.literal('reserve'),checkoutKey:id,accessKey:key,batchId:id,cart:cartInput,name:z.string().trim().min(1).max(80),email:z.string().email().max(254)}).strict(),
 z.object({action:z.literal('pay'),id,accessKey:key,sourceToken:z.string().min(1).max(500)}).strict(),
 z.object({action:z.literal('receipt'),id,accessKey:key}).strict()
]);
export async function GET(){return json({mode:commerceEnabled()?'square-sandbox':'disabled',applicationId:commerceEnabled()?process.env.SQUARE_SANDBOX_APPLICATION_ID:null,locationId:commerceEnabled()?process.env.SQUARE_SANDBOX_LOCATION_ID:null,pickup:'truck',currency:'CAD',timezone:'America/Vancouver'});}
export async function POST(req:Request){
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const raw=await req.text();if(raw.length>12000)return json({error:'Request too large'},413);
  const parsed=payload.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Invalid checkout request'},400);const p=parsed.data;
  const allowed=await transaction(async(c,now)=>rateLimit(c,'checkout:'+p.action,now,p.action==='quote'?300:p.action==='receipt'?300:60));
  if(!allowed)return json({error:'Please wait before trying again'},429);
  if(p.action==='quote')return json(await checkoutQuote(p.cart));
  if(p.action==='receipt')return json(await transaction(async(c)=>{
   const o=await orderAccess(c,p.id,p.accessKey);
   const [lines]=await c.execute<RowDataPacket[]>('SELECT name,quantity,unit_price_cents,tax_cents,deposit_cents FROM pickup_order_lines WHERE order_id=?',[o.id]);
   const [batches]=await c.execute<RowDataPacket[]>('SELECT pickup_at,pickup_until FROM service_batches WHERE id=?',[o.batch_id]);
   return {id:o.id,paymentStatus:o.payment_status,refundStatus:o.refund_status,orderStatus:o.order_status,fulfilmentStatus:o.fulfilment_status,subtotalCents:o.subtotal_cents,taxCents:o.tax_cents,depositCents:o.deposit_cents,totalCents:o.total_cents,currency:'CAD',isTest:!!o.is_test,pickup:'Puna food truck',pickupAt:new Date(batches[0].pickup_at).toISOString(),pickupUntil:new Date(batches[0].pickup_until).toISOString(),lines,receiptDelivery:'not configured'};
  }));
  if(!commerceEnabled())return json({error:'Sandbox checkout is not configured'},503);
  if(p.action==='reserve')return json(await reserve(p),201);
  return json(await startPayment(p.id,p.accessKey,p.sourceToken));
 }catch(e){if(e instanceof SyntaxError)return json({error:'Invalid JSON'},400);if(e instanceof CommerceError)return json({error:e.code},e.status);return failure(e);}
}
