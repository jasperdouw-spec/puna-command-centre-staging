'use client';
import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import type {KitchenSnapshot} from '@/lib/kitchen';
import {freshness} from '@/lib/kitchen-model';

export type KitchenData=KitchenSnapshot&{role:string;actorId:number};
export type KitchenSend=(action:Record<string,unknown>)=>Promise<boolean>;
class RequestError extends Error {constructor(message:string,readonly status:number){super(message);}}
export function useKitchen(root:RefObject<HTMLElement|null>){
 const [data,setData]=useState<KitchenData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[review,setReview]=useState(false),[now,setNow]=useState(0),[clientId,setClientId]=useState(''),[authExpired,setAuthExpired]=useState(false);
 const client=useRef(''),current=useRef<KitchenData|null>(null),inFlight=useRef(false),needsReview=useRef(false),polling=useRef<Promise<void>|null>(null),mounted=useRef(false),clock=useRef({at:0,perf:0,wall:0});
 const visible=useCallback(()=>document.visibilityState==='visible'&&!!root.current?.getClientRects().length,[root]);
 const request=async(body:unknown)=>{const r=await fetch('/api/kitchen',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});const d=await r.json();if(!r.ok)throw new RequestError(d.error||'Kitchen unavailable',r.status);return d;};
 const report=useCallback((e:unknown)=>{if(!mounted.current)return;needsReview.current=true;setReview(true);setMessage('');if(e instanceof RequestError&&e.status===401){setAuthExpired(true);setError('Your staff session has expired. Sign in again; saved stock is retained.');}else setError('Could not confirm truck stock. '+(e as Error).message+' Refresh stock before another action.');},[]);
 const load=useCallback(async()=>{const d:KitchenData=await request({action:'inspect',clientId:client.current});if(!mounted.current)return d;const old=current.current;if(old&&(d.state.version<old.state.version||d.state.version===old.state.version&&Date.parse(d.serverTime)<Date.parse(old.serverTime)))return old;current.current=d;clock.current={at:Date.parse(d.serverTime),perf:performance.now(),wall:Date.now()};setNow(clock.current.at);setData(d);setAuthExpired(false);return d;},[]);
 const sync=useCallback(()=>{
  if(polling.current||inFlight.current||!visible()||!client.current)return;
  polling.current=(async()=>{try{const d=await load();if(!needsReview.current&&visible()&&d.state.heartbeatClient===client.current&&d.state.heartbeatActor===d.actorId&&Date.parse(d.serverTime)-Date.parse(d.state.heartbeatAt!)>=25000){await request({action:'heartbeat',clientId:client.current});await load();}}catch(e){report(e);}finally{polling.current=null;}})();
 },[load,report,visible]);
 useEffect(()=>{
  mounted.current=true;
  try{client.current=sessionStorage.getItem('puna-kitchen-screen')||crypto.randomUUID();sessionStorage.setItem('puna-kitchen-screen',client.current);}catch{client.current=crypto.randomUUID();}
  setClientId(client.current);sync();
  const poll=setInterval(sync,5000),tick=setInterval(()=>setNow(clock.current.at+Math.max(0,performance.now()-clock.current.perf,Date.now()-clock.current.wall)),1000);
  const offline=()=>{needsReview.current=true;setReview(true);setError('Connection lost. Stock is saved. Refresh authoritative stock before another action.');setMessage('');};
  const online=()=>{needsReview.current=true;setReview(true);setError('Connection restored. Refresh authoritative stock before continuing.');sync();};
  const resume=()=>{if(visible())sync();};
  window.addEventListener('offline',offline);window.addEventListener('online',online);window.addEventListener('pageshow',resume);document.addEventListener('visibilitychange',resume);
  return()=>{mounted.current=false;clearInterval(poll);clearInterval(tick);window.removeEventListener('offline',offline);window.removeEventListener('online',online);window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',resume);};
 },[sync,visible]);
 async function refresh(){if(inFlight.current)return;inFlight.current=true;setBusy(true);try{await polling.current;await load();needsReview.current=false;setReview(false);setError('');setMessage('Authoritative stock loaded. Check the history before repeating an uncertain action.');}catch(e){report(e);}finally{inFlight.current=false;setBusy(false);}}
 const send:KitchenSend=async action=>{
  const d=current.current;if(!d||inFlight.current)return false;inFlight.current=true;setBusy(true);setError('');setMessage('');
  try{await polling.current;await request({...action,key:crypto.randomUUID(),clientId:client.current,version:d.state.version});await load();if(action.action==='connect'){needsReview.current=false;setReview(false);}setMessage(action.action==='connect'?'Physical stock review saved. The business session and quantities are retained.':action.action==='mode'?action.mode==='open'?'Kitchen is open. Confirmed availability is now being shared.':action.mode==='closed'?'Kitchen closed. Saved counts and reservations are retained.':'Kitchen paused. Saved counts and reservations are retained.':action.action==='counter-reserve'?'Reserved at the truck. Set items aside, charge in Square, then confirm handover.':'Saved to the kitchen ledger.');return true;}
  catch(e){report(e);if(!(e instanceof RequestError&&e.status===401))setError((e as Error).message+' Review the latest stock and history before retrying: the action may already have saved. Nothing is replayed automatically.');await load().catch(()=>{});return false;}
  finally{inFlight.current=false;setBusy(false);}
 };
 return {data,busy,error,message,review,now,clientId,authExpired,refresh,send};
}
