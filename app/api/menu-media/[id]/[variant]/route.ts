import type {RowDataPacket} from 'mysql2/promise';
import {database} from '@/lib/db';
import {requireRole} from '@/lib/auth';
import {failure,json} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string;variant:string}>}){try{const {id,variant}=await params;if(!/^[0-9a-f-]{36}$/.test(id)||!(variant==='original'||/^\d{1,3}-\d{1,3}-\d{3}-(320|640|1280)\.(webp|jpg)$/.test(variant)))return json({error:'Photo not found'},404);
 const [meta]=await database().execute<RowDataPacket[]>('SELECT mime,sha256,public_at FROM menu_media_files WHERE media_id=? AND variant=?',[id,variant]);if(!meta[0])return json({error:'Photo not found'},404);const publicFile=variant!=='original'&&!!meta[0].public_at;if(!publicFile)await requireRole(['owner']);
 const headers={'Content-Type':meta[0].mime,'Cache-Control':publicFile?'public, max-age=31536000, immutable':'private, no-store','X-Content-Type-Options':'nosniff','ETag':'"'+meta[0].sha256+'"',...(variant==='original'?{'Content-Disposition':'attachment; filename="puna-original.'+(meta[0].mime==='image/png'?'png':'jpg')+'"'}:{})};
 if(publicFile&&req.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});
 const [file]=await database().execute<RowDataPacket[]>('SELECT bytes FROM menu_media_files WHERE media_id=? AND variant=?',[id,variant]);return new Response(new Uint8Array(file[0].bytes),{headers});
 }catch(e){return failure(e);}}
