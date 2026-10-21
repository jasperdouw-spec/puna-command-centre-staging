import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import mysql from 'mysql2/promise';
export async function verifySyntheticRecovery(){
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');assert.equal(process.env.DB_NAME,'puna_ci_synthetic');assert.equal(process.env.DB_HOST,'127.0.0.1');
 const container=process.env.PUNA_CI_DB_CONTAINER;assert.match(container||'',/^[a-f0-9]{64}$/);
 const admin=await mysql.createConnection({host:'127.0.0.1',port:Number(process.env.DB_PORT),user:'root',password:'synthetic-ci-root-only',multipleStatements:true});
 const target='puna_ci_restore';
 try{
 const [existing]=await admin.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[target]);assert.equal(existing.length,0,'Never overwrite a recovery target');
 const dump=execFileSync('docker',['exec','-e','MYSQL_PWD=synthetic-ci-root-only',container,'mariadb-dump','--user=root','--single-transaction','--skip-comments','--skip-triggers','--no-tablespaces','puna_ci_synthetic'],{encoding:'utf8',maxBuffer:10*1024*1024});
 assert.equal(/^\s*(?:USE\s|CREATE\s+DATABASE|DROP\s+DATABASE)/im.test(dump),false,'Dump must not select or replace a database');
 await admin.query('CREATE DATABASE puna_ci_restore');
 await admin.query('USE puna_ci_restore');await admin.query(dump);
 const metadata=async schema=>{
 const [tables]=await admin.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME',[schema]);
 const counts=[];for(const t of tables){assert.match(t.TABLE_NAME,/^[a-z_]+$/);const [r]=await admin.query('SELECT COUNT(*) n FROM '+schema+'.'+t.TABLE_NAME);counts.push([t.TABLE_NAME,Number(r[0].n)]);}
 const [columns]=await admin.execute('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,ORDINAL_POSITION',[schema]);
 const [indexes]=await admin.execute('SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX',[schema]);
 const [keys]=await admin.execute('SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,COLUMN_NAME',[schema]);
 return {counts,columns,indexes,keys};
 };
 const original=await metadata('puna_ci_synthetic'),restored=await metadata(target);assert.deepEqual(restored,original);
 return {tables:original.counts.length,indexes:original.indexes.length,foreignKeys:original.keys.length};
 }finally{await admin.end()}
}
