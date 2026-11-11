// Hostinger cron entry: run this script every minute with server-only environment.
const base=process.env.SCMS_APP_URL;
const secret=process.env.ATHLETE_SYNC_CRON_SECRET;
if(!base || !secret)throw new Error('SCMS_APP_URL and ATHLETE_SYNC_CRON_SECRET are required.');
const url=new URL('/api/internal/athlete-sync',base);
if(url.protocol!=='https:' && !['localhost','127.0.0.1'].includes(url.hostname))throw new Error('HTTPS is required.');
const result=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(60000)});
const summary=await result.json();
console.log(JSON.stringify({ok:result.ok,synced:summary.synced,conflicts:summary.conflicts,failed:summary.failed}));
if(!result.ok || summary.failed)process.exitCode=1;
