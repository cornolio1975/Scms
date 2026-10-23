import { body, HttpError, responseError } from "@/lib/scms/server";
import {
  participantPayload,
  KarateTechSyncService,
} from "@/lib/integrations/karatetech-sync";
export async function POST(req: Request) {
  try {
    const { memberId } = await body(req);
    if (typeof memberId !== "string")
      throw new HttpError(400, "Participant ID required");
    const { payload } = await participantPayload(memberId, true);
    const r = await KarateTechSyncService.executeSync(payload);
    return Response.json(r, { status: r.success ? 200 : 409 });
  } catch (e) {
    return responseError(e);
  }
}
