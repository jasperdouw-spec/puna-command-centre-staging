import {hash,SalesError,decimalUnits,localDay,TIMEZONE,type SalesLine} from './sales-model';
// Provider responses are never persisted wholesale. Unknown fields (customer,
// address, card, notes, fulfillment details) are deliberately not projected.
type Obj=Record<string,any>;
export function reportingCents(value:unknown):number|null{
 if(value===null||value===undefined)return null;
 // Cube currently returns floating point currency. Accept only amounts within
 // a tiny serialization tolerance of exact cents, then store integer cents.
 if(typeof value==='string'&&!/^-?\d+(\.\d+)?$/.test(value))throw new SalesError('REPORT_AMOUNT_INVALID');
 const scaled=Number(value)*100,cents=Math.round(scaled);
 if(!Number.isSafeInteger(cents)||Math.abs(scaled-cents)>0.0001)throw new SalesError('REPORT_AMOUNT_PRECISION');
 return cents;
}
export function squareMoney(m:Obj|undefined,optional=false):number{
 if(m===undefined&&optional)return 0;
 if(!m||m.currency!=='CAD'||!Number.isSafeInteger(m.amount)||Math.abs(m.amount)>1e12)throw new SalesError('SQUARE_MONEY_INVALID',409);return m.amount;
}
function id(v:unknown){if(typeof v!=='string'||!v||v.length>191)throw new SalesError('SQUARE_ID_INVALID',409);return v;}
function label(v:unknown){if(v===undefined)return '';if(typeof v!=='string'||v.length>255)throw new SalesError('SQUARE_LABEL_INVALID',409);return v;}
export function normalizeSquareOrder(o:Obj){
 const orderId=id(o.id),location=id(o.location_id),updatedAt=id(o.updated_at),timestamp=id(o.closed_at||o.created_at),date=localDay(timestamp);localDay(updatedAt);
 const paymentIds=[...new Set<string>((o.tenders||[]).map((t:Obj)=>id(t.payment_id||t.id)))];
 const lines:Array<{key:string;line:SalesLine}>=[];let reason:string|null=null;
 try{
  if(o.state!=='COMPLETED')throw new SalesError('ORDER_NOT_COMPLETED');
  if((o.service_charges||[]).length||squareMoney(o.total_service_charge_money,true)!==0)throw new SalesError('SERVICE_CHARGE_REVIEW');
  function add(l:Obj,sign:number,uid:string){
   const gross=sign*squareMoney(sign===1?l.gross_sales_money:l.gross_return_money),discount=sign*squareMoney(l.total_discount_money,true),tax=sign*squareMoney(l.total_tax_money,true),total=sign*squareMoney(l.total_money);
   if(gross-discount+tax!==total)throw new SalesError('LINE_TOTAL_REVIEW');
   const qty=decimalUnits(String(l.quantity),4);if(qty<0)throw new SalesError('QUANTITY_SIGN_REVIEW');
   const item=label(l.name),variant=label(l.variation_name),catalogId=l.catalog_object_id?id(l.catalog_object_id):'';
   const line:SalesLine={rowHash:'',transactionId:orderId,paymentId:paymentIds.length===1?paymentIds[0]:'',orderId,
    productKey:hash(JSON.stringify(['api',catalogId,item,variant])),item,variant,sku:catalogId,category:'',location,localDate:date,
    originalTimestamp:timestamp,timezone:TIMEZONE,timestampStatus:'provider_offset',soldAt:new Date(timestamp).toISOString().slice(0,19).replace('T',' '),event:sign===1?'Payment':'Refund',quantity:(sign*qty/10000).toFixed(4),grossCents:gross,discountCents:discount,netCents:gross-discount,taxCents:tax,refundCents:sign===-1?-(gross-discount):0};
   line.rowHash=hash(JSON.stringify(line));lines.push({key:'api:'+hash(JSON.stringify([orderId,uid])),line});
  }
  for(const l of o.line_items||[])add(l,1,'sale:'+id(l.uid));
  for(const r of o.returns||[]){
   if(r.return_service_charges?.length)throw new SalesError('RETURN_SERVICE_CHARGE_REVIEW');
   for(const l of r.return_line_items||[])add(l,-1,'return:'+id(r.uid||r.source_order_id||'unspecified')+':'+id(l.uid));
  }
  if(!lines.length||new Set(lines.map(l=>l.key)).size!==lines.length)throw new SalesError('ORDER_LINES_REVIEW');
  const amounts=o.net_amounts||o;
  const tip=squareMoney(amounts.tip_money||amounts.total_tip_money,true);
  const total=squareMoney(amounts.total_money);
  const rounding=squareMoney(o.rounding_adjustment?.amount_money,true)-(o.returns||[]).reduce((n:number,r:Obj)=>n+squareMoney(r.rounding_adjustment?.amount_money,true),0);
  if(lines.reduce((n,l)=>n+l.line.netCents+l.line.taxCents,0)+tip+rounding!==total)throw new SalesError('ORDER_TOTAL_REVIEW');
 }catch(e){if(!(e instanceof SalesError))throw e;reason=e.code;lines.length=0;}
 const payload={id:orderId,locationId:location,updatedAt,occurredAt:timestamp,localDate:date,state:label(o.state),paymentIds,lines,
  // No zero claims for absent order-level amounts.
  tipCents:o.total_tip_money?squareMoney(o.total_tip_money):null,totalCents:o.total_money?squareMoney(o.total_money):null,
  roundingCents:squareMoney(o.rounding_adjustment?.amount_money,true)};
 return {payload,reason,contentHash:hash(JSON.stringify(payload))};
}
export function normalizeRefund(r:Obj){
 const out={id:id(r.id),paymentId:id(r.payment_id),orderId:r.order_id?id(r.order_id):null,locationId:id(r.location_id),status:id(r.status),amountCents:squareMoney(r.amount_money),createdAt:id(r.created_at),updatedAt:id(r.updated_at)};
 if(out.amountCents<0||!['PENDING','COMPLETED','REJECTED','FAILED'].includes(out.status))throw new SalesError('REFUND_INVALID',409);
 localDay(out.updatedAt);return {...out,localDate:localDay(out.createdAt)};
}
