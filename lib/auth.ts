import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {database} from './db';
import type {RowDataPacket} from 'mysql2';
export type Role='owner'|'manager'|'staff';
type UserRow=RowDataPacket & {id:number;email:string;display_name:string;role:Role};
const cookieName='puna_session';
export function hashPassword(password:string){if(password.length<12||password.length>128)throw Error('Password must be 12–128 characters');const salt=randomBytes(16).toString('hex');const hash=scryptSync(password,salt,64).toString('hex');return 'scrypt:'+salt+':'+hash}
export function verifyPassword(password:string,stored:string){const [algorithm,salt,hash]=stored.split(':');if(algorithm!=='scrypt'||!salt||!hash||hash.length!==128)return false;const expected=Buffer.from(hash,'hex');const actual=scryptSync(password,salt,64);return timingSafeEqual(expected,actual)}
function tokenHash(token:string){return createHash('sha256').update(token).digest('hex')}
export async function currentUser():Promise<UserRow|null>{const token=(await cookies()).get(cookieName)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))return null;const [rows]=await database().execute<UserRow[]>('SELECT u.id,u.email,u.display_name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.active=1 LIMIT 1',[tokenHash(token)]);return rows[0]||null}
export async function requireRole(roles:Role[]){const u=await currentUser();if(!u)throw Error('UNAUTHENTICATED');if(!roles.includes(u.role))throw Error('FORBIDDEN');return u}
export async function createSession(userId:number){const token=randomBytes(32).toString('hex');await database().execute('INSERT INTO sessions(id_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))',[tokenHash(token),userId]);(await cookies()).set(cookieName,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:8*3600});}
export async function clearSession(){const token=(await cookies()).get(cookieName)?.value;if(token)await database().execute('DELETE FROM sessions WHERE id_hash=?',[tokenHash(token)]);(await cookies()).delete(cookieName)}
export function checkOrigin(req:Request){const origin=req.headers.get('origin');const host=req.headers.get('host');if(!origin||!host)return false;try{const url=new URL(origin);return url.host===host&&(url.protocol==='https:'||process.env.NODE_ENV!=='production')}catch{return false}}
