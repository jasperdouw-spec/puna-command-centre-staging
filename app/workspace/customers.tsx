'use client';

import {useEffect,useRef,useState} from 'react';

type Scope = 'live' | 'sandbox';
type Customer = {key:string;name:string;email:string;orderCount:number;lastOrderAt:string};
type Page = {page:number;total:number;totalPages:number;hasNext:boolean};
type CustomerList = Page & {customers:Customer[];notesAvailable:boolean};
type CustomerOrder = {
  id:string;createdAt:string;fulfilmentStatus:string;orderStatus:string;refundStatus:string;
  totalCents:number;currency:string;items:{name:string;quantity:number}[];
};
type CustomerDetail = Page & {
  customer:Customer;orders:CustomerOrder[];notesAvailable:boolean;
  note:string;version:number;updatedAt:string|null;
};
const date = (value:string) => new Intl.DateTimeFormat('en-CA',{
  timeZone:'America/Vancouver',month:'short',day:'numeric',year:'numeric',
}).format(new Date(value));
const money = (cents:number,currency:string) => new Intl.NumberFormat('en-CA',{
  style:'currency',currency,
}).format(cents/100);
function orderStatus(order:CustomerOrder) {
  if (order.orderStatus === 'cancelled') return 'Cancelled';
  if (order.orderStatus === 'exception') return 'Needs review';
  return ({reserved:'Confirmed',loaded:'Preparing',ready:'Ready',collected:'Collected'} as Record<string,string>)[order.fulfilmentStatus] || order.fulfilmentStatus;
}

