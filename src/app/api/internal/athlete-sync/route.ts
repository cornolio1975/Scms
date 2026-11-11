import { createHash,timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncSavedAthlete } from '@/lib/integrations/universal-athlete-sync';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request: Request) {
 const secret=process.env.ATHLETE_SYNC_CRON_SECRET?.trim();
 const supplied=request.headers.get('authorization')?.replace(/^Bearer /i,'') || '';
 const hash=(s:string)=>createHash('sha256').update(s).digest();
 if (!secret || !supplied || !timingSafeEqual(hash(secret),hash(supplied))) return NextResponse.json({success:false},{status:401});
 try {
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
  const {data:states,error:stateError}=await db.from('athlete_sync_state').select('source_id,updated_at').order('updated_at',{ascending:true}).limit(10);
  if (stateError) throw stateError;
  let synced=0,conflicts=0,failed=0;
  const rows=states || [];
  for(let start=0;start<rows.length;start+=5) {
    await Promise.all(rows.slice(start,start+5).map(async state=>{
      const {data:member,error}=await db.from('members').select('*').eq('id',state.source_id).single();
      if(error || !member) {failed++;return;}
      try {const result=await syncSavedAthlete(db,member);if(result.success)synced++;else if(result.status==='CONFLICT')conflicts++;else failed++;}
      catch {failed++;await db.from('athlete_sync_state').update({status:'RETRY',updated_at:new Date().toISOString()}).eq('source_id',member.id);}
    }));
  }
  return NextResponse.json({success:failed===0,synced,conflicts,failed});
 } catch {return NextResponse.json({success:false,error:'Athlete sync is unavailable.'},{status:503});}
}
