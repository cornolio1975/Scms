import { authorizeUser } from "../util";
import { KarateTechApiClient } from "@/lib/integrations/karatetech-sync";
export async function GET(req: Request) {
  const auth = await authorizeUser(req);
  if (auth.error) return auth.error;
  const isHealthy = await KarateTechApiClient.checkHealth();
  return Response.json(
    { success: isHealthy, isHealthy, checkedAt: new Date().toISOString() },
    { status: isHealthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
