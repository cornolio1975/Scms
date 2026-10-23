import { createClient } from "@/utils/supabase/server";
import { sortAssignments, type Assignment } from "./access";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function session(allowPending = false) {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new HttpError(401, "Sign in required");
  const { data: profile, error: pe } = await db
    .from("profiles")
    .select("id,status,full_name,email")
    .eq("id", user.id)
    .single();
  if (pe || !profile) throw new HttpError(403, "Profile unavailable");
  if (
    ["INACTIVE", "SUSPENDED"].includes(profile.status) ||
    (!allowPending && profile.status !== "ACTIVE")
  )
    throw new HttpError(403, "Account approval is required");
  const { data: roles, error: re } = await db
    .from("user_roles")
    .select("role,club_id,branch_id,granted_at")
    .eq("user_id", user.id);
  if (re) throw new HttpError(503, "Unable to verify role assignments");
  return {
    db,
    user,
    profile,
    roles: sortAssignments((roles || []) as Assignment[]),
  };
}
export function responseError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : "Unable to complete this operation. Refresh and retry.",
    },
    {
      status: error instanceof HttpError ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function body(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new HttpError(403, "Cross-origin request rejected");
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "JSON required");
  const text = await req.text();
  if (text.length > 128000) throw new HttpError(413, "Request too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
export async function command(action: string, data: unknown) {
  const { db } = await session(action === "club-register");
  const result = await db.rpc("scms_command", {
    p_action: action,
    p_data: data,
  });
  if (result.error) {
    const code = result.error.code;
    throw new HttpError(
      code === "42501" ? 403 : code === "23505" || code === "40001" ? 409 : 400,
      result.error.message,
    );
  }
  return result.data;
}
