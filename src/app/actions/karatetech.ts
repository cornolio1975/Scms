"use server";
import { session, HttpError } from "@/lib/scms/server";
import {
  KarateTechApiClient,
  KarateTechSyncService,
  type KarateTechParticipantPayload,
} from "@/lib/integrations/karatetech-sync";
export async function testKarateTechConnection() {
  const s = await session();
  if (
    !s.roles.some((r) =>
      [
        "SUPERADMIN",
        "SYSTEM_ADMIN",
        "CLUB_ADMIN",
        "CLUB_CO_ADMIN",
        "BRANCH_MANAGER",
        "OBSERVER",
      ].includes(r.role),
    )
  )
    throw new HttpError(403, "Integration access denied");
  const isHealthy = await KarateTechApiClient.checkHealth();
  return { success: isHealthy, isHealthy };
}
export async function bulkSyncParticipants(
  clubId: string,
  participants: KarateTechParticipantPayload[],
  _userId?: string,
) {
  return KarateTechSyncService.executeBulkSync(clubId, participants);
}
