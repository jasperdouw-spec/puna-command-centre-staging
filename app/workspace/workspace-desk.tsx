'use client';
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,RefreshCw,X} from 'lucide-react';

type Order={id:string;batch_id:string;contact_name:string;payment_status:string;refund_status:string;order_status:string;fulfilment_status:string;total_cents:number;subtotal_cents:number;discount_cents:number;tax_cents:number;deposit_cents:number;currency:string;is_test:number|boolean;created_at:string;pickup_at:string;pickup_until:string;batch_state:string;items:{name:string;quantity:number;unit_price_cents:number}[]};
type Snapshot={scope:'live'|'sandbox';filter:string;page:number;pageSize:number;total:number;serverTime:string;checkoutMode:string;summary:{activeOrders:number;readyOrders:number;exceptions:number;openBatches:number};orders:Order[]};
type Filter='active'|'ready'|'complete'|'exceptions'|'all';
const money=(cents:number)=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number(cents)/100);
const time=(s:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(s));
const label=(s:string)=>s.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
function status(order:Order){
 if(order.order_status==='cancelled')return 'Cancelled';
 if(order.refund_status!=='none')return 'Refund '+label(order.refund_status).toLowerCase();
 if(order.order_status==='exception'||['uncertain','inflight'].includes(order.payment_status))return 'Needs review';
 if(order.payment_status!=='paid')return order.payment_status==='failed'?'Payment failed':'Awaiting payment';
 return ({reserved:'To prepare',loaded:'Preparing',ready:'Ready for pickup',collected:'Collected'} as Record<string,string>)[order.fulfilment_status]||label(order.fulfilment_status);
}
function Status({order}:{order:Order}){const text=status(order);return <span className={'pw-badge '+(text==='Ready for pickup'||text==='Collected'?'pw-badge-olive':text==='Needs review'?'pw-badge-amber':'')}>{text}</span>}

