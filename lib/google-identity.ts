import 'server-only';
import {createPublicKey,verify,randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
import type {RowDataPacket} from 'mysql2';
import {transaction,digest,sqlDate,audit} from './commerce';
import {createSession,currentUser,hashPassword} from './auth';
import {CommerceError} from './commerce-model';
export function googleConfigured(){return !!process.env.GOOGLE_CLIENT_ID&&!!process.env.GOOGLE_CLIENT_SECRET&&process.env.PUNA_ORIGIN==='https://staging.punaempanadas.ca';}
const cookie='puna_google_state';
export async function beginGoogle(invitation?:string,link=false){
 if(!googleConfigured())throw new CommerceError('GOOGLE_NOT_CONFIGURED',503);
 const user=await currentUser();if(link&&!user)throw new CommerceError('UNAUTHENTICATED',401);
 const state=randomBytes(32).toString('hex'),nonce=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url');
 await transaction(async(c,now)=>{
  if(invitation){const [r]=await c.execute<RowDataPacket[]>('SELECT id FROM team_invitations WHERE token_hash=? AND expires_at>? AND revoked=0 AND accepted_user_id IS NULL',[digest(invitation),sqlDate(now)]);if(!r.length)throw new CommerceError('INVITATION_UNAVAILABLE',403);}
  await c.execute('INSERT INTO identity_challenges(state_hash,nonce_hash,user_id,invitation_hash,expires_at,code_verifier) VALUES(?,?,?,?,?,?)',[digest(state),digest(nonce),link?user!.id:null,invitation?digest(invitation):null,sqlDate(now+300000),verifier]);
 });
 (await cookies()).set(cookie,state,{secure:true,httpOnly:true,sameSite:'lax',path:'/api/google',maxAge:300});
 const challenge=Buffer.from(digest(verifier),'hex').toString('base64url');
 const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:process.env.PUNA_ORIGIN+'/api/google/callback',response_type:'code',scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'});
 return 'https://accounts.google.com/o/oauth2/v2/auth?'+params;
}
type Claims={iss:string;aud:string;exp:number;iat:number;sub:string;email:string;email_verified:boolean;nonce:string;name?:string};
export async function verifyGoogleToken(token:string,nonceHash:string,now:number):Promise<Claims>{
 const parts=token.split('.');if(parts.length!==3||token.length>12000)throw new CommerceError('INVALID_IDENTITY',403);
 const header=JSON.parse(Buffer.from(parts[0],'base64url').toString()),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString()) as Claims;
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw new CommerceError('INVALID_IDENTITY',403);
 const response=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000),next:{revalidate:3600}});
 if(!response.ok)throw new CommerceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
 const jwks=await response.json(),key=jwks.keys?.find((k:{kid:string})=>k.kid===header.kid);
 if(!key||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw new CommerceError('INVALID_IDENTITY',403);
 if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||claims.aud!==process.env.GOOGLE_CLIENT_ID||!Number.isFinite(claims.exp)||claims.exp*1000<=now||!Number.isFinite(claims.iat)||claims.iat*1000>now+30000||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||claims.email_verified!==true||typeof claims.email!=='string'||claims.email.length>254||typeof claims.nonce!=='string'||digest(claims.nonce||'')!==nonceHash)throw new CommerceError('INVALID_IDENTITY',403);
 return claims;
}
export async function finishGoogle(code:string,state:string){
 if(!googleConfigured())throw new CommerceError('GOOGLE_NOT_CONFIGURED',503);
 const jar=await cookies(),stored=jar.get(cookie)?.value;jar.set(cookie,'',{path:'/api/google',maxAge:0,secure:true,httpOnly:true,sameSite:'lax'});
 if(!stored||stored!==state||!/^[a-f0-9]{64}$/.test(state))throw new CommerceError('INVALID_IDENTITY_STATE',403);
 const challenge=await transaction(async(c,now)=>{const [r]=await c.execute<RowDataPacket[]>('SELECT * FROM identity_challenges WHERE state_hash=? AND expires_at>? AND consumed=0 FOR UPDATE',[digest(state),sqlDate(now)]);if(!r[0])throw new CommerceError('IDENTITY_CHALLENGE_EXPIRED',403);await c.execute('UPDATE identity_challenges SET consumed=1 WHERE state_hash=?',[digest(state)]);return r[0];});
 const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,code_verifier:challenge.code_verifier,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,redirect_uri:process.env.PUNA_ORIGIN+'/api/google/callback'}),signal:AbortSignal.timeout(15000),cache:'no-store'});
 if(!tokenResponse.ok)throw new CommerceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
 const tokens=await tokenResponse.json();const claims=await verifyGoogleToken(tokens.id_token,challenge.nonce_hash,Date.now());
 const signedIn=await currentUser();
 const userId=await transaction(async(c,now)=>{
  const [existing]=await c.execute<RowDataPacket[]>("SELECT u.id,u.active FROM external_identities i JOIN users u ON u.id=i.user_id WHERE i.provider='google' AND i.subject=?",[claims.sub]);
  if(existing.length){if(!existing[0].active||challenge.user_id&&Number(challenge.user_id)!==Number(existing[0].id))throw new CommerceError('IDENTITY_ACCESS_DENIED',403);return existing[0].id;}
  if(challenge.user_id){
   if(!signedIn||signedIn.id!==Number(challenge.user_id))throw new CommerceError('LINK_REQUIRES_EXISTING_SIGN_IN',403);
   const [linked]=await c.execute<RowDataPacket[]>("SELECT subject FROM external_identities WHERE provider='google' AND user_id=?",[signedIn.id]);if(linked.length)throw new CommerceError('IDENTITY_ALREADY_LINKED');
   await c.execute("INSERT INTO external_identities(provider,subject,user_id) VALUES('google',?,?)",[claims.sub,signedIn.id]);await audit(c,signedIn.id,'identity:link','user',String(signedIn.id));return signedIn.id;
  }
  if(!challenge.invitation_hash)throw new CommerceError('TEAM_INVITATION_REQUIRED',403);
  const [invites]=await c.execute<RowDataPacket[]>('SELECT * FROM team_invitations WHERE token_hash=? AND expires_at>? AND revoked=0 AND accepted_user_id IS NULL FOR UPDATE',[challenge.invitation_hash,sqlDate(now)]);const invite=invites[0];
  if(!invite||invite.email.toLowerCase()!==claims.email.toLowerCase())throw new CommerceError('INVITATION_IDENTITY_MISMATCH',403);
  const [duplicate]=await c.execute<RowDataPacket[]>('SELECT id FROM users WHERE email=?',[claims.email.toLowerCase()]);
  if(duplicate.length)throw new CommerceError('LINK_REQUIRES_EXISTING_SIGN_IN',403);
  const [created]=await c.execute('INSERT INTO users(email,display_name,role,password_hash) VALUES(?,?,?,?)',[claims.email.toLowerCase(),(claims.name||claims.email).slice(0,120),invite.role,hashPassword(randomBytes(48).toString('hex'))]);
  const id=(created as {insertId:number}).insertId;await c.execute("INSERT INTO external_identities(provider,subject,user_id) VALUES('google',?,?)",[claims.sub,id]);await c.execute('UPDATE team_invitations SET accepted_user_id=? WHERE id=?',[id,invite.id]);await audit(c,invite.invited_by,'identity:invitation_accepted','user',String(id));return id;
 });
 await createSession(userId);return userId;
}
