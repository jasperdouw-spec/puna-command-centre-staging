'use client';
import {useEffect,useState} from 'react';
import CommerceEditor from './commerce-editor';
import SourceImport from './source-import';
type Product={id:string;name:string;description:string;price_cents:number;available:number|boolean;kind:string;source_status:string;version:number};
export default function ProductWorkspace(){
 const [revision,setRevision]=useState(0);
 const [products,setProducts]=useState<Product[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/products',{cache:'no-store'});if(!r.ok)throw Error('Unable to load products');setProducts((await r.json()).products);setConfirm({});setError('')}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void load()},[]);
 function edit(id:string,changes:Partial<Product>){setProducts(a=>a.map(p=>p.id===id?{...p,...changes}:p));setConfirm(a=>({...a,[id]:false}));setNotice('')}
 async function save(p:Product){setBusy(true);setError('');setNotice('');try{
  const r=await fetch('/api/products',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,version:p.version,name:p.name,description:p.description,price_cents:Number(p.price_cents),available:Boolean(p.available),confirm:!!confirm[p.id]})});
  const result=await r.json();if(!r.ok)throw Error(result.error||'Save failed');
  setProducts(a=>a.map(x=>x.id===p.id?{...x,version:result.version,source_status:result.source_status}:x));setConfirm(a=>({...a,[p.id]:false}));setNotice('Product saved');
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <><SourceImport onImported={async()=>{await load();setRevision(v=>v+1)}}/><section className="panel"><h2>Website → Products → Edit</h2><p className="subtle">Saving edits does not confirm product details. Confirmation is a separate explicit choice.</p><button disabled={busy} onClick={load}>Reload products</button>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{products.map(p=><article key={p.id} className="panel"><fieldset disabled={busy}><legend>{p.name}</legend><label>Name<input value={p.name} onChange={e=>edit(p.id,{name:e.target.value})}/></label><label htmlFor={"description-"+p.id}>Description</label><textarea id={"description-"+p.id} value={p.description} onChange={e=>edit(p.id,{description:e.target.value})}/><label>Price (CAD cents)<input type="number" min="0" value={p.price_cents} onChange={e=>edit(p.id,{price_cents:Number(e.target.value)})}/></label><label>Available <input type="checkbox" checked={Boolean(p.available)} onChange={e=>edit(p.id,{available:e.target.checked})}/></label><p>Status: {p.source_status}</p><label><input type="checkbox" checked={!!confirm[p.id]} onChange={e=>setConfirm(a=>({...a,[p.id]:e.target.checked}))}/> I confirm these product details</label><button onClick={()=>save(p)}>Save product</button></fieldset></article>)}</section><CommerceEditor key={revision}/></>
}