export default function WorkspaceDesk({section,onKitchen,onOrders}:{section:'today'|'orders';onKitchen:()=>void;onOrders?:()=>void}){
 const detailTitleId=useId();
 const [scope,setScope]=useState<'live'|'sandbox'>('live'),[filter,setFilter]=useState<Filter>('active'),[page,setPage]=useState(1);
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[selected,setSelected]=useState<Order|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),requestSequence=useRef(0);
 const load=useCallback(async(signal?:AbortSignal)=>{
  const sequence=++requestSequence.current;setLoading(true);
  try{const r=await fetch('/api/workspace?'+new URLSearchParams({scope,filter:section==='today'?'active':filter,page:String(section==='today'?1:page)}),{cache:'no-store',signal});const d=await r.json();if(!r.ok)throw Error(d.error||'Orders could not be loaded');if(sequence===requestSequence.current){setData(d);setError('');setSelected(current=>current?d.orders.find((o:Order)=>o.id===current.id)||null:null);}}
  catch(e){if((e as Error).name!=='AbortError'&&sequence===requestSequence.current)setError((e as Error).message);}
  finally{if(sequence===requestSequence.current)setLoading(false);}
 },[scope,filter,page,section]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);const timer=setInterval(()=>void load(controller.signal),30000);return()=>{controller.abort();clearInterval(timer);requestSequence.current++}},[load]);
 useEffect(()=>{if(selected&&!dialog.current?.open)dialog.current?.showModal();else if(!selected&&dialog.current?.open)dialog.current.close()},[selected]);
 function close(){dialog.current?.close();setSelected(null)}
 function chooseScope(next:'live'|'sandbox'){close();setScope(next);setPage(1);setData(null);setError('')}
 function chooseFilter(next:Filter){close();setFilter(next);setPage(1);setData(null);setError('')}
 const orders=section==='today'?data?.orders.slice(0,5)||[]:data?.orders||[];
 const totalPages=Math.max(1,Math.ceil((data?.total||0)/25));
 return <div className="pw-desk">
  <div className="pw-section-head pw-desk-toolbar"><div className="pw-tabs" role="group" aria-label="Order data"><button className="pw-button" aria-pressed={scope==='live'} onClick={()=>chooseScope('live')}>Real orders</button><button className="pw-button" aria-pressed={scope==='sandbox'} onClick={()=>chooseScope('sandbox')}>Sandbox</button></div><button className="pw-button pw-secondary" disabled={loading} onClick={()=>void load()}><RefreshCw size={16} aria-hidden="true"/>Refresh orders</button></div>
  {scope==='sandbox'&&<p className="pw-scope-note"><span className="pw-badge pw-badge-amber">Sandbox</span> Test orders are shown separately from real customers and payments.</p>}
  {error&&<p className="pw-alert" role="alert">{error}. {data?'The last loaded records are shown. Refresh before acting.':'Try refreshing the order book.'}</p>}
  {loading&&!data&&<p className="pw-muted" role="status">Loading orders…</p>}
  {section==='today'&&data&&<>
   <div className="pw-metrics"><article className="pw-metric"><span className="pw-stat-label">Active paid orders</span><strong className="pw-stat-value">{data.summary.activeOrders}</strong><span className="pw-stat-note">Awaiting preparation or pickup</span></article><article className="pw-metric"><span className="pw-stat-label">Ready for pickup</span><strong className="pw-stat-value">{data.summary.readyOrders}</strong><span className="pw-stat-note">Confirmed ready by the team</span></article><article className="pw-metric"><span className="pw-stat-label">Open pickup windows</span><strong className="pw-stat-value">{data.summary.openBatches}</strong><span className="pw-stat-note">Current service schedule</span></article></div>
   <div className="pw-next-action"><div><h2>{data.summary.exceptions?'Orders need review':data.summary.activeOrders?'Keep the kitchen moving':data.checkoutMode==='disabled'?'Get ready for the next service':'Your order book is clear'}</h2><p>{data.summary.exceptions?`${data.summary.exceptions} payment or order ${data.summary.exceptions===1?'exception needs':'exceptions need'} attention.`:data.checkoutMode==='disabled'?'Online ordering is currently closed. You can manage the menu and prepare pickup windows.':data.summary.activeOrders?'See the preparation queue and confirm each pickup when it is ready.':'New paid orders will appear here as they arrive.'}</p></div><button className="pw-button pw-primary" onClick={onKitchen}>Open kitchen<ArrowRight size={16} aria-hidden="true"/></button></div>
   <div className="pw-section-head"><h2>Next pickups</h2><button className="pw-text-link" onClick={onOrders}>All orders <ArrowRight size={15} aria-hidden="true"/></button></div>
  </>}
  {section==='orders'&&<div className="pw-filters" role="group" aria-label="Filter orders">{([['active','Active'],['ready','Ready'],['complete','Collected'],['exceptions','Needs review'],['all','All orders']] as [Filter,string][]).map(([value,text])=><button key={value} className="pw-button" aria-pressed={filter===value} onClick={()=>chooseFilter(value)}>{text}</button>)}</div>}
  {data&&<>{orders.length?<div className="pw-table-wrap"><table className="pw-table"><thead><tr><th>Customer / order</th><th>Pickup</th><th>Status</th><th className="pw-money">Order total</th><th><span className="pw-visually-hidden">Details</span></th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td><button className="pw-record-link" onClick={()=>setSelected(order)}>{order.contact_name}</button><span className="pw-order-id">#{order.id.slice(0,8)} · {order.items.reduce((sum,item)=>sum+item.quantity,0)} items{order.is_test?' · Sandbox':''}</span></td><td>{time(order.pickup_at)}</td><td><Status order={order}/></td><td className="pw-money">{money(order.total_cents)}</td><td><button className="pw-icon-button" aria-label={'Open order '+order.id.slice(0,8)} onClick={()=>setSelected(order)}><ArrowRight size={17} aria-hidden="true"/></button></td></tr>)}</tbody></table></div>:<div className="pw-empty"><h2>{filter==='active'||section==='today'?'No active paid orders':'No orders in this view'}</h2><p>{scope==='sandbox'?'Sandbox orders will appear after a test checkout.':'Real orders will appear here when customers place them.'}</p>{section==='today'&&<button className="pw-button" onClick={onKitchen}>Manage pickup windows</button>}</div>}
   {section==='orders'&&data.total>25&&<nav className="pw-pagination" aria-label="Order pages"><button className="pw-button" disabled={page<=1||loading} onClick={()=>{setSelected(null);setPage(p=>p-1)}}><ChevronLeft size={16} aria-hidden="true"/>Previous</button><span>Page {page} of {totalPages} · {data.total} orders</span><button className="pw-button" disabled={page>=totalPages||loading} onClick={()=>{setSelected(null);setPage(p=>p+1)}}>Next<ChevronRight size={16} aria-hidden="true"/></button></nav>}
   <p className="pw-muted pw-updated">Pickup times: Ucluelet · Last refreshed {time(data.serverTime)}</p>
  </>}
  <dialog ref={dialog} className="pw-drawer" aria-labelledby={detailTitleId} onClose={()=>setSelected(null)} onClick={e=>{if(dialog.current&&e.target===dialog.current){const box=dialog.current.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)close()}}}>
   {selected&&<><div className="pw-drawer-head"><div><p className="pw-kicker">Order #{selected.id.slice(0,8)}</p><h2 id={detailTitleId}>{selected.contact_name}</h2></div><button className="pw-icon-button" aria-label="Close order details" onClick={close}><X size={20} aria-hidden="true"/></button></div>
    <div className="pw-actions"><Status order={selected}/><span className="pw-badge">{selected.payment_status==='paid'?'Payment verified':label(selected.payment_status)}</span>{!!selected.is_test&&<span className="pw-badge pw-badge-amber">Sandbox order</span>}</div>
    <section className="pw-detail-block"><h3>Truck pickup</h3><p>{time(selected.pickup_at)}–{time(selected.pickup_until)}</p><p className="pw-muted">Canadian Princess · Ucluelet</p></section>
    <div className="pw-order-lines">{selected.items.map((item,index)=><div key={index}><span>{item.quantity} × {item.name}</span><strong>{money(item.quantity*item.unit_price_cents)}</strong></div>)}</div>
    <dl className="pw-order-totals"><div><dt>Subtotal</dt><dd>{money(selected.subtotal_cents)}</dd></div>{selected.discount_cents>0&&<div><dt>Discount</dt><dd>−{money(selected.discount_cents)}</dd></div>}<div><dt>Tax</dt><dd>{money(selected.tax_cents)}</dd></div>{selected.deposit_cents>0&&<div><dt>Container deposits</dt><dd>{money(selected.deposit_cents)}</dd></div>}<div className="pw-total"><dt>Order total</dt><dd>{money(selected.total_cents)} CAD</dd></div></dl>
    {selected.refund_status!=='none'&&<p className="pw-alert">Refund status: {label(selected.refund_status)}. The order total is the original checkout amount.</p>}
    <section className="pw-detail-block"><h3>Pickup progress</h3><p>{selected.fulfilment_status==='collected'?'This pickup has been collected.':'Preparation and readiness are confirmed for the whole batch in Kitchen. Collection is checked against the customer’s private receipt.'}</p>{selected.fulfilment_status!=='collected'&&<button className="pw-button pw-primary" onClick={()=>{close();onKitchen()}}>Open kitchen<ArrowRight size={16} aria-hidden="true"/></button>}</section>
   </>}
  </dialog>
 </div>
}
