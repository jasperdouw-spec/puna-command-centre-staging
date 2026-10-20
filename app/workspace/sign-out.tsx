'use client';
import {useState} from 'react';
export default function SignOut(){const [error,setError]=useState('');return <><button onClick={async()=>{try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw Error('Sign out failed');location.assign('/sign-in')}catch(e){setError((e as Error).message)}}}>Sign out</button>{error&&<p role="alert">{error}</p>}</>}
