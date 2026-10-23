import { session } from "@/lib/scms/server";
import { canManage } from "@/lib/scms/access";
import { NextResponse } from "next/server";
export async function authorizeUser(_request?: Request) {
  try {
    const s = await session();
    const role = s.roles[0]?.role || "MEMBER";
    const isAdmin = s.roles.some((r) =>
      ["SUPERADMIN", "SYSTEM_ADMIN"].includes(r.role),
    );
    const isClubManager = s.roles.some((r) =>
      [
        "CLUB_ADMIN",
        "CLUB_CO_ADMIN",
        "BRANCH_MANAGER",
        "BRANCH_CO_ADMIN",
      ].includes(r.role),
    );
    const isObserver = s.roles.some((r) => r.role === "OBSERVER");
    if (!isAdmin && !isClubManager && !isObserver)
      return {
        error: NextResponse.json({ error: "Not authorized" }, { status: 403 }),
      };
    return {
      ...s,
      role,
      isAdmin,
      isClubManager,
      isObserver,
      canManage: (club: string, branch?: string | null) =>
        canManage(s.roles, club, branch),
    };
  } catch (e) {
    return {
      error: NextResponse.json(
        { error: e instanceof Error ? e.message : "Unauthorized" },
        { status: 401 },
      ),
    };
  }
}
