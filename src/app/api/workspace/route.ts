import { session, body, command, responseError } from "@/lib/scms/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { db, profile, roles } = await session(true);
    const names = [
      "clubs",
      "club_branches",
      "members",
      "member_roles",
      "guardian_relationships",
      "volunteer_profiles",
      "approval_requests",
      "scms_records",
      "scms_karatetech_participant_links",
      "sync_history",
      "audit_logs",
      "scms_payment_attempts",
    ] as const;
    const results = await Promise.all(
      names.map((n) => {
        let q = db.from(n).select("*");
        if (["audit_logs", "sync_history"].includes(n))
          q = q.order(n === "audit_logs" ? "created_at" : "start_time", {
            ascending: false,
          });
        return q.limit(1000);
      }),
    );
    const state: Record<string, unknown> = { user: { ...profile }, roles };
    for (let i = 0; i < names.length; i++) {
      if (results[i].error)
        throw Error("Workspace migration is required or a query failed");
      state[names[i]] = results[i].data || [];
    }
    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return responseError(e);
  }
}
export async function POST(req: Request) {
  try {
    const input = await body(req);
    if (
      typeof input.action !== "string" ||
      !input.data ||
      typeof input.data !== "object"
    )
      return Response.json(
        { error: "Operation and data required" },
        { status: 400 },
      );
    return Response.json(
      { ok: true, result: await command(input.action, input.data) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return responseError(e);
  }
}
