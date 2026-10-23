import { responseError } from "@/lib/scms/server";
import { KarateTechSyncService } from "@/lib/integrations/karatetech-sync";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ participantId: string }> },
) {
  try {
    const { participantId } = await params;
    return Response.json(
      {
        success: true,
        data: await KarateTechSyncService.prepareSync(participantId),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return responseError(e);
  }
}
