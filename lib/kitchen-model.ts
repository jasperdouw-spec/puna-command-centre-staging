export type Channel='online'|'truck';
export type Stage='ready'|'baking';
export type AllocationState='unpaid'|'pending'|'uncertain'|'paid'|'counter_pending'|'released'|'consumed'|'late_exception';
export type Lot={id:string;productId:string;name:string;startedUnits:number;startedAt:string;estimatedReadyAt:string;online_ready:number;online_baking:number;truck_ready:number;truck_baking:number;version:number;note:string;public:boolean};
export type Allocation={id:string;channel:Channel;state:AllocationState;synthetic:boolean;managedOrder?:boolean;label:string;pickupAt:string;expiresAt:string;createdAt:string;lines:{lotId:string;quantity:number;readyUnits:number;setAsideUnits:number}[]};
export type KitchenState={mode:'open'|'paused'|'closed';version:number;reviewedAt:string|null;heartbeatAt:string|null;heartbeatClient:string|null;heartbeatActor:number|null;holdSeconds:number};
export const HEARTBEAT_SECONDS=90, STOCK_REVIEW_SECONDS=900, READ_REVIEW_SECONDS=30;
export const active=(state:AllocationState)=>['unpaid','pending','uncertain','paid','counter_pending'].includes(state);
export function reserved(lotId:string,channel:Channel,stage:Stage,allocations:Allocation[]){return allocations.filter(a=>a.channel===channel&&active(a.state)).flatMap(a=>a.lines).filter(l=>l.lotId===lotId).reduce((n,l)=>n+(stage==='ready'?l.readyUnits:l.quantity-l.readyUnits),0);}
export function capacity(lot:Lot,allocations:Allocation[]){
 const result={online:0,truck:0,ready:lot.online_ready+lot.truck_ready,baking:lot.online_baking+lot.truck_baking,reserved:0,deficit:0};
 for(const channel of ['online','truck'] as const)for(const stage of ['ready','baking'] as const){const held=reserved(lot.id,channel,stage,allocations),physical=lot[`${channel}_${stage}`];result[channel]+=Math.max(0,physical-held);result.reserved+=held;result.deficit+=Math.max(0,held-physical);}
 return result;
}
export function kitchenIssues(lots:Lot[],allocations:Allocation[]){
 const shortages=lots.filter(l=>capacity(l,allocations).deficit>0).map(l=>l.id);
 const delayed=allocations.filter(a=>active(a.state)&&a.lines.some(line=>line.quantity>line.readyUnits&&lots.some(l=>l.id===line.lotId&&Date.parse(l.estimatedReadyAt)>Date.parse(a.pickupAt)))).map(a=>a.id);
 const late=allocations.filter(a=>a.state==='late_exception').map(a=>a.id);
 return {shortages,delayed,late};
}
export function freshness(state:KitchenState,now:number){return !!state.heartbeatAt&&!!state.reviewedAt&&now-Date.parse(state.heartbeatAt)<HEARTBEAT_SECONDS*1000&&now>=Date.parse(state.heartbeatAt)&&now-Date.parse(state.reviewedAt)<STOCK_REVIEW_SECONDS*1000&&now>=Date.parse(state.reviewedAt);}
export function connectionReason(state:KitchenState,now:number){
 if(!state.heartbeatAt||!state.reviewedAt)return 'not_connected' as const;
 if(now-Date.parse(state.reviewedAt)>=STOCK_REVIEW_SECONDS*1000)return 'review_expired' as const;
 if(now-Date.parse(state.heartbeatAt)>=HEARTBEAT_SECONDS*1000||now<Date.parse(state.heartbeatAt)||now<Date.parse(state.reviewedAt))return 'connection_expired' as const;
 return 'current' as const;
}
export function effectiveStatus(state:KitchenState,now:number,lots:Lot[],allocations:Allocation[]){const issues=kitchenIssues(lots,allocations),fresh=freshness(state,now);return {fresh,issues,status:state.mode==='closed'?'closed':!fresh||Object.values(issues).some(a=>a.length)?'paused':state.mode};}
export function expiresAutomatically(a:Allocation,now:number){return a.state==='unpaid'&&Date.parse(a.expiresAt)<=now;}

// Only physically ready, uncommitted food is eligible for immediate pickup.
export function freeReady(lot:Lot,allocations:Allocation[],channel:Channel='online'){
 return Math.max(0,lot[`${channel}_ready`]-reserved(lot.id,channel,'ready',allocations));
}
export function remainingMinutes(estimate:string,now:number){return Math.max(0,Math.ceil((Date.parse(estimate)-now)/60000));}
export function adjustment(lot:Lot,allocations:Allocation[],stage:Stage,delta:number):Lot{
 if(!Number.isInteger(delta)||![-1,1].includes(delta))throw Error('Use a one-unit adjustment.');
 const next={...lot};
 if(delta===1){if(lot[`online_${stage}`]+lot[`truck_${stage}`]>=500)throw Error('Maximum batch quantity reached.');next[`online_${stage}`]++;return next;}
 const channel=(['online','truck'] as const).find(c=>lot[`${c}_${stage}`]>reserved(lot.id,c,stage,allocations));
 if(!channel)throw Error('No unreserved units to remove. Use a manager correction for a physical shortage.');
 next[`${channel}_${stage}`]--;return next;
}
