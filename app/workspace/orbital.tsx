'use client';
import {useEffect,useState} from 'react';
import ProductWorkspace from './products';
const roots=['Sales','Orders','Production','Inventory','Financials','Marketing','Website','Food Truck','Staff'];
export default function OrbitalWorkspace(){
 const [path,setPath]=useState(['Puna']),[error,setError]=useState('');
 useEffect(()=>{if(new URL(location.href).searchParams.get('view')==='edit')setPath(['Puna','Website','Products','Edit'])},[]);
 function navigate(next:string[]){setPath(next);history.replaceState(null,'',next.at(-1)==='Edit'?'/workspace?view=edit':'/workspace')}
 const current=path.at(-1)!,children=path.length===1?roots:current==='Website'?['Products','Content','Analytics','Settings']:current==='Products'?['Edit']:[];
 async function logout(){try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw Error('Sign out failed');location.assign('/sign-in')}catch(e){setError((e as Error).message)}}
 return <><div className="orbital-toolbar"><nav aria-label="Workspace path">{path.map((p,i)=><button key={i} onClick={()=>navigate(path.slice(0,i+1))}>{p}</button>)}</nav><button onClick={logout}>Sign out</button></div>{error&&<p role="alert">{error}</p>}
 <section className="orbital-stage" aria-label="Puna orbital navigation">
 <svg viewBox="0 0 400 400" preserveAspectRatio="none" aria-hidden="true"><circle cx="200" cy="200" r="155" fill="none" stroke="#e68a24" strokeOpacity=".3" strokeDasharray="4 8"/><circle cx="200" cy="200" r="105" fill="none" stroke="#e68a24" strokeOpacity=".18"/>{children.map((name,i)=>{const angle=-Math.PI/2+2*Math.PI*i/children.length;return <line key={name} x1="200" y1="200" x2={200+152*Math.cos(angle)} y2={200+152*Math.sin(angle)} stroke="#ff9900" strokeWidth="1.5" strokeDasharray="5 5" opacity=".8"/>})}</svg>
 <button className="orbital-node orbital-core" aria-label={path.length===1?'Puna home':'Back to '+path[path.length-2]} style={{left:'50%',top:'50%'}} onClick={()=>navigate(path.length>1?path.slice(0,-1):['Puna'])}>{path.length===1?<img src="/puna-official-logo.svg" alt="Puna official logo" width="86" height="86"/>:<span>{current}</span>}</button>
 {children.map((name,i)=>{const angle=-Math.PI/2+2*Math.PI*i/children.length;return <button className="orbital-node" key={name} style={{left:(50+38*Math.cos(angle))+'%',top:(50+38*Math.sin(angle))+'%'}} onClick={()=>navigate([...path,name])}><span>{name}</span></button>})}
 </section><div className="orbital-toolbar"><button disabled={path.length===1} onClick={()=>navigate(path.slice(0,-1))}>Back</button><button onClick={()=>navigate(['Puna'])}>Puna Home</button></div>
 {current==='Edit'?<ProductWorkspace/>:!children.length?<section className="panel"><h2>{current}</h2><p>This section is not connected yet.</p></section>:<p className="subtle">Choose a connected circle to explore.</p>}</>
}
