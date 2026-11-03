import type {RowDataPacket} from 'mysql2';
import {z} from 'zod';
import {requireRole} from '@/lib/auth';
import {database} from '@/lib/db';
import {json,failure} from '@/lib/http';

export const runtime='nodejs';
const query=z.object({
 scope:z.enum(['live','sandbox']).default('live'),
 filter:z.enum(['all','active','ready','complete','exceptions']).default('active'),
 page:z.coerce.number().int().min(1).max(10000).default(1)
}).strict();
const active="o.payment_status='paid' AND o.refund_status='none' AND o.order_status='open' AND o.fulfilment_status<>'collected'";
const exception="(o.order_status='exception' OR o.payment_status IN ('inflight','uncertain') OR o.refund_status IN ('pending','failed'))";
const filters:Record<string,string>={all:'1=1',active,ready:active+" AND o.fulfilment_status='ready'",complete:"o.order_status='complete' OR o.fulfilment_status='collected'",exceptions:exception};

// Owner projection only. Operational staff keep the smaller /api/operations projection.
export async function GET(req:Request){
 try{
  await requireRole(['owner']);
  const params=new URL(req.url).searchParams;
  if([...params.keys()].some(k=>params.getAll(k).length!==1))return json({error:'Invalid order filters'},400);
  const parsed=query.safeParse(Object.fromEntries(params));
  if(!parsed.success)return json({error:'Invalid order filters'},400);
  const {scope,filter,page}=parsed.data,isTest=scope==='sandbox'?1:0,pageSize=25;
  const db=database();
  const [counts]=await db.execute<RowDataPacket[]>(`SELECT
   COALESCE(SUM(${active}),0) AS activeOrders,
   COALESCE(SUM((${active}) AND o.fulfilment_status='ready'),0) AS readyOrders,
   COALESCE(SUM(${exception}),0) AS exceptions
   FROM pickup_orders o WHERE o.is_test=?`,[isTest]);
  const [batchCount]=await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM service_batches WHERE state='open' AND cutoff_at>UTC_TIMESTAMP(3)");
  const predicate='o.is_test=? AND ('+filters[filter]+')';
  const [totals]=await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM pickup_orders o WHERE '+predicate,[isTest]);
  const orderBy=['active','ready'].includes(filter)?'b.pickup_at,o.created_at,o.id':'o.created_at DESC,o.id DESC';
  const [orders]=await db.query<RowDataPacket[]>(`SELECT o.id,o.batch_id,o.contact_name,
   o.payment_status,o.refund_status,o.order_status,o.fulfilment_status,o.total_cents,
   o.subtotal_cents,o.discount_cents,o.tax_cents,o.deposit_cents,o.currency,o.is_test,
   o.created_at,b.pickup_at,b.pickup_until,b.state AS batch_state
   FROM pickup_orders o JOIN service_batches b ON b.id=o.batch_id
   WHERE ${predicate} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,[isTest,pageSize,(page-1)*pageSize]);
  const linesByOrder=new Map<string,RowDataPacket[]>();
  if(orders.length){
   const [lines]=await db.execute<RowDataPacket[]>(`SELECT order_id,name,quantity,unit_price_cents FROM pickup_order_lines WHERE order_id IN (${orders.map(()=>'?').join(',')}) ORDER BY name`,orders.map(o=>o.id));
   for(const line of lines){const list=linesByOrder.get(line.order_id)||[];list.push(line);linesByOrder.set(line.order_id,list);}
  }
  return json({scope,filter,page,pageSize,total:Number(totals[0].n),serverTime:new Date().toISOString(),
   checkoutMode:process.env.PUNA_CHECKOUT_MODE==='square-sandbox'?'square-sandbox':'disabled',
   summary:{activeOrders:Number(counts[0].activeOrders),readyOrders:Number(counts[0].readyOrders),exceptions:Number(counts[0].exceptions),openBatches:Number(batchCount[0].n)},
   orders:orders.map(o=>({...o,items:(linesByOrder.get(o.id)||[]).map(i=>({name:i.name,quantity:Number(i.quantity),unit_price_cents:Number(i.unit_price_cents)}))}))});
 }catch(e){return failure(e);}
}
