'use client';
import {useState} from 'react';
type Row={id:string;name:string;description:string;priceCents:number;category:string;priceConfirmed:boolean;sourceReference:string;sourceKey:string;sourceHash:string;canonicalId:string;kind:string};
type Preview={action:'import-products';rows:Row[]};
export default function SourceImport({onImported}:{onImported:()=>Promise<void>}){
 const [text,setText]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 function review(){
  setError('');setMessage('');setPreview(null);
  try{
   if(text.length>200000)throw Error('The source package is too large.');
   const data=JSON.parse(text);
   if(data?.action!=='import-products'||!Array.isArray(data.rows)||!data.rows.length||data.rows.length>100)throw Error('Use a source-tracked product import package with 1–100 records.');
   const ids=new Set<string>(),canonical=new Set<string>(),sources=new Set<string>();
   for(const r of data.rows){
    if(!r||typeof r.id!=='string'||!r.id||typeof r.name!=='string'||!r.name||typeof r.description!=='string'||!Number.isSafeInteger(r.priceCents)||r.priceCents<0||r.priceCents>100000||typeof r.priceConfirmed!=='boolean'||!['empanada','sauce','drink','ingredient'].includes(r.category)||!['fresh','frozen'].includes(r.kind)||typeof r.sourceReference!=='string'||!/^https?:$/.test(new URL(r.sourceReference).protocol)||typeof r.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(r.sourceHash)||typeof r.canonicalId!=='string'||!r.canonicalId||typeof r.sourceKey!=='string'||!r.sourceKey)throw Error('Every record needs valid product fields, source mapping and a revision checksum.');
    if(ids.has(r.id)||canonical.has(r.canonicalId)||sources.has(r.sourceKey))throw Error('The package contains duplicate product or source mappings.');
    ids.add(r.id);canonical.add(r.canonicalId);sources.add(r.sourceKey);
   }
   setPreview(data);
  }catch(e){setError(e instanceof SyntaxError?'The source package is not valid JSON.':(e as Error).message)}
 }
 async function submit(){
  if(!preview||busy)return;setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(preview)}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Import could not be completed.');
   setPreview(null);await onImported();
   setMessage(`Import complete: ${d.inserted} inserted, ${d.updated} updated, ${d.unchanged} unchanged. New or updated records are private drafts. Publish selected items separately in Publication, tax & pickup readiness.`);
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="panel" aria-label="Source-tracked catalogue import"><details><summary>Import source-tracked catalogue</summary><p>Save any open product edits first. Importing keeps source history and refuses to overwrite newer saved owner edits. New and updated items remain private drafts with ordering unavailable. Prices, ingredients, taxes and stock require separate verification.</p><p>Use only a reviewed catalogue package. Never paste credentials, database dumps or customer records.</p><label htmlFor="catalogue-source">Reviewed catalogue package</label><textarea id="catalogue-source" rows={8} maxLength={200000} disabled={busy} value={text} onChange={e=>{setText(e.target.value);setPreview(null);setError('');setMessage('')}}/><button disabled={busy||!text.trim()} onClick={review}>Review import</button>{error&&<p role="alert">{error}</p>}{preview&&<><h3>Review {preview.rows.length} catalogue records</h3>{preview.rows.map(r=><article className="panel" key={r.id}><h4>{r.name}</h4><p>{r.description}</p><p>{new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(r.priceCents/100)} · {r.priceConfirmed?'Price owner-confirmed':'Historical price — current price unconfirmed'} · {r.category} · Private draft</p><p style={{overflowWrap:'anywhere'}}>Source: {r.sourceReference}</p></article>)}<button disabled={busy} onClick={submit}>Import reviewed records as drafts</button></>}{message&&<p role="status">{message}</p>}</details></section>
}
