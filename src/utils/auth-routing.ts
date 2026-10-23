import { session } from "@/lib/scms/server";
import { routeForRole } from "@/lib/scms/access";
import { redirect } from "next/navigation";
export async function getDashboardRouteForUser() {
  try {
    const s = await session(true);
    if (s.profile.status === "PENDING") return "/pending-approval";
    if (s.profile.status !== "ACTIVE") return "/account-suspended";
    return routeForRole(s.roles[0]?.role || "");
  } catch {
    return "/login";
  }
}
export async function checkAuthAndRoute() {
  redirect(await getDashboardRouteForUser());
}
