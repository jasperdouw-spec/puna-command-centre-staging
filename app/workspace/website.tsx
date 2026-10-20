'use client';
import {useEffect,useState} from 'react';
import type {Settings} from '@/lib/puna';
export default function WebsiteEditor(){
 const [settings,setSettings]=useState<Settings|null>(null),[version,setVersion]=useState(0),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/website',{cache:'no-store'});if(!r.ok)throw Error('Unable to load website settings');const d=await r.json();setSettings(d.settings);setVersion(d.version);setMessage('')}catch(e){setMessage((e as Error).message)}}
 useEffect(()=>{void load()},[]);
 return <section className="panel"><h2>Website content & hours</h2><p>Changes appear on this staging homepage only. Public publishing remains disconnected.</p><button disabled={busy} onClick={load}>Reload website details</button>{settings&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await fetch('/api/website',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings,version})});const d=await r.json();if(!r.ok)throw Error(d.error);setVersion(d.version);setMessage('Website details saved')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}><fieldset disabled={busy}>{([['headline','Homepage headline',100],['intro','Homepage introduction',300],['story','PUNA story',4000],['location','Location',500],['hours','Opening hours',700]] as const).map(([key,label,max])=><div key={key}><label htmlFor={"website-"+key}>{label}</label><textarea id={"website-"+key} required maxLength={max} rows={key==='story'?7:2} value={settings[key]} onChange={e=>setSettings({...settings,[key]:e.target.value})}/></div>)}<button>Save website details</button></fieldset></form>}{message&&<p role="status">{message}</p>}</section>
}
