export type Assignment = {
  role: string;
  club_id: string | null;
  branch_id: string | null;
  granted_at?: string;
};
export const roleOrder = [
  "SUPERADMIN",
  "SYSTEM_ADMIN",
  "CLUB_ADMIN",
  "CLUB_CO_ADMIN",
  "BRANCH_MANAGER",
  "BRANCH_CO_ADMIN",
  "FINANCE",
  "REGISTRATION_OFFICER",
  "COACH",
  "ASSISTANT_COACH",
  "STAFF",
  "PARENT",
  "ATHLETE",
  "MEMBER",
  "VOLUNTEER",
  "OBSERVER",
];
export function sortAssignments(roles: Assignment[]) {
  return [...roles].sort(
    (a, b) =>
      (roleOrder.indexOf(a.role) < 0 ? 999 : roleOrder.indexOf(a.role)) -
        (roleOrder.indexOf(b.role) < 0 ? 999 : roleOrder.indexOf(b.role)) ||
      (a.club_id || "").localeCompare(b.club_id || "") ||
      (a.branch_id || "").localeCompare(b.branch_id || ""),
  );
}
export function canManage(
  roles: Assignment[],
  clubId: string,
  branchId?: string | null,
  finance = false,
) {
  return roles.some(
    (r) =>
      ["SUPERADMIN", "SYSTEM_ADMIN"].includes(r.role) ||
      (r.club_id === clubId &&
        (["CLUB_ADMIN", "CLUB_CO_ADMIN"].includes(r.role) ||
          (!!branchId &&
            r.branch_id === branchId &&
            [
              "BRANCH_MANAGER",
              "BRANCH_CO_ADMIN",
              ...(finance ? ["FINANCE"] : []),
            ].includes(r.role)) ||
          (finance && r.role === "FINANCE" && !r.branch_id))),
  );
}
export function routeForRole(role: string) {
  const routes: Record<string, string> = {
    SUPERADMIN: "superadmin",
    SYSTEM_ADMIN: "admin",
    CLUB_ADMIN: "club",
    CLUB_CO_ADMIN: "club",
    BRANCH_MANAGER: "branch",
    BRANCH_CO_ADMIN: "branch",
    FINANCE: "staff",
    REGISTRATION_OFFICER: "staff",
    STAFF: "staff",
    COACH: "trainer",
    ASSISTANT_COACH: "trainer",
    VOLUNTEER: "volunteer",
    OBSERVER: "observer",
    PARENT: "member",
    MEMBER: "member",
    ATHLETE: "member",
  };
  return routes[role] ? `/dashboard/${routes[role]}` : "/pending-approval";
}
export function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}
export function identityConflicts(
  scms: { participant_name: string; date_of_birth: string | null },
  remote: Record<string, unknown>,
) {
  const conflicts = [];
  const name = remote.participant_name ?? remote.full_name ?? remote.name;
  const dob = Object.prototype.hasOwnProperty.call(remote, "date_of_birth")
    ? remote.date_of_birth
    : remote.dob;
  if (
    typeof name === "string" &&
    normalizeName(name) !== normalizeName(scms.participant_name)
  )
    conflicts.push({
      fieldName: "participant_name",
      scmsValue: scms.participant_name,
      karateTechValue: name,
    });
  if (
    (typeof dob === "string" ? dob.slice(0, 10) : null) !== scms.date_of_birth
  )
    conflicts.push({
      fieldName: "date_of_birth",
      scmsValue: scms.date_of_birth,
      karateTechValue: dob,
    });
  return conflicts;
}
export function toSen(value: unknown) {
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n <= 0 ||
    Math.abs(n * 100 - Math.round(n * 100)) > 1e-6
  )
    throw Error("Enter a positive amount with at most two decimal places");
  const sen = Math.round(n * 100);
  if (!Number.isSafeInteger(sen) || sen > 100000000)
    throw Error("Amount exceeds the supported limit");
  return sen;
}
