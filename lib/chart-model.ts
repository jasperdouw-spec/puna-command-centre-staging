// Display geometry only. Reporting calculations remain in sales-periods/dashboard.
export function chartDomain(values:(number|null)[]){
 const known=values.filter((n):n is number=>n!==null&&Number.isFinite(n));
 const low=Math.min(0,...known),high=Math.max(0,...known),span=high-low||1,raw=span/4,power=10**Math.floor(Math.log10(raw)),fraction=raw/power;
 const step=(fraction<=1?1:fraction<=2?2:fraction<=2.5?2.5:fraction<=5?5:10)*power;
 const min=Math.floor(low/step)*step,max=Math.max(min+step,Math.ceil(high/step)*step);
 const ticks=Array.from({length:Math.round((max-min)/step)+1},(_,i)=>Number((min+i*step).toPrecision(12)));
 return {min,max,ticks};
}
export function chartSegments(values:(number|null)[]){
 const segments:{index:number;value:number}[][]=[];let segment:{index:number;value:number}[]=[];
 values.forEach((value,index)=>{if(value===null||!Number.isFinite(value)){if(segment.length)segments.push(segment);segment=[];}else segment.push({index,value});});if(segment.length)segments.push(segment);return segments;
}
