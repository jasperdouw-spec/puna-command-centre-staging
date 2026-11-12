export type PeriodKind='day'|'week'|'month';
export const SALES_ZONE='America/Vancouver';
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:SALES_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function wall(instant:Date){const p=Object.fromEntries(formatter.formatToParts(instant).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;}
export function today(now=new Date()){return wall(now).slice(0,10);}
export function addDays(day:string,n:number){return new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function monthStart(day:string,offset=0){const [y,m]=day.split('-').map(Number);return new Date(Date.UTC(y,m-1+offset,1)).toISOString().slice(0,10);}
// Resolve a local boundary without assuming a fixed UTC offset. Earlier occurrence
// wins at a repeated clock; nonexistent clocks move forward to the next valid time.
export function instantAt(local:string){
 const naive=Date.parse(local+'Z');const candidates:number[]=[];
 for(const offset of [-9,-8,-7,-6]){const n=naive-offset*3600000;if(wall(new Date(n))===local)candidates.push(n);}
 if(candidates.length)return new Date(Math.min(...candidates));
 for(let minutes=1;minutes<=120;minutes++){const next=new Date(naive+minutes*60000).toISOString().slice(0,19);for(const offset of [-9,-8,-7,-6]){const n=Date.parse(next+'Z')-offset*3600000;if(wall(new Date(n))===next)return new Date(n);}}
 throw Error('VANCOUVER_BOUNDARY_UNRESOLVED');
}
export type Window={start:string;end:string;through:string;cutoff:string;partial:boolean};
function startFor(kind:PeriodKind,day:string){if(kind==='month')return monthStart(day);if(kind==='day')return day;return addDays(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));}
function endFor(kind:PeriodKind,start:string){return kind==='month'?monthStart(start,1):addDays(start,kind==='week'?7:1);}
export function periods(kind:PeriodKind,day:string,now=new Date()){
 const start=startFor(kind,day),end=endFor(kind,start),nowWall=wall(now);
 const partial=nowWall<end+'T00:00:00';const cutoff=partial?now.toISOString():instantAt(end+'T00:00:00').toISOString();
 const current:Window={start,end,through:partial?nowWall.slice(0,10):addDays(end,-1),cutoff,partial};
 const previousStart=kind==='month'?monthStart(start,-1):addDays(start,-7),previousEnd=endFor(kind,previousStart);
 const elapsedDays=Math.round((Date.parse(current.through+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000);
 const previousDay=addDays(previousStart,elapsedDays);
 const previousLocal=partial&&previousDay<previousEnd?previousDay+nowWall.slice(10):previousEnd+'T00:00:00';
 const previous:Window={start:previousStart,end:previousEnd,through:previousLocal===previousEnd+'T00:00:00'?addDays(previousEnd,-1):previousDay,cutoff:instantAt(previousLocal).toISOString(),partial:previousLocal!==previousEnd+'T00:00:00'};
 // Compare like-for-like when an ongoing month is longer than its predecessor.
 // A percentage is withheld instead of silently treating the shorter month as equal.
 const comparable=!(partial&&previousDay>=previousEnd);
 return {kind,day,current,previous,comparable,comparison:kind==='day'?'Same weekday last week':kind==='week'?'Previous Monday–Sunday week':'Previous calendar month',elapsedLabel:partial?'Matched elapsed local dates and clock time':'Complete calendar periods',now:now.toISOString()};
}
export function buckets(kind:PeriodKind,w:Window){
 const out:{key:string;label:string;elapsed:boolean}[]=[];
 if(kind==='day'){
  const start=instantAt(w.start+'T00:00:00').getTime(),end=instantAt(w.end+'T00:00:00').getTime();
  for(let t=start;t<end;t+=3600000){const d=new Date(t);out.push({key:d.toISOString().slice(0,13),label:new Intl.DateTimeFormat('en-CA',{timeZone:SALES_ZONE,hour:'numeric',timeZoneName:'short'}).format(d),elapsed:t<Date.parse(w.cutoff)});}
 }else for(let d=w.start;d<w.end;d=addDays(d,1))out.push({key:d,label:new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(d+'T12:00:00Z')),elapsed:d<=w.through});
 return out;
}
export type Metrics={net:number|null;transactions:number|null;aov:number|null;quantity:number|null;refunds:number|null;discounts:number|null;tax:number|null;tips:null};
export function metrics(row:Record<string,unknown>,uncertain=false):Metrics{
 const available=Number(row.records)>0&&!uncertain,transactions=Number(row.transactions);
 const value=(key:string)=>available&&row[key]!==null&&Number.isFinite(Number(row[key]))?Number(row[key]):null;
 const net=value('net');return {net,transactions:available?transactions:null,aov:net!==null&&transactions>0?net/transactions:null,quantity:value('quantity'),refunds:value('refunds'),discounts:value('discounts'),tax:value('tax'),tips:null};
}
export function comparisonText(value:number|null,previous:number|null,comparable=true){if(!comparable)return 'Unavailable: unequal elapsed periods';if(value===null||previous===null)return 'Unavailable: missing comparable data';if(previous===0)return value===0?'No change from zero':'No percentage: zero baseline';if(previous<0)return 'No percentage: negative baseline';const n=(value-previous)/previous*100;return `${n>0?'+':''}${n.toFixed(1)}% observed change`;}
