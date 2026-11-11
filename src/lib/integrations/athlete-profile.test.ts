import { expect,it,vi } from 'vitest';
import { personalProfile,memberProfilePatch,browserProfilePatch } from './athlete-profile';
vi.mock('./karatetech-sync',()=>({KarateTechApiClient:{syncAthleteProfile:vi.fn()}}));
import { KarateTechApiClient } from './karatetech-sync';
import { exchangeAthleteProfile } from './universal-athlete-sync';
const member={id:'member-a',club_id:'club-a',branch_id:'branch-a',full_name:'Athlete A',gender:'Female',date_of_birth:'2004-02-29',ic_passport:'UA-001',phone:'012',sport_data:{weightKg:55,heightCm:165,beltRank:'Black',preferredDiscipline:'Both'},emergency_contact:{name:'Parent',phone:'013',relationship:'Parent'},status:'Active'};
it('maps personal fields without club, branch, scoring or discipline data',()=>{
 const p=personalProfile(member);expect(p.passport_ic).toBe('UA001');expect(p).not.toHaveProperty('branch_id');expect(p).not.toHaveProperty('status');
 const patch=memberProfilePatch(member,{...p,weight:60});expect(patch.sport_data).toMatchObject({beltRank:'Black',preferredDiscipline:'Both',weightKg:60});expect(patch.emergency_contact.relationship).toBe('Parent');expect(patch).not.toHaveProperty('club_id');
 const browser=browserProfilePatch({sportData:{beltRank:'Black'}},p);expect(browser.sportData.beltRank).toBe('Black');expect(browser).not.toHaveProperty('branchId');
});
it('pulls remote edits only when the local profile has not changed',async()=>{
 const p=personalProfile(member);vi.mocked(KarateTechApiClient.syncAthleteProfile).mockResolvedValue({success:false,status:'CONFLICT',revision:2,profile:{...p,phone:'019'}});
 const result=await exchangeAthleteProfile(member,p,1);expect(result.success).toBe(true);expect(result.profile.phone).toBe('019');
 expect(KarateTechApiClient.syncAthleteProfile).toHaveBeenLastCalledWith(expect.objectContaining({source_id:'member-a',club_id:'club-a',branch_id:'branch-a',expected_revision:1}));
});
it('preserves a conflict when both sides changed or there is no baseline',async()=>{
 const p=personalProfile(member);vi.mocked(KarateTechApiClient.syncAthleteProfile).mockResolvedValue({success:false,status:'CONFLICT',revision:2,profile:{...p,phone:'019'}});
 expect((await exchangeAthleteProfile({...member,phone:'018'},p,1)).success).toBe(false);
 expect((await exchangeAthleteProfile(member,null,null)).success).toBe(false);
});
it('never auto-resolves an identity or branch conflict',async()=>{
 const p=personalProfile(member);vi.mocked(KarateTechApiClient.syncAthleteProfile).mockResolvedValue({success:false,status:'MEMBERSHIP_CONFLICT'});
 expect((await exchangeAthleteProfile(member,p,1)).success).toBe(false);
});
