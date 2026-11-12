import 'server-only';
import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {CommerceError} from './commerce-model';
export function orderingLocal(){return process.env.PUNA_ORDERING_LOCAL_ENABLED==='true'&&process.env.PUNA_DISPOSABLE_LOCAL_TESTS==='true'&&process.env.DB_HOST==='127.0.0.1'&&process.env.DB_NAME==='puna_ci_synthetic'&&process.env.DB_USER==='puna_ci'&&/^[a-f0-9]{32}$/.test(process.env.PUNA_TEST_RUN_ID||'')&&(process.env.PUNA_D1_SECRET?.length||0)>=32;}
export const orderingIntake=()=>orderingLocal()&&process.env.PUNA_ORDERING_ACCEPT_NEW==='true';
export function localRequest(req:Request){
 const loopback=(authority:string)=>{try{const u=new URL('http://'+authority);return !u.username&&!u.password&&u.pathname==='/'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{return false;}};
 // Next can normalize req.url to its listener host. Validate original authorities too.
 return orderingLocal()&&loopback(new URL(req.url).host)&&loopback(req.headers.get('host')||'')&&['x-forwarded-host','forwarded'].every(name=>{const value=req.headers.get(name);return !value||(name==='x-forwarded-host'&&loopback(value));});
}
export function requireLocal(){if(!orderingLocal())throw new CommerceError('LOCAL_ORDERING_DISABLED',404);}
export function fixtureAccess(req:Request){const expected=process.env.PUNA_D1_FIXTURE_SECRET||'',actual=req.headers.get('x-local-fixture-key')||'';return localRequest(req)&&expected.length>=32&&actual.length===expected.length&&timingSafeEqual(Buffer.from(expected),Buffer.from(actual));}
export const opaqueToken=()=>randomBytes(32).toString('hex');
const encryptionKey=()=>createHash('sha256').update(process.env.PUNA_D1_SECRET||'').digest();
export function seal(value:unknown,purpose:string){requireLocal();const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);cipher.setAAD(Buffer.from(purpose));const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');}
export function unseal<T>(value:string,purpose:string):T{requireLocal();try{const b=Buffer.from(value,'base64url');if(b.length<29||b.length>12000)throw Error();const d=createDecipheriv('aes-256-gcm',encryptionKey(),b.subarray(0,12));d.setAAD(Buffer.from(purpose));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString());}catch{throw new CommerceError('INVALID_OR_EXPIRED_ACCESS',404);}}
export async function boundedText(req:Request,limit=16000){const reader=req.body?.getReader();if(!reader)throw new CommerceError('INVALID_REQUEST',400);let length=0;const chunks:Uint8Array[]=[];try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new CommerceError('REQUEST_TOO_LARGE',413);}chunks.push(value);}}finally{reader.releaseLock();}return Buffer.concat(chunks).toString();}
export async function boundedJson(req:Request){const text=await boundedText(req);try{return JSON.parse(text)}catch{throw new CommerceError('INVALID_REQUEST',400);}}
