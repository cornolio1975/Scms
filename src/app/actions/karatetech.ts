'use server';

import { KarateTechApiClient, KarateTechSyncService, KarateTechParticipantPayload } from '@/lib/integrations/karatetech-sync';

export async function testKarateTechConnection() {
  try {
    const isHealthy = await KarateTechApiClient.checkHealth();
    return { success: true, isHealthy };
  } catch (error: any) {
    return { success: false, error: error.message || 'Connection failed' };
  }
}

export async function syncSingleParticipantAction(participant: KarateTechParticipantPayload, userId: string) {
  try {
    const result = await KarateTechSyncService.executeSync(participant, userId);
    return result;
  } catch (error: any) {
    return { success: false, error: error.message || 'Sync failed' };
  }
}

export async function bulkSyncParticipants(clubId: string, participants: KarateTechParticipantPayload[], userId: string) {
  try {
    const result = await KarateTechSyncService.executeBulkSync(clubId, participants, userId);
    return result;
  } catch (error: any) {
    return { success: false, error: error.message || 'Sync failed' };
  }
}
