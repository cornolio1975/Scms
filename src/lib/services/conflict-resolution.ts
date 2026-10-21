import { createClient } from '@/utils/supabase/server';
import { KarateTechSyncService, KarateTechParticipantPayload } from '@/lib/integrations/karatetech-sync';
import { ParticipantLifecycleService } from './participant-lifecycle';

export class ConflictResolutionService {
  
  /**
   * Resolves a 3-way synchronization conflict between SCMS and KarateTech.
   */
  static async resolveConflict(
    conflictId: string, 
    resolutionType: 'USE_SCMS' | 'USE_KARATETECH' | 'CORRECTED',
    userId: string,
    correctedValue?: any
  ): Promise<{ success: boolean; error?: string }> {
    
    const supabase = await createClient();

    // 1. Fetch Conflict Request (using approval_requests table)
    const { data: conflict, error: fetchError } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', conflictId)
      .eq('request_type', 'KARATETECH_RECONCILIATION')
      .eq('status', 'PENDING_APPROVAL')
      .single();

    if (fetchError || !conflict) {
      return { success: false, error: 'Conflict not found, already resolved, or unauthorized (RLS)' };
    }

    // 2. Concurrency/Stale Protection
    // Re-verify that the SCMS database hasn't changed since the conflict was generated
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('updated_at')
      .eq('id', conflict.user_id)
      .single();

    if (currentProfile && JSON.stringify(currentProfile.updated_at) !== JSON.stringify(conflict.previous_data?.scms_updated_at)) {
       // Stale conflict! SCMS changed after conflict was opened
       return { success: false, error: 'STALE_CONFLICT: Participant profile was modified since this conflict was detected. Please re-run sync.' };
    }

    // 3. Determine Final Value
    let finalValue = null;
    const conflictField = conflict.requested_data?.conflict_field; // e.g. "full_name"

    if (resolutionType === 'USE_SCMS') {
      finalValue = conflict.requested_data?.scms_value;
    } else if (resolutionType === 'USE_KARATETECH') {
      finalValue = conflict.requested_data?.karatetech_value;
    } else if (resolutionType === 'CORRECTED') {
      if (!correctedValue) return { success: false, error: 'Corrected value is required.' };
      finalValue = correctedValue;
    }

    // 4. Transactional Application
    if (resolutionType === 'USE_KARATETECH' || resolutionType === 'CORRECTED') {
       // Update SCMS to match the resolved value
       const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ [conflictField]: finalValue })
          .eq('id', conflict.user_id);
          
       if (profileUpdateError) return { success: false, error: 'Failed to update SCMS profile: ' + profileUpdateError.message };
    }

    // 5. Audit Log & Close Conflict
    await supabase.from('audit_logs').insert({
      actor_id: userId,
      target_user_id: conflict.user_id,
      club_id: conflict.club_id,
      branch_id: conflict.branch_id,
      action: 'CONFLICT_RESOLVED',
      details: {
        field: conflictField,
        resolution: resolutionType,
        final_value: finalValue,
        last_synced: conflict.requested_data?.last_synced_value
      }
    });

    await supabase.from('approval_requests').update({
      status: 'APPROVED',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString()
    }).eq('id', conflictId);

    // 6. Reset KarateTech Sync Mapping
    await supabase.from('scms_karatetech_participant_links')
      .update({ conflict_status: 'NONE', sync_status: 'PENDING' })
      .eq('scms_member_id', conflict.user_id);

    // 7. Enqueue Sync (Only if SCMS won or CORRECTED was used, since KarateTech needs the update)
    if (resolutionType === 'USE_SCMS' || resolutionType === 'CORRECTED') {
       const { data: role } = await supabase.from('user_roles').select('id').eq('user_id', conflict.user_id).eq('club_id', conflict.club_id).single();
       if (role) {
         await ParticipantLifecycleService.transitionState(supabase, role.id, 'SYNC_PENDING', userId, 'Conflict Resolved (Local Win)');
         // The sync worker will pick this up automatically, or we can force sync here:
         // KarateTechSyncService.executeSync(...)
       }
    } else {
       // KarateTech won, meaning both are now in sync!
       const { data: role } = await supabase.from('user_roles').select('id').eq('user_id', conflict.user_id).eq('club_id', conflict.club_id).single();
       if (role) {
         await ParticipantLifecycleService.transitionState(supabase, role.id, 'SYNCED', userId, 'Conflict Resolved (Remote Win)');
         await supabase.from('scms_karatetech_participant_links')
           .update({ sync_status: 'SYNCED', last_successful_sync_at: new Date().toISOString() })
           .eq('scms_member_id', conflict.user_id);
       }
    }

    return { success: true };
  }
}
