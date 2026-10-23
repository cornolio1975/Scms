import WorkspaceView from "@/components/Workspace/WorkspaceView";
import { session } from "@/lib/scms/server";
import { routeForRole } from "@/lib/scms/access";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function DashboardRolePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  let s;
  try {
    s = await session(true);
  } catch {
    redirect("/login");
  }
  if (s.profile.status === "PENDING") redirect("/pending-approval");
  if (s.profile.status !== "ACTIVE") redirect("/account-suspended");
  const { role } = await params;
  const allowed = s.roles.some(
    (r) => routeForRole(r.role) === `/dashboard/${role}`,
  );
  if (!allowed) redirect(routeForRole(s.roles[0]?.role || ""));
  return <WorkspaceView serverRole={s.roles[0]?.role} />;
}
