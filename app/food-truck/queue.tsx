'use client';
import {useEffect,useState} from 'react';
type Order={id:string;customer:string;slot:string;status:string;version:number;items:{name:string;quantity:number}[]};
export default function TruckQueue(){
 const [orders,setOrders]=useState<Order[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/truck',{cache:'no-store'});if(!r.ok)throw Error('Unable to load test orders');setOrders((await r.json()).orders);setMessage('')}catch(e){setMessage((e as Error).message)}}
 useEffect(()=>{void load()},[]);
 const next:Record<string,string>={New:'Preparing',Preparing:'Ready',Ready:'Collected'};
 return <section className="panel"><h2>Food Truck</h2><p>Test orders only. No real pickups, payments or customer notifications.</p><button onClick={load} disabled={busy}>Refresh queue</button>{message&&<p role="alert">{message}</p>}{!orders.length&&<p>No active test orders.</p>}{orders.map(o=><article className="panel" key={o.id}><h3>{o.customer}</h3><p>{o.slot} · {o.status}</p><ul>{o.items.map((i,n)=><li key={n}>{i.quantity} × {i.name}</li>)}</ul>{next[o.status]&&<button disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/truck',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,version:o.version,status:next[o.status]})});const d=await r.json();if(!r.ok)throw Error(d.error);await load()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}>Mark {next[o.status]}</button>}</article>)}</section>
}
