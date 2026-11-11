import { browserProfilePatch, personalProfile, sameProfile } from './athlete-profile';
/** Called only from member management; never from scoreboards or scoring panels. */
export async function syncBrowserAthletes(clubId: string, branchId?: string) {
 const {store}=await import('@/lib/store');
 const rows=store.getMembers(clubId).filter(m=>(!branchId || branchId==='__ALL__' || m.branchId===branchId) && m.isAthlete);
 const failures: string[]=[];
 for(const member of rows) {
  const snapshot=personalProfile(member);
  let response: Response;
  try {response=await fetch('/api/integration/karatetech/athlete-profiles/browser',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({member}),
  });}catch {failures.push(member.id);continue;}
  const result=await response.json();
  if(!response.ok || !result.success) {failures.push(member.id);if(response.status===401||response.status===403)break;continue;}
  const current=store.members.find(m=>m.id===member.id);
  // An edit made during the network request always stays local for the next attempt.
  if(!current || !sameProfile(current,snapshot) || current.clubId!==member.clubId || current.branchId!==member.branchId) {failures.push(member.id);continue;}
  store.updateMember(member.id,{
    ...browserProfilePatch(current,result.profile),
    universalSync:{revision:result.revision,profile:result.profile,athleteId:result.athlete_id},
  } as any,'Universal athlete synchronization');
 }
 return {success:failures.length===0,failures};
}
