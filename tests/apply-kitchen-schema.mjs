import {assertSyntheticContext} from './disposable-context.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
assertSyntheticContext();
const db=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,multipleStatements:true});
const hash=s=>createHash('sha256').update(s).digest('hex');
const id='phase_c_live_kitchen_candidate_v1',sql=readFileSync('db/proposals/phase_c_live_kitchen.sql','utf8'),checksum=hash(sql),tables=[...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(x=>x[1]);
try {
 for(const name of ['006_commerce','008_reporting']){const [r]=await db.execute('SELECT checksum FROM schema_migrations WHERE id=?',[name]);if(r[0]?.checksum!==hash(readFileSync('db/'+name+'.sql')))throw Error('Prior migration mismatch: '+name);}
 const [all]=await db.query('SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()'),existing=new Set(all.map(x=>x.TABLE_NAME));
 if(all.some(x=>['users','products','audit_log'].includes(x.TABLE_NAME)&&x.ENGINE!=='InnoDB'))throw Error('InnoDB prerequisites missing');
 const [applied]=await db.execute('SELECT checksum FROM schema_migrations WHERE id=?',[id]);
 if(applied.length){if(applied[0].checksum!==checksum||tables.some(t=>!existing.has(t)))throw Error('Candidate checksum/schema mismatch');console.log('Kitchen candidate already applied: '+checksum);}
 else {if(tables.some(t=>existing.has(t)))throw Error('Partial/colliding kitchen schema; inspect before continuing');await db.query(sql);await db.execute('INSERT INTO schema_migrations(id,checksum) VALUES(?,?)',[id,checksum]);console.log('Applied unnumbered kitchen candidate to verified disposable database: '+checksum);}
} finally {await db.end();}
