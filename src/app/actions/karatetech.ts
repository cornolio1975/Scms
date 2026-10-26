'use server';
import { KarateTechApiClient, KarateTechParticipantPayload } from '@/lib/integrations/karatetech-sync';
import { syncContext, sourceMembers, sourcePayload } from '@/lib/integrations/scms-source';
import { KarateTechSyncService } from '@/lib/integrations/karatetech-sync';
import { createClient } from '@/utils/supabase/server';

export async function testKarateTechConnection() {
  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (!user) return { success: false, error: 'Sign in to test the integration.' };
    const isHealthy = await KarateTechApiClient.checkHealth();
    return { success: isHealthy, isHealthy, error: isHealthy ? undefined : 'KarateTech receiver is unavailable or its integration credentials are not accepted.' };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Connection failed.' }; }
}

export async function syncSingleParticipantAction(participant: KarateTechParticipantPayload, _userId?: string) {
  try {
    const context = await syncContext(participant.scms_club_id || participant.club_id || '');
    const profile = (await sourceMembers(context)).find(p => p.id === participant.scms_participant_id);
    if (!profile) return { success: false, error: 'Athlete not found in your club or branch.' };
    return await KarateTechSyncService.executeSync(sourcePayload(profile, context, participant as unknown as Record<string, unknown>), context.user.id, context.db);
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Transfer failed.' }; }
}

export async function bulkSyncParticipants(clubId: string, participants: KarateTechParticipantPayload[], _userId?: string) {
  try {
    if (!participants.length || participants.length > 100) return { success: false, error: 'Select between 1 and 100 athletes.' };
    const context = await syncContext(clubId);
    const profiles = await sourceMembers(context);
    const payloads = participants.map(p => {
      const profile = profiles.find(m => m.id === p.scms_participant_id);
      if (!profile) throw new Error('Athlete not found in your club or branch.');
      return sourcePayload(profile, context, p as unknown as Record<string, unknown>);
    });
    return await KarateTechSyncService.executeBulkSync(clubId, payloads, context.user.id, context.db);
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Transfer failed.' }; }
}
