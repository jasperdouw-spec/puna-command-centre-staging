import {z} from 'zod';
import {randomBytes} from 'node:crypto';
import type {RowDataPacket} from 'mysql2';
import {checkOrigin,requireRole,hashPassword} from '@/lib/auth';
import {transaction,digest,sqlDate,audit,rateLimit} from '@/lib/commerce';
import {CommerceError} from '@/lib/commerce-model';
import {json,failure} from '@/lib/http';
export const runtime='nodejs';
const input=z.discriminatedUnion('action',[z.object({action:z.literal('issue'),userId:z.number().int().positive()}).strict(),z.object({action:z.literal('redeem'),token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(12).max(128)}).strict()]);
export async function POST(req:Request){
 if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{const raw=await req.text();if(raw.length>1000)return json({error:'Request too large'},413);const p=input.safeParse(JSON.parse(raw));if(!p.success)return json({error:'Invalid recovery request'},400);
 if(p.data.action==='issue'){const actor=await requireRole(['owner']),target=p.data.userId;if(actor.id===target)return json({error:'Ask another verified owner for recovery; existing sign-in remains available'},409);
 return json(await transaction(async(c,now)=>{const [r]=await c.execute<RowDataPacket[]>('SELECT id FROM users WHERE id=? AND active=1',[target]);if(!r.length)throw new CommerceError('ACCOUNT_NOT_FOUND',404);const token=randomBytes(32).toString('hex');await c.execute('UPDATE password_recoveries SET used=1 WHERE user_id=?',[target]);await c.execute('INSERT INTO password_recoveries(token_hash,user_id,issued_by,expires_at) VALUES(?,?,?,?)',[digest(token),target,actor.id,sqlDate(now+900000)]);await audit(c,actor.id,'recovery:issue','user',String(target));return {privateRecovery:'/recover#'+token,expiresMinutes:15};}));
 }
 const {token,password}=p.data;
 if(!await transaction(async(c,now)=>rateLimit(c,'password-recovery',now,20)))return json({error:'Please wait before trying again'},429);
 const passwordHash=hashPassword(password);
 return json(await transaction(async(c,now)=>{const [r]=await c.execute<RowDataPacket[]>('SELECT r.user_id FROM password_recoveries r JOIN users u ON u.id=r.user_id WHERE token_hash=? AND expires_at>? AND used=0 AND u.active=1 FOR UPDATE',[digest(token),sqlDate(now)]);if(!r.length)throw new CommerceError('RECOVERY_UNAVAILABLE',403);await c.execute('UPDATE users SET password_hash=? WHERE id=?',[passwordHash,r[0].user_id]);await c.execute('DELETE FROM sessions WHERE user_id=?',[r[0].user_id]);await c.execute('UPDATE password_recoveries SET used=1 WHERE user_id=?',[r[0].user_id]);await audit(c,r[0].user_id,'recovery:redeem','user',String(r[0].user_id));return {recovered:true};}));
 }catch(e){if(e instanceof SyntaxError)return json({error:'Invalid JSON'},400);return e instanceof CommerceError?json({error:e.code},e.status):failure(e)}
}
