import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const transpile = text => ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const moduleFrom = code => import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
globalThis.transferTestSync = await moduleFrom(transpile(await readFile('src/lib/integrations/karatetech-sync.ts','utf8')));
let user = {id:'caller'};
let roles = [{role:'CLUB_ADMIN',club_id:'club-1',branch_id:null}];
let memberships = [{user_id:'athlete-1',club_id:'club-1',branch_id:'branch-1',role:'ATHLETE'},{user_id:'athlete-2',club_id:'club-1',branch_id:'branch-2',role:'MEMBER'}];
const profiles = [{id:'athlete-1',full_name:'Authorized Athlete'},{id:'athlete-2',full_name:'Other Branch Athlete'}];
function from(table) {
  const filters=[];
  const query={select(){return query},eq(k,v){filters.push(row=>row[k]===v);return query},in(k,vs){filters.push(row=>vs.includes(row[k]));return query},order(){return query},maybeSingle(){query.single=true;return query},then(resolve,reject){
    let rows=table==='clubs'?[{id:'club-1',name:'Test Club',display_name:'Test'}]:table==='profiles'?profiles:filters.length&&table==='user_roles'&&roles.some(r=>r.user_id===undefined)&&filters[0]({user_id:'caller'})?roles.map(r=>({...r,user_id:'caller'})):memberships;
    rows=rows.filter(row=>filters.every(f=>f(row)));return Promise.resolve({data:query.single?rows[0]||null:rows,error:null}).then(resolve,reject);
  }};return query;
}
globalThis.transferTestSession=async()=>({auth:{getUser:async()=>({data:{user}})},from});
globalThis.transferTestAdmin=()=>({from});
let source=await readFile('src/lib/integrations/scms-source.ts','utf8');
source=source.replace(/import \{ createClient \} from [^;]+;/,"const createClient = globalThis.transferTestSession;").replace(/import \{ createClient as createAdminClient \} from [^;]+;/,"const createAdminClient = globalThis.transferTestAdmin;").replace(/import \{ toKarateTechPayload, KarateTechSyncService \} from [^;]+;/,"const { toKarateTechPayload, KarateTechSyncService } = globalThis.transferTestSync;");
const {syncContext,sourceMembers,sourcePayload}=await moduleFrom(transpile(source));
await assert.rejects(syncContext(''),/Select a club/);
user=null;await assert.rejects(syncContext('club-1'),/Sign in/);user={id:'caller'};
roles=[{role:'OBSERVER',club_id:'club-1'}];await assert.rejects(syncContext('club-1'),/permission/);
roles=[{role:'CLUB_ADMIN',club_id:'another-club'}];await assert.rejects(syncContext('club-1'),/permission/);
roles=[{role:'BRANCH_MANAGER',club_id:'club-1',branch_id:'branch-1'}];const scoped=await syncContext('club-1');assert.deepEqual(scoped.branches,['branch-1']);assert.deepEqual((await sourceMembers(scoped)).map(m=>m.id),['athlete-1']);
const payload=sourcePayload(profiles[0],scoped,{scms_participant_id:'forged',club_id:'forged',full_name:'Forged',gender:'Female',dob:'2004-02-29',passport_ic:'TEST001',weight:55,height:165});
assert.equal(payload.scms_participant_id,'athlete-1');assert.equal(payload.club_id,'club-1');assert.equal(payload.full_name,'Authorized Athlete');
assert.throws(()=>sourcePayload(profiles[0],scoped),/Missing or invalid/);
console.log('SCMS transfer authorization and identity checks passed (7 scenarios).');
delete globalThis.transferTestSync;delete globalThis.transferTestSession;delete globalThis.transferTestAdmin;
