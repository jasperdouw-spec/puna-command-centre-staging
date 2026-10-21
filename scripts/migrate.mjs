import mysql from 'mysql2/promise';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const apply=process.argv.includes('--apply'),name=process.env.DB_NAME;
if(!['puna_ci_synthetic','u291146170_puna_stage'].includes(name))throw Error('Database is outside the approved staging scope');
if(apply&&name!=='puna_ci_synthetic'&&process.env.PUNA_SCHEMA_APPROVAL!=='006_commerce')throw Error('Exact staging schema approval and backup verification required');
const sql=readFileSync('db/006_commerce.sql','utf8'),checksum=createHash('sha256').update(sql).digest('hex'),tables=[...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(m=>m[1]);
const db=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:name,multipleStatements:true});
try{
 const [version]=await db.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='products' AND COLUMN_NAME='version'",[name]);
 if(version.length!==1)throw Error('products.version must be inspected and separately approved before migration');
 const [found]=await db.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=?',[name]),existing=new Set(found.map(t=>t.TABLE_NAME));
 if(existing.has('schema_migrations')){
  const [rows]=await db.execute("SELECT checksum FROM schema_migrations WHERE id='006_commerce'");
  if(rows.length){if(rows[0].checksum!==checksum)throw Error('Migration checksum changed');console.log(JSON.stringify({status:'already_applied',migration:'006_commerce',checksum}));process.exitCode=0;}
  else throw Error('Migration ledger exists without this migration; inspect partial state before applying');
 }else{
  const collisions=tables.filter(t=>existing.has(t));if(collisions.length)throw Error('Existing extension tables need inspection: '+collisions.join(','));
  console.log(JSON.stringify({mode:apply?'apply':'plan',migration:'006_commerce',checksum,newTables:tables,existingTablesPreserved:existing.size}));
  if(apply){await db.query(sql);await db.execute("INSERT INTO schema_migrations(id,checksum) VALUES('006_commerce',?)",[checksum]);console.log('Applied additive schema; no application records imported');}
 }
}finally{await db.end()}
