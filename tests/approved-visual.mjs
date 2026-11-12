// Element screenshots round fractional page coordinates outwards. An inserted
// section can therefore change PNG height/rasterization without changing design.
// Align only the captured section to the pixel grid, identically before/after;
// restore its inline style afterwards. Full-page review images stay untouched.
export async function captureApprovedSection(section,path){
 await section.scrollIntoViewIfNeeded();
 for(const image of await section.locator('img').all())await image.evaluate(i=>i.decode());
 const original=await section.evaluate(el=>{
  const style=el.getAttribute('style'),r=el.getBoundingClientRect();
  el.style.transform=`translate(${Math.round(r.x)-r.x}px,${Math.round(r.y)-r.y}px)`;
  return style;
 });
 try{return await section.screenshot({path,animations:'disabled'});}
 finally{await section.evaluate((el,style)=>{if(style===null)el.removeAttribute('style');else el.setAttribute('style',style);},original);}
}
