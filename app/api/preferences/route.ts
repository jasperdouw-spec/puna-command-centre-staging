import {requireRole,checkOrigin} from '@/lib/auth';
import {database} from '@/lib/db';
import {json,failure} from '@/lib/http';
import type {RowDataPacket} from 'mysql2';
export async function GET(){try{const u=await requireRole(['owner']);const [r]=await database().execute<RowDataPacket[]>('SELECT workspace_view FROM user_preferences WHERE user_id=?',[u.id]);return json({view:r[0]?.workspace_view||'orbital'})}catch(e){return failure(e)}}
export async function PATCH(req:Request){if(!checkOrigin(req))return json({error:'Invalid origin'},403);try{const u=await requireRole(['owner']),p=await req.json();if(!['orbital','classic'].includes(p.view)||Object.keys(p).length!==1)return json({error:'Invalid preference'},400);await database().execute('INSERT INTO user_preferences(user_id,workspace_view) VALUES(?,?) ON DUPLICATE KEY UPDATE workspace_view=VALUES(workspace_view)',[u.id,p.view]);return json({saved:true})}catch(e){return failure(e)}}
