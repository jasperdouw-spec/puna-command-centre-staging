import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
// Compare approved section content and computed design properties exactly. Pixel
// comparison uses a small perceptual thumbnail to tolerate browser subpixel text
// and responsive-photo resampling; trim two crop-edge pixels and hide the unrelated
// fixed mobile bag only during section capture. Full-page screenshots are untouched.
const properties=['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','paddingTop','paddingBottom','paddingLeft','paddingRight','gap','borderRadius','objectFit','objectPosition'];
export async function captureApprovedSection(section,path){
 await section.scrollIntoViewIfNeeded();
 for(const image of await section.locator('img').all())await image.evaluate(i=>i.decode());
 const signature=await section.evaluate((el,keys)=>[el,...el.querySelectorAll('*')].map(e=>({tag:e.tagName,text:e.childElementCount?null:e.textContent,src:e.getAttribute('src'),style:Object.fromEntries(keys.map(k=>[k,getComputedStyle(e)[k]]))})),properties);
 writeFileSync(path+'.json',JSON.stringify(signature));
 const overlay=await section.evaluate(()=>{const e=document.querySelector('.customer .mobile-bag');if(!e)return null;const old=e.getAttribute('style');e.style.visibility='hidden';return {old};});
 try{return await section.screenshot({path,animations:'disabled'});}
 finally{if(overlay)await section.evaluate((el,old)=>{const e=document.querySelector('.customer .mobile-bag');if(old===null)e.removeAttribute('style');else e.setAttribute('style',old);},overlay.old);}
}
export async function compareApprovedSection(actualPath,baselinePath){
 assert.deepEqual(JSON.parse(readFileSync(actualPath+'.json')),JSON.parse(readFileSync(baselinePath+'.json')),'Approved content and design tokens');
 const [a,b]=await Promise.all([sharp(actualPath).metadata(),sharp(baselinePath).metadata()]);
 assert.equal(a.width,b.width);assert.ok(Math.abs(a.height-b.height)<=1,'Section height changed');
 const sourceHeight=Math.min(a.height,b.height)-4,sourceWidth=b.width-4,height=Math.round(sourceHeight*128/sourceWidth);
 const pixels=await Promise.all([actualPath,baselinePath].map(p=>sharp(p).extract({left:2,top:2,width:sourceWidth,height:sourceHeight}).resize(128,height,{fit:'fill'}).removeAlpha().raw().toBuffer()));
 let difference=0,changed=0;for(let i=0;i<pixels[0].length;i++){const d=Math.abs(pixels[0][i]-pixels[1][i]);difference+=d;if(d>24)changed++;}
 const mean=difference/pixels[0].length,ratio=changed/pixels[0].length;
 console.log('VISUAL_METRIC '+JSON.stringify({actualPath,mean,ratio}));
 assert.ok(mean<3.5&&ratio<0.02,'Approved section perceptual change: '+JSON.stringify({mean,ratio}));
}
