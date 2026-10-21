import {z} from 'zod';
export const cartInput=z.array(z.object({id:z.string().min(1).max(64),quantity:z.number().int().min(1).max(100)}).strict()).min(1).max(30).superRefine((v,c)=>{if(new Set(v.map(i=>i.id)).size!==v.length)c.addIssue({code:'custom',message:'Duplicate products'});});
export type CartInput=z.infer<typeof cartInput>;
export type TaxRule={name:string;basis_points:number;deposit_taxable?:boolean};
export const taxRules=z.array(z.object({name:z.string().min(1).max(40),basis_points:z.number().int().min(0).max(10000),deposit_taxable:z.boolean().optional()}).strict()).max(5);
export type SaleProduct={id:string;name:string;price_cents:number;available:boolean;kind:string;category:'empanada'|'sauce'|'drink';publication:string;price_confirmed:boolean;ingredients_confirmed:boolean;tax_rules:TaxRule[]|null;deposit_cents:number|null;oven_units:number;packing_seconds:number|null;physical_units:number;committed_units:number;known:boolean;version:number};
export class CommerceError extends Error{constructor(public code:string,public status=409){super(code)}}
export function integer(value:number){if(!Number.isSafeInteger(value)||value<0)throw new CommerceError('INVALID_AMOUNT',400);return value}
export function quoteCart(cart:CartInput,products:SaleProduct[],maxItems:number){
 const quantity=cart.reduce((s,i)=>s+i.quantity,0);if(quantity>maxItems)throw new CommerceError('ORDER_TOO_LARGE');
 const lines=cart.map(i=>{const p=products.find(p=>p.id===i.id);
  if(!p||p.kind==='frozen'||p.publication!=='staging'||!p.available)throw new CommerceError('PRODUCT_UNAVAILABLE');
  if(!p.price_confirmed||!p.ingredients_confirmed||p.tax_rules===null||p.deposit_cents===null||p.packing_seconds===null)throw new CommerceError('PRODUCT_CONFIGURATION_INCOMPLETE');
  taxRules.parse(p.tax_rules);integer(p.price_cents);integer(p.deposit_cents);integer(p.packing_seconds);integer(p.oven_units);
  if(!p.known)throw new CommerceError('STOCK_UNVERIFIED');
  if(p.physical_units-p.committed_units<i.quantity)throw new CommerceError('INSUFFICIENT_STOCK');
  const subtotal=integer(p.price_cents*i.quantity),deposit=integer(p.deposit_cents*i.quantity);
  const tax=p.tax_rules.reduce((n,r)=>n+Math.floor(((subtotal+(r.deposit_taxable?deposit:0))*r.basis_points+5000)/10000),0);
  return {id:p.id,name:p.name,quantity:i.quantity,unit_price_cents:p.price_cents,subtotal_cents:subtotal,tax_cents:integer(tax),deposit_cents:deposit,tax_snapshot:p.tax_rules,oven_units:p.oven_units*i.quantity,packing_seconds:p.packing_seconds*i.quantity,inventory_stage:p.category==='empanada'?'frozen':p.category==='sauce'?'portion':'packaged',product_version:p.version};
 });
 const sum=(key:'subtotal_cents'|'tax_cents'|'deposit_cents'|'oven_units'|'packing_seconds')=>integer(lines.reduce((s,l)=>s+l[key],0));
 const subtotal_cents=sum('subtotal_cents'),tax_cents=sum('tax_cents'),deposit_cents=sum('deposit_cents');
 return {lines,quantity,subtotal_cents,discount_cents:0,tax_cents,deposit_cents,total_cents:integer(subtotal_cents+tax_cents+deposit_cents),oven_units:sum('oven_units'),packing_seconds:sum('packing_seconds'),currency:'CAD'};
}
export const capacityConfig=z.object({
 timezone:z.literal('America/Vancouver'),ovenCount:z.number().int().min(1).max(10),
 piecesPerOven:z.number().int().min(1).max(200),cycleMinutes:z.number().int().min(1).max(180),
 turnaroundMinutes:z.number().int().min(0).max(120),preheatMinutes:z.number().int().min(0).max(180),
 packingMinutes:z.number().int().min(0).max(120),handoffMinutes:z.number().int().min(0).max(60),
 pickupWindowMinutes:z.number().int().min(1).max(120),packingStaff:z.number().int().min(1).max(20),
 packingCapacitySeconds:z.number().int().min(0).max(86400),
 counterReserve:z.number().int().min(0).max(2000),maxItems:z.number().int().min(1).max(100),
 holdSeconds:z.number().int().min(30).max(600),horizonDays:z.number().int().min(1).max(30),
 safetyStock:z.number().int().min(0).max(10000),
 services:z.array(z.object({weekday:z.number().int().min(0).max(6),staffStart:z.string().regex(/^\d{2}:\d{2}$/),firstBake:z.string().regex(/^\d{2}:\d{2}$/),lastPickup:z.string().regex(/^\d{2}:\d{2}$/)}).strict()).max(14),
 closedDates:z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(100),
 downtime:z.array(z.object({from:z.string().datetime(),until:z.string().datetime()}).strict()).max(100),
 paused:z.boolean(),verified:z.boolean()
}).strict().superRefine((c,x)=>{if(c.packingMinutes+c.handoffMinutes>c.cycleMinutes+c.turnaroundMinutes)x.addIssue({code:'custom',message:'Packing and handoff must fit between successive batches'});if(c.packingCapacitySeconds>c.packingMinutes*60)x.addIssue({code:'custom',message:'Packing capacity exceeds staffed time'});if(c.counterReserve>=c.ovenCount*c.piecesPerOven)x.addIssue({code:'custom',message:'Counter reserve must leave online capacity'});});
export type CapacityConfig=z.infer<typeof capacityConfig>;
const localFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function localParts(time:number){const p=Object.fromEntries(localFormat.formatToParts(time).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute}
export function localInstant(date:string,time:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw new CommerceError('INVALID_LOCAL_TIME',400);
 const nominal=Date.parse(date+'T'+time+':00Z');if(!Number.isFinite(nominal))throw new CommerceError('INVALID_LOCAL_TIME',400);
 const offsets=new Set<number>();
 for(let hours=-36;hours<=36;hours+=6){const probe=nominal+hours*3600000;offsets.add(Date.parse(localParts(probe)+':00Z')-probe);}
 const matches=[...offsets].map(offset=>nominal-offset).filter(ms=>localParts(ms)===date+'T'+time);
 // Ambiguous fall-back and nonexistent spring-forward times require explicit corrected schedule.
 if(matches.length!==1)throw new CommerceError('AMBIGUOUS_OR_MISSING_LOCAL_TIME',400);return matches[0];
}
export function planBatches(c:CapacityConfig,date:string){
 capacityConfig.parse(c);if(!c.verified||c.paused||c.closedDates.includes(date))return [];
 const weekday=new Date(date+'T12:00:00Z').getUTCDay(),out:Array<{bakeAt:string;cutoffAt:string;pickupAt:string;pickupUntil:string;ovenCapacity:number;packingCapacitySeconds:number}>=[];
 for(const service of c.services.filter(s=>s.weekday===weekday)){
  const staffed=localInstant(date,service.staffStart),last=localInstant(date,service.lastPickup),first=localInstant(date,service.firstBake);
  if(first<staffed+c.preheatMinutes*60000)throw new CommerceError('INSUFFICIENT_PREHEAT',400);
  for(let bake=first;bake<last;bake+=(c.cycleMinutes+c.turnaroundMinutes)*60000){
   const pickup=bake+(c.cycleMinutes+c.packingMinutes+c.handoffMinutes)*60000,end=pickup+c.pickupWindowMinutes*60000;
   if(end>last)continue;
   if(c.downtime.some(d=>Date.parse(d.from)<end&&Date.parse(d.until)>bake-c.preheatMinutes*60000))continue;
   out.push({bakeAt:new Date(bake).toISOString(),cutoffAt:new Date(bake).toISOString(),pickupAt:new Date(pickup).toISOString(),pickupUntil:new Date(end).toISOString(),ovenCapacity:c.ovenCount*c.piecesPerOven-c.counterReserve,packingCapacitySeconds:c.packingCapacitySeconds*c.packingStaff});
  }
 }
 out.sort((a,b)=>Date.parse(a.bakeAt)-Date.parse(b.bakeAt));for(let i=1;i<out.length;i++)if(Date.parse(out[i].bakeAt)<Date.parse(out[i-1].bakeAt)+(c.cycleMinutes+c.turnaroundMinutes)*60000)throw new CommerceError('OVERLAPPING_SERVICES',400);return out;
}
export function batchFits(batch:{state:string;cutoff_at:Date|string;oven_capacity:number;oven_committed:number;packing_capacity_seconds:number;packing_committed_seconds:number},quote:{oven_units:number;packing_seconds:number},now:number){
 return batch.state==='open'&&new Date(batch.cutoff_at).getTime()>now&&batch.oven_capacity-batch.oven_committed>=quote.oven_units&&batch.packing_capacity_seconds-batch.packing_committed_seconds>=quote.packing_seconds;
}
