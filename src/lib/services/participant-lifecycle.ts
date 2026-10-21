import { createClient } from '@/utils/supabase/server';
import { KarateTechParticipantPayload, KarateTechSyncService } from '@/lib/integrations/karatetech-sync';

export type LifecycleState = 
  | 'REGISTERED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SYNC_PENDING'
  | 'SYNCING'
  | 'SYNCED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'CONFLICT'
  | 'SYNC_FAILED'
  | 'INACTIVE'
  | 'ARCHIVED';

export class ParticipantLifecycleService {
  
  static readonly VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
    'REGISTERED': ['PENDING_APPROVAL'],
    'PENDING_APPROVAL': ['APPROVED', 'REJECTED'],
    'APPROVED': ['SYNC_PENDING', 'ACTIVE'], // If no KT sync needed, go to ACTIVE
    'SYNC_PENDING': ['SYNCING'],
    'SYNCING': ['SYNCED', 'SYNC_FAILED', 'CONFLICT'],
    'SYNCED': ['ACTIVE'],
    'ACTIVE': ['INACTIVE', 'ARCHIVED', 'PENDING_APPROVAL'], // Re-approval for major changes
    'REJECTED': ['PENDING_APPROVAL'],
    'CONFLICT': ['SYNC_PENDING'], // Manual resolution resets sync
    'SYNC_FAILED': ['SYNC_PENDING'],
    'INACTIVE': ['ACTIVE', 'ARCHIVED'],
    'ARCHIVED': []
  };

  /**
   * Safe status transition engine enforcing state machine rules
   */
  static async transitionState(
    supabase: any,
    roleId: string, 
    newState: LifecycleState, 
    userId: string, 
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    
    // 1. Fetch current state safely
    const { data: role, error: roleError } = await supabase
      .from('user_roles')
      .select('participant_status, club_id, branch_id, user_id')
      .eq('id', roleId)
      .single();

    if (roleError || !role) {
      return { success: false, error: 'Unauthorized or Role not found' };
    }

    const currentState = role.participant_status as LifecycleState;

    // 2. Validate Transition
    if (!this.VALID_TRANSITIONS[currentState]?.includes(newState)) {
      return { success: false, error: `Invalid transition from ${currentState} to ${newState}` };
    }

    // 3. Concurrency Protection & Update (Optimistic Locking via current state)
    const { error: updateError } = await supabase
      .from('user_roles')
      .update({ participant_status: newState })
      .eq('id', roleId)
      .eq('participant_status', currentState); // Prevents dirty writes

    if (updateError) {
      return { success: false, error: 'Concurrency conflict or Unauthorized' };
    }

    // 4. Audit Trail
    await supabase.from('audit_logs').insert({
      actor_id: userId,
      target_user_id: role.user_id,
      club_id: role.club_id,
      branch_id: role.branch_id,
      action: 'LIFECYCLE_TRANSITION',
      details: { old_status: currentState, new_status: newState, reason }
    });

    return { success: true };
  }

  /**
   * Processes a PARTICIPANT_CHANGE approval request
   */
  static async approveParticipantChange(
    approvalId: string, 
    userId: string
  ) {
    const supabase = await createClient();

    // 1. Fetch Request
    const { data: req, error } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', approvalId)
      .eq('status', 'PENDING_APPROVAL')
      .single();

    if (error || !req) return { success: false, error: 'Request not found or already processed' };

    // 2. Prevent Stale Overwrites
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user_id)
      .single();

    // Deep check if currentProfile matches previous_data (omitted for brevity, assume simple hash match)
    if (JSON.stringify(currentProfile.updated_at) !== JSON.stringify(req.previous_data.updated_at)) {
      await supabase.from('approval_requests').update({ status: 'REJECTED', reviewed_by: userId }).eq('id', approvalId);
      return { success: false, error: 'STALE_DATA: Profile was updated after this request was made.' };
    }

    // 3. Apply Changes (Transactional-like via RLS)
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update(req.requested_data)
      .eq('id', req.user_id);

    if (profileUpdateError) return { success: false, error: 'Failed to apply changes due to RLS' };

    // 4. Mark Approved
    await supabase.from('approval_requests').update({
      status: 'APPROVED',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString()
    }).eq('id', approvalId);

    // 5. Trigger KarateTech Sync if necessary
    const syncFields = ['full_name', 'date_of_birth'];
    const needsSync = syncFields.some(field => req.requested_data[field] !== req.previous_data[field]);

    if (needsSync) {
      // Transition to SYNC_PENDING
      const { data: role } = await supabase.from('user_roles').select('id').eq('user_id', req.user_id).eq('club_id', req.club_id).single();
      if (role) {
        await this.transitionState(supabase, role.id, 'SYNC_PENDING', userId, 'Participant fields changed');
        
        // Push to Sync Jobs
        const payload = {
          scms_participant_id: req.user_id,
          scms_club_id: req.club_id,
          club_name: 'SCMS',
          full_name: req.requested_data.full_name,
          gender: currentProfile.gender === 'Female' ? 'Female' : 'Male',
          dob: req.requested_data.date_of_birth || '2000-01-01',
          email: currentProfile.email,
          phone: currentProfile.phone
        };
        await KarateTechSyncService.executeSync(payload, userId);
      }
    }

    return { success: true };
  }
}
