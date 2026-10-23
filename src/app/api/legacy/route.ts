import { session, HttpError, responseError } from "@/lib/scms/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { db, roles } = await session();
    if (!roles.some((r) => ["SUPERADMIN", "SYSTEM_ADMIN"].includes(r.role)))
      throw new HttpError(403, "Platform administrator required");
    const { data, error } = await db
      .from("cms_state")
      .select("id,data,updated_at");
    if (error) throw error;
    return Response.json(
      {
        records: data,
        notice:
          "Read-only legacy archive. Review unsupported invoices before importing; no legacy records were deleted.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return responseError(e);
  }
}
