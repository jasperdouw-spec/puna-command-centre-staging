import type {ServicePolicy} from './kitchen-model';
type Commitment={id:string;pickupAt:string;units:number};
// Shared capacity buckets are server-calculated, never a client promise or smoothed ETA.
export function pickupWindow(now:number,latestEta:number,units:number,closesAt:string|null|undefined,policy:ServicePolicy,commitments:Commitment[],chosen?:string){
 const width=policy.windowMinutes*60000,earliest=Math.max(now,latestEta)+policy.prepMinutes*60000,close=Date.parse(closesAt||'');
 if(!Number.isFinite(close)||units>policy.capacityUnits)throw Error('PICKUP_CAPACITY_UNAVAILABLE');
 const initial=chosen?Date.parse(chosen):Math.ceil(earliest/width)*width;
 for(let start=initial;start+width<=close;start+=width){
  if(start<earliest)throw Error('PICKUP_COMMITMENT_NO_LONGER_FITS');
  const held=commitments.filter(c=>Date.parse(c.pickupAt)>=start&&Date.parse(c.pickupAt)<start+width);
  if(held.length<policy.capacityOrders&&held.reduce((n,c)=>n+c.units,0)+units<=policy.capacityUnits)return {start:new Date(start).toISOString(),end:new Date(start+width).toISOString()};
  if(chosen)break;
 }
 throw Error('PICKUP_CAPACITY_UNAVAILABLE');
}
