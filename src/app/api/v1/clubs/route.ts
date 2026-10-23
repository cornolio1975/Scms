import { session, body, command, responseError } from "@/lib/scms/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { db } = await session();
    const { data, error } = await db
      .from("clubs")
      .select("id,name,display_name,sport,status");
    if (error) throw error;
    return Response.json(
      { success: true, data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return responseError(e);
  }
}
export async function POST(req: Request) {
  try {
    const d = await body(req);
    return Response.json(
      { success: true, data: await command("club-register", d) },
      { status: 201 },
    );
  } catch (e) {
    return responseError(e);
  }
}
