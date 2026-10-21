// Run from the hosting scheduler with environment variables supplied privately.
const origin=process.env.PUNA_ORIGIN,token=process.env.PUNA_JOB_TOKEN;
if(origin!=='https://staging.punaempanadas.ca'||!token)throw Error('Staging job configuration incomplete');
const r=await fetch(origin+'/api/jobs',{method:'POST',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000)});
if(!r.ok)throw Error('Staging job HTTP '+r.status);
const result=await r.json();console.log(JSON.stringify({processed:result.processed,blocked:result.blocked}));
