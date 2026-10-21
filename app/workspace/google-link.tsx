'use client';
import {useState} from 'react';
export default function GoogleLink(){const [message,setMessage]=useState('');return <div><button onClick={async()=>{try{const r=await fetch('/api/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({link:true})}),d=await r.json();if(!r.ok)throw Error(d.error);location.assign(d.url)}catch(e){setMessage((e as Error).message)}}}>Link my Google sign-in</button>{message&&<p role="status">{message}</p>}<p>Password sign-in remains available while Google access is verified.</p></div>}
