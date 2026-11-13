'use client';
import {useEffect,useId,useRef,useState} from 'react';
import type {DashboardData} from '@/lib/sales-dashboard';
import type {Metrics} from '@/lib/sales-periods';
import {chartDomain,chartSegments} from '@/lib/chart-model';
type Points=Extract<DashboardData,{current:unknown}>['current']['points'];
type Metric=keyof Metrics;
export const chartTitles:Record<Metric,string>={net:'Net sales',transactions:'Transactions',aov:'Average order value',quantity:'Items sold',refunds:'Item refunds',discounts:'Discounts',tax:'Taxes',tips:'Tips'};
const currency=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}),count=new Intl.NumberFormat('en-CA',{maximumFractionDigits:4});
export function chartFormat(v:number|null,k:Metric){return v===null?'Unavailable':['transactions','quantity'].includes(k)?count.format(v):currency.format(v/100);}
export default function SalesChart({points,metric,small=false}:{points:Points;metric:Metric;small?:boolean}){
 const ref=useRef<HTMLDivElement>(null),[width,setWidth]=useState(small?300:900),[active,setActive]=useState<number|null>(null),gradient='chart-'+useId().replaceAll(':','');
 useEffect(()=>{if(!ref.current)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(180,entries[0].contentRect.width)));observer.observe(ref.current);return()=>observer.disconnect();},[]);
 useEffect(()=>setActive(null),[metric,points]);
 // Ongoing periods end at the last elapsed bucket; future dates are not drawn as zero.
 const elapsed=points.filter(p=>p.elapsed),values=elapsed.map(p=>p.metrics[metric]),known=values.some(v=>v!==null),domain=chartDomain(values),bars=metric==='transactions'||metric==='quantity',color=metric==='transactions'?'#697151':metric==='quantity'?'#8b6043':'#a66b16';
 const h=small?94:320,left=small?4:width<460?62:78,right=small?4:22,top=small?12:22,bottom=small?8:44,plotWidth=Math.max(1,width-left-right),plotHeight=h-top-bottom,slot=plotWidth/Math.max(1,elapsed.length),x=(i:number)=>left+slot*(i+.5),y=(v:number)=>top+(domain.max-v)/(domain.max-domain.min)*plotHeight,base=y(0),segments=chartSegments(values);
 const chosen=active!==null?elapsed[Math.min(active,elapsed.length-1)]:null;
 const choose=(clientX:number)=>{const r=ref.current?.getBoundingClientRect();if(r)setActive(Math.max(0,Math.min(elapsed.length-1,Math.floor((clientX-r.left-left)/slot))));};
 return <div ref={ref} className={(small?'sd-mini-chart':'sd-trend')+(bars?' is-bars':'')} style={{'--chart-color':color} as React.CSSProperties}>
 {!known?<div className={small?'sd-spark-empty':'sd-chart-empty'}>{small?'No observed trend':'No reliable observations. Missing data is not zero sales.'}</div>:<>
 <div className={small?'sd-mini-plot':'sd-chart-interaction'} role={small?undefined:'group'} tabIndex={small?undefined:0} aria-label={small?undefined:chartTitles[metric]+'. Use left and right arrow keys to read each observed time bucket.'} onPointerMove={small?undefined:e=>choose(e.clientX)} onPointerLeave={small?undefined:()=>setActive(null)} onPointerDown={small?undefined:e=>choose(e.clientX)} onFocus={small?undefined:()=>setActive(i=>i??0)} onBlur={small?undefined:()=>setActive(null)} onKeyDown={small?undefined:e=>{if(['ArrowRight','ArrowLeft','Home','End','Escape'].includes(e.key)){e.preventDefault();setActive(i=>e.key==='Escape'?null:e.key==='Home'?0:e.key==='End'?elapsed.length-1:Math.max(0,Math.min(elapsed.length-1,(i??0)+(e.key==='ArrowRight'?1:-1))));}}}>
 <svg className={small?'sd-spark sd-spark-redesign':'sd-chart sd-chart-redesign'} viewBox={`0 0 ${width} ${h}`} width={width} height={h} aria-hidden={small||undefined} role={small?undefined:'img'} aria-label={small?undefined:chartTitles[metric]+'; exact values below. Gaps mean missing observations.'}>
 <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".25"/><stop offset="100%" stopColor={color} stopOpacity=".025"/></linearGradient></defs>
 {!small&&domain.ticks.map(v=><g key={v}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} className={v===0?'sd-zero-line':'sd-grid-line'}/><text x={left-12} y={y(v)+4} textAnchor="end">{chartFormat(v,metric)}</text></g>)}
 {bars?values.map((v,i)=>v===null?null:<g key={elapsed[i].key}><rect x={x(i)-Math.min(slot*.64,42)/2} y={Math.min(y(v),base)} width={Math.min(slot*.64,42)} height={Math.max(v===0?1:0,Math.abs(base-y(v)))} rx={small?2:3} fill={color} opacity={active===null||active===i?1:.5}/></g>):segments.map((segment,index)=>{const path=segment.map((p,i)=>`${i?'L':'M'}${x(p.index)},${y(p.value)}`).join(' ');return <g key={index}>{metric!=='aov'&&segment.length>1&&<path d={`${path} L${x(segment.at(-1)!.index)},${base} L${x(segment[0].index)},${base} Z`} fill={`url(#${gradient})`}/>}<path d={path} stroke={color} strokeWidth={small?2:2.75} fill="none" strokeLinejoin="round" strokeLinecap="round"/>{segment.map(p=><circle key={p.index} cx={x(p.index)} cy={y(p.value)} r={small?2.25:4} fill={color} stroke="#fffdf8" strokeWidth={small?0:2}/>)}</g>;})}
 {!small&&elapsed.map((p,i)=>i%Math.max(1,Math.ceil(elapsed.length/(width<460?4:7)))===0||i===elapsed.length-1?<text key={p.key} x={x(i)} y={h-15} textAnchor={i===0?'start':i===elapsed.length-1?'end':'middle'}>{p.label}</text>:null)}
 {!small&&chosen&&active!==null&&<g><line x1={x(active)} x2={x(active)} y1={top} y2={h-bottom} stroke={color} strokeDasharray="4 4" opacity=".6"/>{chosen.metrics[metric]!==null&&<circle cx={x(active)} cy={y(chosen.metrics[metric]!)} r="6" fill={color} stroke="white" strokeWidth="3"/>}</g>}
 </svg>
 {!small&&chosen&&<div className="sd-chart-tooltip" role="status" style={{left:Math.max(6,Math.min(width-192,x(active!)-90)),top:0}}><span>{chosen.label}</span><strong>{chosen.metrics[metric]===null?'Not observed':chartFormat(chosen.metrics[metric],metric)}</strong><small>{chartTitles[metric]}{['transactions','quantity'].includes(metric)?'':' · CAD'}</small></div>}
 </div>
 {!small&&<div className="sd-chart-legend"><span><i style={{background:color}}/>{bars?'Observed per bucket':'Observed values · straight connections'}</span><span>Gaps = not observed</span><span>{elapsed[0]?.label} – {elapsed.at(-1)?.label}</span></div>}
 </>}
 </div>;
}
