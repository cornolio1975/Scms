import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ParticipantLifecycleService } from '@/lib/services/participant-lifecycle';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = authData.user.id;

    const body = await request.json();
    const { action, id } = body;

    if (action === 'APPROVE_CHANGE') {
      const result = await ParticipantLifecycleService.approveParticipantChange(id, userId);
      return NextResponse.json(result);
    }
    
    if (action === 'RESOLVE_CONFLICT') {
      const { resolutionType, correctedValue } = body;
      const { ConflictResolutionService } = await import('@/lib/services/conflict-resolution');
      const result = await ConflictResolutionService.resolveConflict(id, resolutionType, userId, correctedValue);
      return NextResponse.json(result);
    }
    
    // Fallback for direct state transitions if needed
    if (action === 'TRANSITION_STATE') {
       // Requires careful authorization checking inside the service
       const { roleId, newState, reason } = body;
       const result = await ParticipantLifecycleService.transitionState(supabase, roleId, newState, userId, reason);
       return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
