import { KarateTechApiClient } from './karatetech-sync';
import { personalProfile, sameProfile } from './athlete-profile';

/** Optimistic sync: only an unchanged local copy may accept a remote-only edit. */
export async function exchangeAthleteProfile(member: any, baseline: any, revision: number | null) {
  const profile=personalProfile(member);
  const result=await KarateTechApiClient.syncAthleteProfile({
    source_id:member.id,club_id:member.club_id ?? member.clubId,
    branch_id:member.branch_id ?? member.branchId ?? null,
    profile,expected_revision:revision,
  });
  if (!result.success && result.status==='CONFLICT' && baseline && sameProfile(profile,baseline)) {
    // No local edit: pull the current canonical profile without issuing another write.
    return {...result,success:true,status:'SYNCED'};
  }
  return result;
}

export async function syncSavedAthlete(db: any, input: any, resolution?: { choice: string; revision: number }) {
  const member=input.__databaseRow || input;
  const pending=await db.from('athlete_sync_state').upsert({source_id:member.id},{onConflict:'source_id',ignoreDuplicates:true});
  if(pending.error)throw new Error('Unable to queue athlete synchronization.');
  const {data:state,error}=await db.from('athlete_sync_state').select('*').eq('source_id',member.id).maybeSingle();
  if (error) throw new Error('Athlete sync migration is not available.');
  let result=await exchangeAthleteProfile(member,state?.baseline,state?.revision ?? null);
  if(resolution) {
    if(result.status!=='CONFLICT' || result.revision!==resolution.revision) return {success:false,status:'CONFLICT_CHANGED',error:'Reload the conflict before resolving.'};
    if(resolution.choice==='remote')result={...result,success:true,status:'SYNCED'};
    else if(resolution.choice==='local')result=await exchangeAthleteProfile(member,null,resolution.revision);
    else throw new Error('Invalid conflict resolution.');
  }
  const saved=await db.rpc('scms_apply_athlete_sync',{
    member_id:member.id,expected_member:member,expected_state_revision:state?.revision ?? null,result,
  });
  if (saved.error) throw new Error('Unable to commit athlete synchronization.');
  return saved.data;
}
