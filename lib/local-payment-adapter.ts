import 'server-only';
import type {RowDataPacket} from 'mysql2/promise';
import {transaction} from './commerce';
import {requireLocal} from './ordering-gates';
export type ProviderPayment={id:string;reference:string;merchant:string;location:string;amount:number;currency:string;status:string};
export interface PaymentAdapter {create(orderId:string,providerKey:string):Promise<ProviderPayment>;retrieve(orderId:string):Promise<ProviderPayment>}
function projection(r:RowDataPacket):ProviderPayment{return {id:r.provider_payment_id,reference:r.reference_id,merchant:r.merchant_id,location:r.location_id,amount:Number(r.amount_cents),currency:r.currency,status:r.state};}
export const localPaymentAdapter:PaymentAdapter={
 async create(orderId,providerKey){requireLocal();const row=await transaction(async c=>{const [r]=await c.execute<RowDataPacket[]>('SELECT * FROM local_payment_simulations WHERE order_id=? AND provider_key=?',[orderId,providerKey]);if(!r[0])throw Error('LOCAL_PROVIDER_IDENTITY');return r[0];});
  // This wait emulates I/O after the reservation transaction has committed.
  if(row.latency_ms)await new Promise(r=>setTimeout(r,Math.min(10000,Number(row.latency_ms))));
  const p=await transaction(async c=>{const [rows]=await c.execute<RowDataPacket[]>('SELECT * FROM local_payment_simulations WHERE order_id=? FOR UPDATE',[orderId]);const r=rows[0];if(r.calls>0)return projection(r);let state=['decline','failure'].includes(r.scenario)?'FAILED':['timeout','uncertain','delayed_success'].includes(r.scenario)?'PENDING':'COMPLETED';const amount=r.scenario==='wrong_amount'?Number(r.amount_cents)+1:Number(r.amount_cents),currency=r.scenario==='wrong_currency'?'USD':r.currency,merchant=r.scenario==='wrong_merchant'?'wrong-merchant':r.merchant_id,location=r.scenario==='wrong_location'?'wrong-location':r.location_id;await c.execute('UPDATE local_payment_simulations SET state=?,calls=calls+1,amount_cents=?,currency=?,merchant_id=?,location_id=? WHERE order_id=?',[state,amount,currency,merchant,location,orderId]);return projection({...r,state,amount_cents:amount,currency,merchant_id:merchant,location_id:location});});
  if(row.scenario==='timeout')throw Error('LOCAL_PROVIDER_TIMEOUT');return p;
 },
 async retrieve(orderId){requireLocal();return transaction(async c=>{const [r]=await c.execute<RowDataPacket[]>('SELECT * FROM local_payment_simulations WHERE order_id=?',[orderId]);if(!r[0])throw Error('LOCAL_PROVIDER_NOT_FOUND');return projection(r[0]);});}
};
