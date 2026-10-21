'use client';
import {useEffect,useState} from 'react';
import {money} from '@/lib/puna';
import ReceiptCode from './receipt-code';
export default function Receipt(){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[reference,setReference]=useState('');
 async function load(){
  const m=location.hash.slice(1).match(/^([a-f0-9-]{36})\.([a-f0-9]{64})$/);if(!m){setError('This receipt requires its private order link.');return;}
  setReference(location.hash.slice(1));try{const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'receipt',id:m[1],accessKey:m[2]})});const d=await r.json();if(!r.ok)throw Error(d.error);setData(d)}catch(e){setError((e as Error).message)}
 }
 useEffect(()=>{void load()},[]);
 return <div className="workspace-theme"><main className="shell"><a href="/">Puna home</a><h1>{data?.paymentStatus==='paid'?'Sandbox payment verified':'Order status'}</h1><p>This staging order does not book a real pickup.</p>{error&&<p role="alert">{error}</p>}{data&&<section className="panel"><p>Payment: {data.paymentStatus} · Refund: {data.refundStatus}</p><p>Fulfilment: {data.fulfilmentStatus} · {data.orderStatus}</p><h2>Truck pickup</h2><p>{new Date(data.pickupAt).toLocaleString('en-CA',{timeZone:'America/Vancouver'})} · America/Vancouver</p><ul>{data.lines.map((l:any,i:number)=><li key={i}>{l.quantity} × {l.name}</li>)}</ul><p>Subtotal: {money(data.subtotalCents)} · Tax: {money(data.taxCents)} · Deposits: {money(data.depositCents)}</p><p>Total: {money(data.totalCents)} CAD</p><p>Canadian Princess · 1943 Peninsula Road, Ucluelet. Collect from the Puna truck, not reception.</p><p>Keep this private link. Receipt delivery: {data.receiptDelivery}.</p>{data.paymentStatus==='paid'&&data.refundStatus==='none'&&<details><summary>Private collection reference</summary><ReceiptCode reference={reference}/><code style={{overflowWrap:'anywhere'}}>{reference}</code></details>}</section>}<button onClick={load}>Refresh order status</button></main></div>
}
