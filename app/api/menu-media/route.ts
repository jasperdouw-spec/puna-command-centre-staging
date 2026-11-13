import {randomUUID} from 'node:crypto';
import type {RowDataPacket} from 'mysql2/promise';
import {z} from 'zod';
import {requireRole,checkOrigin} from '@/lib/auth';
import {database} from '@/lib/db';
import {transaction,audit,rateLimit,sqlDate} from '@/lib/commerce';
import {json,failure} from '@/lib/http';
import {cropSchema} from '@/lib/menu-model';
import {MAX_PHOTO_BYTES,PHOTO_PRESET,processPhoto,sha} from '@/lib/photo-studio';
export const runtime='nodejs';
let processing=false;
export async function GET(){try{await requireRole(['owner']);const [photos]=await database().query<RowDataPacket[]>('SELECT id,original_bytes,width,height,created_at,archived_at FROM menu_media ORDER BY created_at DESC LIMIT 300');const [files]=await database().query<RowDataPacket[]>("SELECT media_id,variant,OCTET_LENGTH(bytes) bytes FROM menu_media_files WHERE variant LIKE '%-640.webp'");const [size]=await database().query<RowDataPacket[]>('SELECT COALESCE(SUM(OCTET_LENGTH(bytes)),0) bytes FROM menu_media_files');return json({photos:photos.map(p=>({...p,crops:files.filter(f=>f.media_id===p.id)})),bytes:Number(size[0].bytes),limit:256*1024*1024,preset:PHOTO_PRESET,formats:['image/jpeg','image/png'],maxBytes:MAX_PHOTO_BYTES});}catch(e){return failure(e);}}
async function readBytes(req:Request){const reader=req.body?.getReader();if(!reader)throw Error('No photo received.');const chunks:Uint8Array[]=[];let n=0;try{while(true){const r=await reader.read();if(r.done)break;n+=r.value.byteLength;if(n>MAX_PHOTO_BYTES){await reader.cancel();throw Error('Choose a photo up to 8 MB.');}chunks.push(r.value);}return Buffer.concat(chunks);}finally{reader.releaseLock();}}
const reframe=z.object({id:z.string().uuid(),crop:cropSchema}).strict();
export async function POST(req:Request){if(!checkOrigin(req))return json({error:'Invalid origin'},403);let owned=false;try{
 const u=await requireRole(['owner']);if(processing)return json({error:'Another photo is being processed. Try again shortly.'},429);
 const allowed=await transaction((c,now)=>rateLimit(c,'photo:'+u.id,now,24));if(!allowed)return json({error:'Please wait before processing more photos.'},429);processing=true;owned=true;
 let id:string=randomUUID(),crop={x:50,y:50,zoom:100},bytes:Buffer,existing=false;
 if(req.headers.get('content-type')?.includes('application/json')){const raw=await req.text();if(raw.length>1000)return json({error:'Invalid crop'},400);const p=reframe.parse(JSON.parse(raw));id=p.id;crop=p.crop;existing=true;const [r]=await database().execute<RowDataPacket[]>("SELECT bytes FROM menu_media_files WHERE media_id=? AND variant='original'",[id]);if(!r[0])return json({error:'Original photo not found'},404);bytes=r[0].bytes;}else bytes=await readBytes(req);
 let processed;try{processed=await processPhoto(bytes,crop);}catch(e){return json({error:(e as Error).message.startsWith('Choose')||(e as Error).message.startsWith('This photo')?(e as Error).message:'This image could not be decoded safely. Choose another JPEG or PNG.'},400);}
 await transaction(async(c,now)=>{const [size]=await c.query<RowDataPacket[]>('SELECT COALESCE(SUM(OCTET_LENGTH(bytes)),0) bytes FROM menu_media_files');if(Number(size[0].bytes)+(!existing?bytes.length:0)+processed.files.reduce((n,f)=>n+f.data.length,0)>256*1024*1024)throw Error('PHOTO_STORAGE_FULL');
  if(!existing){await c.execute('INSERT INTO menu_media(id,original_hash,original_mime,original_bytes,width,height,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',[id,sha(bytes),processed.mime,bytes.length,processed.width,processed.height,u.id,sqlDate(now)]);await c.execute('INSERT INTO menu_media_files(media_id,variant,mime,sha256,bytes) VALUES(?,?,?,?,?)',[id,'original',processed.mime,sha(bytes),bytes]);}
  // Immutable derivatives: an existing crop is never overwritten, including published versions.
  for(const f of processed.files)await c.execute('INSERT IGNORE INTO menu_media_files(media_id,variant,mime,sha256,bytes) VALUES(?,?,?,?,?)',[id,f.variant,f.mime,f.hash,f.data]);
  await audit(c,u.id,existing?'photo:crop':'photo:upload','menu_media',id);
 });return json({id,crop,preset:processed.preset,originalBytes:bytes.length,files:processed.files.map(f=>({variant:f.variant,bytes:f.data.length})),altSuggestion:'PUNA product photograph — review and describe the food shown.'});
 }catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'Invalid crop'},400);if((e as Error).message==='PHOTO_STORAGE_FULL')return json({error:'Photo storage is full. Originals are retained; request a verified storage review.'},409);if((e as Error).message.startsWith('Choose a photo'))return json({error:(e as Error).message},413);return failure(e);}finally{if(owned)processing=false;}}
