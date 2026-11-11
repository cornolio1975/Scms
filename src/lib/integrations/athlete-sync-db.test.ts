import { PGlite } from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {beforeAll,afterAll,it,expect} from 'vitest';
const db=new PGlite();const club='11111111-1111-4111-8111-111111111111',branch='22222222-2222-4222-8222-222222222222';
let member:any;
const p={address:null,nationality_code:null,full_name:'Athlete A',gender:'Female',dob:'2004-02-29',passport_ic:'UA001',phone:'019',email:null,photo_url:null,weight:60,height:165,emergency_contact_name:'Parent',emergency_contact_phone:'013'};
async function apply(expected:any,result:any,revision:number|null=null){return (await db.query<any>('select scms_apply_athlete_sync($1,$2::jsonb,$3,$4::jsonb) result',[member.id,JSON.stringify(expected),revision,JSON.stringify(result)])).rows[0].result;}
async function current(){return (await db.query<any>('select to_jsonb(m) row from members m where id=$1',[member.id])).rows[0].row;}
beforeAll(async()=>{
 await db.exec('create role anon;create role authenticated;create role service_role; create table clubs(id uuid primary key);create table club_branches(id uuid primary key,club_id uuid); create table profiles(id uuid primary key);');
 const file=(await readdir('supabase/migrations')).find(x=>x.endsWith('_universal_athlete_sync.sql'))!;await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.query('insert into clubs values($1)',[club]);await db.query('insert into club_branches values($1,$2)',[branch,club]);
 member=(await db.query<any>(`insert into members(member_no,club_id,branch_id,full_name,ic_passport,sport_data,emergency_contact) values('M001',$1,$2,'Athlete A','UA001','{"beltRank":"Black","weightKg":55}','{"relationship":"Parent"}') returning *`,[club,branch])).rows[0];
 member=await current();
},30000);
afterAll(()=>db.close());
it('atomically applies a profile without altering branch, rank, discipline or membership status',async()=>{
 const result={success:true,athlete_id:'33333333-3333-4333-8333-333333333333',revision:1,profile:p};
 expect((await apply(member,result)).success).toBe(true);
 const saved=await current();expect(saved).toMatchObject({club_id:club,branch_id:branch,status:'Active',phone:'019',sport_data:{beltRank:'Black',weightKg:60},emergency_contact:{relationship:'Parent',name:'Parent'}});
});
it('rejects an edit made while the network call was in flight',async()=>{
 const before=await current();await db.query("update members set phone='local-new' where id=$1",[member.id]);
 const result=await apply(before,{success:true,athlete_id:'33333333-3333-4333-8333-333333333333',revision:2,profile:p},1);
 expect(result.status).toBe('RETRY');expect((await current()).phone).toBe('local-new');
 const state=(await db.query<any>('select * from athlete_sync_state')).rows[0];expect(state.revision).toBe(1);
});
it('records a conflict without replacing either the local profile or the accepted baseline',async()=>{
 const result=await apply(await current(),{success:false,status:'CONFLICT',revision:2,profile:p},1);expect(result.success).toBe(false);
 expect((await current()).phone).toBe('local-new');const state=(await db.query<any>('select * from athlete_sync_state')).rows[0];expect(state.status).toBe('CONFLICT');expect(state.revision).toBe(1);
});
it('refuses direct anonymous or authenticated execution of the apply RPC',async()=>{
 const row=(await db.query<any>("select has_function_privilege('anon','scms_apply_athlete_sync(uuid,jsonb,bigint,jsonb)','EXECUTE') a,has_table_privilege('authenticated','athlete_sync_state','SELECT') b")).rows[0];expect(row).toEqual({a:false,b:false});
});
