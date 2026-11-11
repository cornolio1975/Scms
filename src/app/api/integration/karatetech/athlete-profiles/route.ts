import { NextResponse } from 'next/server';
import { syncContext, sourceMembers, IntegrationError } from '@/lib/integrations/scms-source';
import { syncSavedAthlete } from '@/lib/integrations/universal-athlete-sync';
export const dynamic='force-dynamic';
export async function POST(request: Request) {
 try {
  const body=await request.json();
  const context=await syncContext(body.clubId || '');
  const members=(await sourceMembers(context)).filter(m=>m.club_id===context.club.id && m.member_no);
  const selected=body.memberId ? members.filter(m=>m.id===body.memberId) : members;
  if (body.memberId && !selected.length) throw new IntegrationError('Athlete is outside your authorized branch.',404);
  const results=[];
  for (const member of selected.slice(0,100)) {
    try { results.push({source_id:member.id,...await syncSavedAthlete(context.db,member,body.resolution)}); }
    catch { results.push({source_id:member.id,success:false,status:'RETRY'}); }
  }
  return NextResponse.json({success:results.every(r=>r.success),results,remaining:Math.max(0,selected.length-100)});
 } catch(error) {
  return NextResponse.json({success:false,error:error instanceof Error?error.message:'Sync failed.'},
   {status:error instanceof IntegrationError?error.status:503});
 }
}
