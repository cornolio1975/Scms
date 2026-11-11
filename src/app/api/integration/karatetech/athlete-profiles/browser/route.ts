import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { exchangeAthleteProfile } from '@/lib/integrations/universal-athlete-sync';
export const dynamic='force-dynamic';
export async function POST(request: Request) {
 try {
  const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(!user)return NextResponse.json({success:false},{status:401});
  const {data:roles,error}=await db.from('user_roles').select('role').eq('user_id',user.id);
  if(error || !roles?.some(r=>['SUPERADMIN','SYSTEM_ADMIN'].includes(r.role)))
   return NextResponse.json({success:false,error:'Browser-saved athlete sync requires a database-verified system administrator.'},{status:403});
  const body=await request.json();const member=body.member;
  if(!member || typeof member.id!=='string' || !/^Scms-[A-Za-z0-9-]{1,140}$/.test(member.id) ||
    typeof member.clubId!=='string' || !/^Scms-CLUB-[A-Za-z0-9-]{1,100}$/.test(member.clubId) ||
    typeof member.branchId!=='string' || !member.branchId || member.branchId.length>150)
   return NextResponse.json({success:false,error:'Save a club, branch and athlete before syncing.'},{status:422});
  const revision=member.universalSync?.revision;
  if(revision!=null && (!Number.isSafeInteger(revision)||revision<1))return NextResponse.json({success:false},{status:422});
  let result=await exchangeAthleteProfile(member,member.universalSync?.profile,revision ?? null);
  if(body.resolution) {
    if(result.status!=='CONFLICT' || result.revision!==body.resolution.revision)return NextResponse.json({success:false,status:'CONFLICT_CHANGED'},{status:409});
    if(body.resolution.choice==='remote')result={...result,success:true,status:'SYNCED'};
    else if(body.resolution.choice==='local')result=await exchangeAthleteProfile(member,null,result.revision);
    else return NextResponse.json({success:false},{status:422});
  }
  return NextResponse.json(result,{status:result.success?200:409});
 }catch {return NextResponse.json({success:false,error:'Profile sync is unavailable; saved local data is retained.'},{status:503});}
}
