import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email=process.env.SCMS_TEST_EMAIL;
const password=process.env.SCMS_TEST_PASSWORD;
const allowedClub=process.env.SCMS_TEST_ALLOWED_CLUB_ID;
const allowedBranch=process.env.SCMS_TEST_ALLOWED_BRANCH_ID;
const deniedClub=process.env.SCMS_TEST_DENIED_CLUB_ID;
const deniedBranch=process.env.SCMS_TEST_DENIED_BRANCH_ID;

const required={url,key,email,password,allowedClub,allowedBranch,deniedClub,deniedBranch};
for(const [name,value] of Object.entries(required)) {
  if(!value) throw new Error(`Missing tenant isolation test setting: ${name}`);
}

const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {error:signInError}=await supabase.auth.signInWithPassword({email,password});
assert.ifError(signInError);

const marker=`RLS-TEST-${Date.now()}`;
const base={
 p_full_name:marker,p_gender:'Male',p_dob:'2000-01-01',p_ic_passport:marker,
 p_email:null,p_phone:null,p_belt_rank:null,p_weight_kg:null,p_is_athlete:false,p_is_volunteer:false
};

const allowed=await supabase.rpc('create_member_atomic',{...base,p_club_id:allowedClub,p_branch_id:allowedBranch});
assert.equal(allowed.error,null,'Assigned tenant create should succeed');
assert.ok(allowed.data,'Assigned tenant create should return member UUID');

const denied=await supabase.rpc('create_member_atomic',{...base,p_full_name:marker+'-DENIED',p_ic_passport:marker+'-DENIED',p_club_id:deniedClub,p_branch_id:deniedBranch});
assert.ok(denied.error,'Cross-tenant create must be rejected');

const {data:visible,error:readError}=await supabase.from('members').select('id,club_id,branch_id').eq('id',allowed.data).single();
assert.ifError(readError);
assert.equal(visible.club_id,allowedClub);
assert.equal(visible.branch_id,allowedBranch);

const cleanup=await supabase.from('members').delete().eq('id',allowed.data);
assert.ifError(cleanup.error);
console.log('Tenant isolation checks passed.');
