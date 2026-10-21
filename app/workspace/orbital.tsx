'use client';
import {useEffect,useState} from 'react';
import ProductWorkspace from './products';
import WebsiteEditor from './website';
import Accounts from './accounts';
import Operations from './operations';
import GoogleLink from './google-link';
import Records from './records';
const roots=['Sales','Orders','Production','Inventory','Financials','Marketing','Website','Food Truck','Staff','Settings','Feedback','Audit'];
export default function OrbitalWorkspace(){
 const [view,setView]=useState<'orbital'|'classic'>('orbital');
 useEffect(()=>{fetch('/api/preferences').then(r=>r.ok?r.json():{view:'orbital'}).then(d=>setView(d.view)).catch(()=>{});},[]);
 const [path,setPath]=useState(['Puna']),[error,setError]=useState('');
 useEffect(()=>{const view=new URL(location.href).searchParams.get('view');if(view==='edit')setPath(['Puna','Website','Products','Edit']);if(view==='staff')setPath(['Puna','Staff']);if(view==='content')setPath(['Puna','Website','Content']);if(view==='truck')setPath(['Puna','Food Truck'])},[]);
 function navigate(next:string[]){setPath(next);const views:Record<string,string>={Edit:'edit',Staff:'staff',Content:'content','Food Truck':'truck',Orders:'truck'};history.replaceState(null,'',views[next.at(-1)!]?'/workspace?view='+views[next.at(-1)!]:'/workspace')}
 const current=path.at(-1)!,children=path.length===1?roots:current==='Website'?['Products','Content','Analytics','Settings']:current==='Products'?['Edit']:[];
 async function logout(){try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw Error('Sign out failed');location.assign('/sign-in')}catch(e){setError((e as Error).message)}}
 return <><div className="orbital-toolbar"><label>Workspace view <select aria-label="Workspace view" value={view} onChange={async e=>{const next=e.target.value as 'orbital'|'classic';setView(next);const r=await fetch('/api/preferences',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({view:next})});if(!r.ok)setError('View preference could not be saved');}}><option value="orbital">Orbital</option><option value="classic">Classic</option></select></label></div><div className="orbital-toolbar"><nav aria-label="Workspace path">{path.map((p,i)=><button key={i} onClick={()=>navigate(path.slice(0,i+1))}>{p}</button>)}</nav><button onClick={logout}>Sign out</button></div>{error&&<p role="alert">{error}</p>}
 <section hidden={view!=='orbital'} className="orbital-stage" aria-label="Puna orbital navigation">
 <svg viewBox="0 0 400 400" preserveAspectRatio="none" aria-hidden="true"><circle cx="200" cy="200" r="155" fill="none" stroke="#e68a24" strokeOpacity=".3" strokeDasharray="4 8"/><circle cx="200" cy="200" r="105" fill="none" stroke="#e68a24" strokeOpacity=".18"/>{children.map((name,i)=>{const angle=-Math.PI/2+2*Math.PI*i/children.length;return <line key={name} x1="200" y1="200" x2={200+152*Math.cos(angle)} y2={200+152*Math.sin(angle)} stroke="#ff9900" strokeWidth="1.5" strokeDasharray="5 5" opacity=".8"/>})}</svg>
 <button className="orbital-node orbital-core" aria-label={path.length===1?'Puna home':'Back to '+path[path.length-2]} style={{left:'50%',top:'50%'}} onClick={()=>navigate(path.length>1?path.slice(0,-1):['Puna'])}>{path.length===1?<img src="/puna-official-logo.svg" alt="Puna official logo" width="86" height="86"/>:<span>{current}</span>}</button>
 {children.map((name,i)=>{const angle=-Math.PI/2+2*Math.PI*i/children.length;return <button className="orbital-node" key={name} style={{left:(50+38*Math.cos(angle))+'%',top:(50+38*Math.sin(angle))+'%'}} onClick={()=>navigate([...path,name])}><span>{name}</span></button>})}
 </section>{view==='classic'&&<nav className="classic-nav" aria-label="Classic workspace">{['Overview',...roots].map(name=><button key={name} onClick={()=>navigate(name==='Overview'?['Puna']:['Puna',name])}>{name}</button>)}{current==='Website'&&['Products','Content'].map(name=><button key={name} onClick={()=>navigate(['Puna','Website',name])}>{name}</button>)}{current==='Products'&&<button onClick={()=>navigate(['Puna','Website','Products','Edit'])}>Edit</button>}</nav>}<div className="orbital-toolbar"><button disabled={path.length===1} onClick={()=>navigate(path.slice(0,-1))}>Back</button><button onClick={()=>navigate(['Puna'])}>Puna Home</button></div>
 {current==='Edit'?<ProductWorkspace/>:current==='Content'?<WebsiteEditor/>:current==='Staff'?<><Accounts/><GoogleLink/></>:['Production','Sales','Financials'].includes(current)?<Records section={current}/>:current==='Puna'?<Operations section="Overview"/>:!children.length?<Operations section={current}/>:<p className="subtle">Choose a connected circle to explore.</p>}</>
}
