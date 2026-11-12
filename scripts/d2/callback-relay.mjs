// Candidate callback-only listener. No Next.js, DB, proxying, provider calls or stock writes.
// Not started by npm start/build; no public tunnel is created by this module.
import http from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {open,mkdir,lstat,realpath,readdir,readFile,link,unlink} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifySquareSignature} from './guards.mjs';

const PATH = '/api/ordering/square/webhook';
const TYPES = new Set(['payment.created','payment.updated','refund.created','refund.updated']);
const hash = value => createHash('sha256').update(value).digest('hex');
const deny = code => { throw Object.assign(new Error('CALLBACK_REJECTED'),{status:code}); };
const id = value => typeof value === 'string' && value.length>=5 && value.length<=100 && !/[^A-Za-z0-9_-]/.test(value);

export function validateRelayConfig(c) {
  if (c?.enabled !== true || c.environment !== 'sandbox' || c.identityVerified !== true) throw Error('VERIFIED_SANDBOX_CONFIGURATION_REQUIRED');
  const u = new URL(c.notificationUrl);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== PATH) throw Error('EXACT_HTTPS_CALLBACK_REQUIRED');
  if (!id(c.merchantId) || !id(c.locationId) || typeof c.signatureKey !== 'string' || c.signatureKey.length < 20) throw Error('PRIVATE_CALLBACK_CONFIGURATION_REQUIRED');
  if (!Number.isSafeInteger(c.expiresAt) || c.expiresAt <= Date.now() || c.expiresAt > Date.now()+4*3600000) throw Error('BOUNDED_TEST_SESSION_REQUIRED');
  return c;
}

async function privateDirectory(path) {
  await mkdir(path,{recursive:true,mode:0o700});
  const s=await lstat(path);
  if (!s.isDirectory() || s.isSymbolicLink() || (s.mode & 0o077) || s.uid !== process.getuid()) throw Error('PRIVATE_SPOOL_REQUIRED');
  return realpath(path);
}

export async function createCallbackRelay(config, spool) {
  const c=validateRelayConfig(config),directory=await privateDirectory(spool);
  let windowStart=Date.now(),requests=0;
  // Serialize disk acceptance to make event-ID collision and bounded-queue checks deterministic.
  let chain=Promise.resolve();
  const persist=event=>{
    const result=chain.then(async()=>{
      const target=join(directory,hash(event.eventId)+'.json');
      try {const old=JSON.parse(await readFile(target,'utf8'));if(old.bodyHash!==event.bodyHash)deny(409);return;} catch(e) {if(e.code!=='ENOENT')throw e;}
      if ((await readdir(directory)).filter(p=>p.endsWith('.json')).length>=1000) deny(503);
      const temp=join(directory,'.pending-'+randomUUID()),handle=await open(temp,'wx',0o600);
      try {await handle.writeFile(JSON.stringify(event));await handle.sync();} finally {await handle.close();}
      try {await link(temp,target);} finally {await unlink(temp);}
      const dir=await open(directory,'r');try {await dir.sync();} finally {await dir.close();}
    });
    chain=result.catch(()=>{});return result;
  };
  const server=http.createServer({maxHeaderSize:8192},async(req,res)=>{
    const reply=status=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify({accepted:status===202}));};
    try {
      if (req.method!=='POST' || req.url!==PATH) deny(404);
      if (Date.now()>c.expiresAt) deny(503);
      if (Date.now()-windowStart>60000){windowStart=Date.now();requests=0;}
      if (++requests>120) deny(429);
      if (req.headers['content-type']?.split(';')[0].trim()!=='application/json' || req.headers['content-encoding']) deny(415);
      if (Number(req.headers['content-length']||0)>32768) deny(413);
      let size=0;const chunks=[];
      for await (const chunk of req){size+=chunk.length;if(size>32768)deny(413);chunks.push(chunk);}
      const raw=Buffer.concat(chunks);
      if (!verifySquareSignature(raw,req.headers['x-square-hmacsha256-signature'],c.signatureKey,c.notificationUrl)) deny(403);
      let body;try {body=JSON.parse(raw.toString());}catch{deny(400);}
      if (!body || !id(body.event_id) || !TYPES.has(body.type) || body.merchant_id!==c.merchantId || !id(body.data?.id)) deny(400);
      const object=body.data?.object?.payment||body.data?.object?.refund;
      if(object?.location_id && object.location_id!==c.locationId)deny(400);
      // Persist only event routing metadata. Never trust or save card/contact/order tokens/status here.
      await persist({eventId:body.event_id,type:body.type,objectId:body.data.id,bodyHash:hash(raw),receivedAt:new Date().toISOString()});
      reply(202);
    }catch(e){if(!res.headersSent)reply(e.status||503);}
  });
  server.requestTimeout=5000;server.headersTimeout=5000;server.keepAliveTimeout=1000;server.maxConnections=8;server.maxRequestsPerSocket=20;
  return server;
}

export async function readPrivateRelayConfig(path,repo) {
  const actual=await realpath(path),root=await realpath(repo),r=relative(root,actual),s=await lstat(path);
  if ((r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r)) || s.isSymbolicLink() || !s.isFile() || (s.mode&0o077) || s.uid!==process.getuid() || s.size>8192) throw Error('PRIVATE_CONFIGURATION_OUTSIDE_REPOSITORY_REQUIRED');
  return validateRelayConfig(JSON.parse(await readFile(actual,'utf8')));
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    if(process.env.PUNA_D2_RELAY_ENABLED!=='true')throw Error('RELAY_DISABLED');
    const repo=fileURLToPath(new URL('../..',import.meta.url));
    const config=await readPrivateRelayConfig(process.env.PUNA_D2_RELAY_CONFIG||'',repo);
    const spool=process.env.PUNA_D2_RELAY_SPOOL;
    if(!spool)throw Error('PRIVATE_SPOOL_REQUIRED');
    const directory=await privateDirectory(spool),rel=relative(await realpath(repo),directory);
    if(rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel))throw Error('PRIVATE_SPOOL_OUTSIDE_REPOSITORY_REQUIRED');
    const server=await createCallbackRelay(config,directory);
    server.listen(3901,'127.0.0.1',()=>process.stdout.write('D2 callback-only listener on loopback; no public tunnel created.\n'));
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
  }catch{process.stderr.write('D2 callback relay not started: private approved configuration required.\n');process.exitCode=1;}
}
