import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {RowDataPacket} from 'mysql2';
import {requireRole,checkOrigin} from '@/lib/auth';
import {transaction,digest,sqlDate,audit} from '@/lib/commerce';
import {json,failure} from '@/lib/http';
import {CommerceError} from '@/lib/commerce-model';
const schema=z.discriminatedUnion('action',[z.object({action:z.literal('invite'),email:z.string().email().max(254),role:z.enum(['owner','staff'])}).strict(),z.object({action:z.literal('revoke'),userId:z.number().int().positive()}).strict()]);
export async function POST(req:Request){if(!checkOrigin(req))return json({error:'Invalid origin'},403);try{const u=await requireRole(['owner']),p=schema.safeParse(await req.json());if(!p.success)return json({error:'Invalid team request'},400);const d=p.data;
 return json(await transaction(async(c,now)=>{
  if(d.action==='invite'){const [old]=await c.execute<RowDataPacket[]>('SELECT id FROM users WHERE email=?',[d.email.toLowerCase()]);if(old.length)throw new CommerceError('EXISTING_ACCOUNT_MUST_LINK_WHILE_SIGNED_IN');const token=randomBytes(32).toString('hex'),id=randomUUID();await c.execute('INSERT INTO team_invitations(id,email,role,token_hash,invited_by,expires_at) VALUES(?,?,?,?,?,?)',[id,d.email.toLowerCase(),d.role,digest(token),u.id,sqlDate(now+86400000)]);await audit(c,u.id,'team:invite','invitation',id);return {privateInvitation:'/sign-in#invite='+token,expiresHours:24};}
  if(d.userId===u.id)throw new CommerceError('CANNOT_REVOKE_CURRENT_OWNER');const [target]=await c.execute<RowDataPacket[]>('SELECT id,role FROM users WHERE id=? FOR UPDATE',[d.userId]);if(!target.length)throw new CommerceError('ACCOUNT_NOT_FOUND',404);
  await c.execute('UPDATE users SET active=0 WHERE id=?',[d.userId]);await c.execute('DELETE FROM sessions WHERE user_id=?',[d.userId]);await audit(c,u.id,'team:revoke','user',String(d.userId));return {revoked:true};
 }));
 }catch(e){return e instanceof CommerceError?json({error:e.code},e.status):failure(e)}}
