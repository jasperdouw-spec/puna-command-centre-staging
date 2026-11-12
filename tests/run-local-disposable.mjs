// Explicitly authorized Phase B/C local acceptance. This runner owns only its new
// tmpfs database container. It never reads an .env file or uses an existing DB.
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {rmSync,readdirSync} from 'node:fs';
import {assertSyntheticContext} from './disposable-context.mjs';
if(readdirSync('.').some(name=>name.startsWith('.env')&&name!=='.env.example'))throw Error('Disposable tests refuse worktrees containing environment files');
for(const port of [3100,3443]){const s=createServer();await new Promise((resolve,reject)=>s.once('error',reject).listen(port,'127.0.0.1',resolve));await new Promise(r=>s.close(r));}
const run=randomBytes(16).toString('hex');let container;
try{
 container=execFileSync('docker',['run','--detach','--name','puna-phase-d-'+run.slice(0,12),'--label','puna.synthetic.run='+run,'--memory=1g','--cpus=2','--tmpfs','/var/lib/mysql:rw,size=536870912','-p','127.0.0.1::3306','-e','MARIADB_ROOT_PASSWORD=synthetic-ci-root-only','-e','MARIADB_DATABASE=puna_ci_synthetic','-e','MARIADB_USER=puna_ci','-e','MARIADB_PASSWORD=synthetic-ci-user-only','mariadb:11.8.9'],{encoding:'utf8'}).trim();
 const [details]=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}));
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!(/^(DB_|PUNA_|SQUARE_|GOOGLE_|BOOTSTRAP_|GITHUB_|RUNNER_)/.test(k))));
 Object.assign(env,{PUNA_DISPOSABLE_LOCAL_TESTS:'true',PUNA_PHASE_C_TESTS:'true',PUNA_PHASE_D_TESTS:'true',PUNA_D1_SECRET:randomBytes(32).toString('hex'),PUNA_D1_FIXTURE_SECRET:randomBytes(32).toString('hex'),PUNA_D1_ORIGIN:'https://localhost:3443',PUNA_TEST_RUN_ID:run,PUNA_CI_DB_CONTAINER:container,DB_HOST:'127.0.0.1',DB_PORT:details.NetworkSettings.Ports['3306/tcp'][0].HostPort,DB_NAME:'puna_ci_synthetic',DB_USER:'puna_ci',DB_PASSWORD:'synthetic-ci-user-only',NEXT_TELEMETRY_DISABLED:'1'});
 Object.assign(process.env,env);delete process.env.GITHUB_ACTIONS;delete process.env.RUNNER_ENVIRONMENT;assertSyntheticContext();
 env.PUNA_CAPTURE_SYNTHETIC_SCREENSHOTS='false';
 let ready=false;for(let n=0;n<45;n++){const r=spawnSync('docker',['exec',container,'healthcheck.sh','--connect','--innodb_initialized'],{stdio:'ignore'});if(r.status===0){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}if(!ready)throw Error('Disposable database did not become ready');
 console.log('Verified new tmpfs MariaDB 11.8.9; loopback only; synthetic credentials.');
 // Next persists the synthetic JWKS fetch between local runs, whereas each
 // provider fixture generates a new signing key. Keep provider caches isolated.
 rmSync('.next/cache/fetch-cache',{recursive:true,force:true});
 const result=spawnSync(process.execPath,['tests/integration.mjs'],{env,stdio:'inherit',timeout:600000});if(result.status!==0)throw Error('Integration failed: '+(result.status??result.error?.message));
}finally{if(container){execFileSync('docker',['rm','--force',container],{stdio:'ignore'});console.log('Removed only the owned disposable database container.');}}
