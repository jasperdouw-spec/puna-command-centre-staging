import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
export function assertSyntheticContext({database=true}={}){
 if(process.env.GITHUB_ACTIONS==='true')assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
 else if(!database)assert.equal(process.env.PUNA_LOCAL_DOMAIN_TESTS,'true','Pure domain tests require explicit local test mode');
 else {
  assert.equal(process.env.PUNA_DISPOSABLE_LOCAL_TESTS,'true','Use the guarded disposable runner');
  const id=process.env.PUNA_CI_DB_CONTAINER;assert.match(id||'',/^[a-f0-9]{64}$/);
  const [c]=JSON.parse(execFileSync('docker',['inspect',id],{encoding:'utf8'}));
  assert.equal(c.Config.Labels['puna.synthetic.run'],process.env.PUNA_TEST_RUN_ID);assert.match(process.env.PUNA_TEST_RUN_ID||'',/^[a-f0-9]{32}$/);
  assert.equal(c.Config.Image,'mariadb:11.8.9');assert.equal(c.State.Running,true);
  assert.equal(c.HostConfig.Tmpfs['/var/lib/mysql'],'rw,size=536870912');assert.ok(c.Mounts.every(m=>m.Type==='tmpfs'),'No existing volumes or host bind mounts');
  const ports=c.NetworkSettings.Ports['3306/tcp'];assert.equal(ports.length,1);assert.equal(ports[0].HostIp,'127.0.0.1');assert.equal(ports[0].HostPort,process.env.DB_PORT);
 }
 if(database){assert.equal(process.env.DB_HOST,'127.0.0.1');assert.equal(process.env.DB_NAME,'puna_ci_synthetic');assert.equal(process.env.DB_USER,'puna_ci');assert.equal(process.env.DB_PASSWORD,'synthetic-ci-user-only');}
}
