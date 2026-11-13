import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {cropKey,type cropSchema} from './menu-model';
import type {z} from 'zod';
export const MAX_PHOTO_BYTES=8*1024*1024;
export const PHOTO_PRESET='puna-natural-warm-v1';
export const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export async function processPhoto(bytes:Buffer,crop:z.infer<typeof cropSchema>){
 if(!bytes.length||bytes.length>MAX_PHOTO_BYTES)throw Error('Choose a JPEG or PNG photo up to 8 MB.');
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(!jpeg&&!png)throw Error('This photo format is not supported. Export HEIC/HEIF as JPEG, or choose PNG.');
 const image=sharp(bytes,{limitInputPixels:48000000,failOn:'warning'}).timeout({seconds:20});const meta=await image.metadata();
 if(!['jpeg','png'].includes(meta.format||'')||(meta.pages||1)!==1||!meta.width||!meta.height||meta.width<240||meta.height<180)throw Error('Choose a single JPEG or PNG photo at least 240 × 180 pixels.');
 const normalized=await image.autoOrient().toColourspace('srgb').flatten({background:'#f3eee4'}).resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).png().toBuffer();
 const stats=await sharp(normalized).stats(),light=stats.channels.slice(0,3).reduce((n,c)=>n+c.mean,0)/3;
 const brightness=Math.max(.97,Math.min(1.06,130/Math.max(1,light)));
 const m=await sharp(normalized).metadata(),w=m.width!,h=m.height!,cw=Math.floor(Math.min(w,h*4/3)*100/crop.zoom),ch=Math.floor(cw*3/4);
 const left=Math.round((w-cw)*crop.x/100),top=Math.round((h-ch)*crop.y/100);
 const master=sharp(normalized).extract({left,top,width:cw,height:ch}).modulate({brightness,saturation:1.025}).linear([1.012,1,.988],[0,0,0]);
 const files=[];for(const width of [320,640,1280])for(const format of ['webp','jpg'] as const){
  const pipeline=master.clone().resize(width,Math.round(width*.75),{fit:'fill'});const data=await (format==='webp'?pipeline.webp({quality:82,effort:4}):pipeline.jpeg({quality:84,mozjpeg:true})).toBuffer();
  if(data.length>2*1024*1024)throw Error('Photo could not be optimized within the delivery limit.');
  files.push({variant:cropKey(crop)+'-'+width+'.'+format,mime:format==='webp'?'image/webp':'image/jpeg',data,hash:sha(data)});
 }
 return {width:meta.width,height:meta.height,mime:jpeg?'image/jpeg':'image/png',files,preset:PHOTO_PRESET};
}