export default function Customers() {
  const [scope,setScope] = useState<Scope>('live');
  const [page,setPage] = useState(1);
  const [list,setList] = useState<CustomerList|null>(null);
  const [error,setError] = useState('');
  const [refresh,setRefresh] = useState(0);
  const [selected,setSelected] = useState<Customer|null>(null);
  const [detail,setDetail] = useState<CustomerDetail|null>(null);
  const [historyPage,setHistoryPage] = useState(1);
  const [detailRefresh,setDetailRefresh] = useState(0);
  const [detailError,setDetailError] = useState('');
  const [note,setNote] = useState('');
  const [message,setMessage] = useState('');
  const [saving,setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement|null>(null);
  const selectedKey = useRef<string|null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setList(null); setError('');
    (async () => {
      const response = await fetch(`/api/customers?scope=${scope}&page=${page}`,{
        cache:'no-store',signal:controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Customer records could not be loaded.');
      if (!controller.signal.aborted) setList(data);
    })().catch(error => {
      if (!controller.signal.aborted) setError((error as Error).message);
    });
    return () => controller.abort();
  },[scope,page,refresh]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setDetail(null); setDetailError(''); setMessage('');
    (async () => {
      const response = await fetch(`/api/customers?scope=${scope}&key=${selected.key}&page=${historyPage}`,{
        cache:'no-store',signal:controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Customer details could not be loaded.');
      if (!controller.signal.aborted) {
        setDetail(data);
        setNote(data.note);
      }
    })().catch(error => {
      if (!controller.signal.aborted) setDetailError((error as Error).message);
    });
    return () => controller.abort();
  },[selected,scope,historyPage,detailRefresh]);

  function openCustomer(customer:Customer) {
    lastFocus.current = document.activeElement as HTMLElement;
    selectedKey.current = customer.key;
    setSelected(customer); setHistoryPage(1); setDetail(null); setNote('');
    setDetailError(''); setMessage('');
    dialog.current?.showModal();
  }
  function closeCustomer() {
    if (!saving) dialog.current?.close();
  }
  function closed() {
    selectedKey.current = null;
    setSelected(null); setDetail(null); setNote(''); setMessage('');
    if (lastFocus.current?.isConnected) lastFocus.current.focus();
  }
  function chooseScope(next:Scope) {
    setScope(next); setPage(1);
  }
  async function saveNote(event:React.FormEvent) {
    event.preventDefault();
    if (!detail || !detail.notesAvailable || !selected || saving) return;
    const key = selected.key;
    setSaving(true); setMessage(''); setDetailError('');
    try {
      const response = await fetch('/api/customers',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({key,scope,note,version:detail.version}),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'The customer note could not be saved.');
      if (selectedKey.current === key) {
        setNote(data.note);
        setDetail(current => current && ({...current,note:data.note,version:data.version}));
        setMessage('Customer note saved.');
      }
    } catch (error) {
      if (selectedKey.current === key) setDetailError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return <section aria-label="Customer records">
    <div className="pw-section-head">
      <div className="pw-tabs" aria-label="Customer data">
        <button type="button" aria-pressed={scope==='live'} onClick={()=>chooseScope('live')}>Real customers</button>
        <button type="button" aria-pressed={scope==='sandbox'} onClick={()=>chooseScope('sandbox')}>Sandbox customers</button>
      </div>
      <button className="pw-button" type="button" onClick={()=>setRefresh(value=>value+1)}>Refresh customers</button>
    </div>
    <p className="pw-muted">{scope==='sandbox'
      ? 'Sandbox checkout history is kept separate from real customers and sales.'
      : 'Customer history from paid pickup orders. Customer details and notes are visible to owners.'}</p>
    {error && <p className="pw-alert" role="alert">{error}</p>}
    {!list && !error && <p className="pw-muted" role="status">Loading customers…</p>}
    {list && <>
      <div className="pw-section-head">
        <h2>{list.total} {scope==='sandbox'?'sandbox ':''}{list.total===1?'customer':'customers'}</h2>
        {scope==='sandbox' && <span className="pw-badge">Sandbox</span>}
      </div>
      {list.customers.length ? <div className="pw-table-wrap"><table className="pw-table">
        <thead><tr><th scope="col">Customer</th><th scope="col">Paid orders</th><th scope="col">Latest order</th></tr></thead>
        <tbody>{list.customers.map(customer=><tr key={customer.key}>
          <td><button className="pw-record-link" type="button" onClick={()=>openCustomer(customer)}>{customer.name}</button><div className="pw-muted" style={{overflowWrap:'anywhere'}}>{customer.email}</div></td>
          <td>{customer.orderCount}</td><td>{date(customer.lastOrderAt)}</td>
        </tr>)}</tbody>
      </table></div> : <div className="pw-empty">
        <h2>{scope==='sandbox'?'No sandbox customers yet':'No real customers yet'}</h2>
        <p>Customers appear here after a paid {scope==='sandbox'?'sandbox ':''}pickup order.</p>
      </div>}
      {list.totalPages>1 && <nav className="pw-actions" aria-label="Customer pages">
        <button className="pw-button" type="button" disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Previous customers</button>
        <span className="pw-muted">Page {page} of {list.totalPages}</span>
        <button className="pw-button" type="button" disabled={!list.hasNext} onClick={()=>setPage(value=>value+1)}>Next customers</button>
      </nav>}
    </>}
    <dialog className="pw-drawer" ref={dialog} aria-label="Customer details" onClose={closed} onCancel={event=>{if(saving)event.preventDefault()}}>
      <div className="pw-drawer-head">
        <div><p className="pw-muted">{scope==='sandbox'?'Sandbox customer':'Customer'}</p><h2>{selected?.name || 'Customer details'}</h2></div>
        <button className="pw-button" type="button" aria-label="Close customer details" onClick={closeCustomer} disabled={saving}>Close</button>
      </div>
      {selected && <p className="pw-muted" style={{overflowWrap:'anywhere'}}>{selected.email}</p>}
      {detailError && <p className="pw-alert" role="alert">{detailError}</p>}
      {!detail && !detailError && <p role="status">Loading customer details…</p>}
      {detailError && <button type="button" className="pw-button" disabled={saving} onClick={()=>setDetailRefresh(value=>value+1)}>Reload customer details</button>}
      {detail && <>
        <form onSubmit={saveNote} className="pw-panel">
          <label htmlFor="customer-private-note">Private customer note</label>
          <textarea id="customer-private-note" value={note} onChange={event=>{setNote(event.target.value);setMessage('')}} rows={4} maxLength={2000} disabled={!detail.notesAvailable||saving}/>
          <p className="pw-muted">{detail.notesAvailable
            ? 'Useful pickup preferences or business context. Visible to owners only.'
            : 'Notes are not available yet. Order history is still available.'}</p>
          <div className="pw-actions"><button className="pw-button pw-primary" disabled={!detail.notesAvailable||saving||note===detail.note}>{saving?'Saving…':'Save customer note'}</button></div>
          {message && <p className="pw-success" role="status">{message}</p>}
        </form>
        <div className="pw-section-head"><h2>Order history</h2><span className="pw-muted">{detail.total} paid {detail.total===1?'order':'orders'}</span></div>
        {detail.orders.map(order=><article className="pw-panel" key={order.id}>
          <div className="pw-section-head"><h3>#{order.id.slice(0,8)}</h3><span className="pw-badge">{orderStatus(order)}</span></div>
          <p className="pw-muted">{date(order.createdAt)}{scope==='sandbox'?' · Sandbox payment':''}</p>
          <ul>{order.items.map((item,index)=><li key={index}>{item.quantity} × {item.name}</li>)}</ul>
          <p><strong>Order total: {money(order.totalCents,order.currency)}</strong></p>
          <p className="pw-muted">Includes order tax and deposits.{order.refundStatus!=='none'?` Refund status: ${order.refundStatus}.`:''}</p>
        </article>)}
        {detail.totalPages>1 && <nav className="pw-actions" aria-label="Customer order history pages">
          <button type="button" className="pw-button" disabled={historyPage<=1||saving||note!==detail.note} onClick={()=>setHistoryPage(value=>value-1)}>Previous orders</button>
          <span className="pw-muted">Page {historyPage} of {detail.totalPages}</span>
          <button type="button" className="pw-button" disabled={!detail.hasNext||saving||note!==detail.note} onClick={()=>setHistoryPage(value=>value+1)}>Next orders</button>
        </nav>}
        {detail.totalPages>1 && note!==detail.note && <p className="pw-muted">Save your note before changing history pages.</p>}
      </>}
    </dialog>
  </section>;
}
