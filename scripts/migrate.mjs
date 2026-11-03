import mysql from 'mysql2/promise';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),apply=args.includes('--apply'),name=process.env.DB_NAME;
const migrationArgs=args.filter(a=>a.startsWith('--migration='));
if(migrationArgs.length>1||args.some(a=>a!=='--apply'&&!a.startsWith('--migration=')))throw Error('Unsupported migration arguments');
const migration=(migrationArgs[0]?.slice('--migration='.length)||'006_commerce').replace(/\.sql$/,'');
if(!['006_commerce','007_customer_notes'].includes(migration))throw Error('Migration is outside the reviewed scope');
if(!['puna_ci_synthetic','u291146170_puna_stage'].includes(name))throw Error('Database is outside the approved staging scope');
if(apply&&name!=='puna_ci_synthetic'&&process.env.PUNA_SCHEMA_APPROVAL!==migration)throw Error('Exact staging schema approval and backup verification required');
const sql=readFileSync('db/'+migration+'.sql','utf8'),checksum=createHash('sha256').update(sql).digest('hex'),tables=[...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(m=>m[1]);
const db=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:name,multipleStatements:true});
try{
 const [version]=await db.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='products' AND COLUMN_NAME='version'",[name]);
 if(version.length!==1)throw Error('products.version must be inspected and separately approved before migration');
 const [found]=await db.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=?',[name]),existing=new Set(found.map(t=>t.TABLE_NAME));
 if(migration==='007_customer_notes'){
  if(!existing.has('schema_migrations'))throw Error('Commerce schema must be inspected and applied before customer notes');
  const [prior]=await db.execute("SELECT checksum FROM schema_migrations WHERE id='006_commerce'");
  const expected=createHash('sha256').update(readFileSync('db/006_commerce.sql','utf8')).digest('hex');
  if(prior.length!==1||prior[0].checksum!==expected)throw Error('Commerce migration ledger does not match the reviewed schema');
 }
 const [applied]=existing.has('schema_migrations')?await db.execute('SELECT checksum FROM schema_migrations WHERE id=?',[migration]):[[]];
 if(applied.length){
  if(applied[0].checksum!==checksum)throw Error('Migration checksum changed');
  const missing=tables.filter(t=>!existing.has(t));if(missing.length)throw Error('Migration ledger exists but expected tables are missing; inspect and recover before continuing: '+missing.join(','));
  console.log(JSON.stringify({status:'already_applied',migration,checksum}));
 }else{
  if(migration==='006_commerce'&&existing.has('schema_migrations'))throw Error('Migration ledger exists without this migration; inspect partial state before applying');
  const collisions=tables.filter(t=>existing.has(t));if(collisions.length)throw Error('Existing extension tables need inspection: '+collisions.join(','));
  console.log(JSON.stringify({mode:apply?'apply':'plan',migration,checksum,newTables:tables,existingTablesPreserved:existing.size}));
  if(apply){await db.query(sql);await db.execute('INSERT INTO schema_migrations(id,checksum) VALUES(?,?)',[migration,checksum]);console.log('Applied additive schema; no application records imported');}
 }
}finally{await db.end()}
