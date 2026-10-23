"use client";
import {
  useEffect,
  useState,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { canManage, toSen, type Assignment } from "@/lib/scms/access";
import type { Workspace, Row, OpRecord } from "@/lib/scms/workspace-types";
const money = (sen: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    sen / 100,
  );
const date = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-MY", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kuala_Lumpur",
      }).format(new Date(value))
    : "—";
const input =
  "w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm";
const button =
  "rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const Label = ({ title, children }: { title: string; children: ReactNode }) => (
  <label className="block space-y-1 text-sm font-medium">
    <span>{title}</span>
    {children}
  </label>
);
const todayMY = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(
    new Date(),
  );
export default function OperationalWorkspace({
  initialTab = "Overview",
}: {
  initialTab?: string;
}) {
  const [w, setW] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [club, setClub] = useState(""),
    [branch, setBranch] = useState(""),
    [tab, setTab] = useState(initialTab),
    [search, setSearch] = useState(""),
    [approvalTab, setApprovalTab] = useState("Pending Members");
  const [form, setForm] = useState(""),
    [member, setMember] = useState<Row | null>(null),
    [invoice, setInvoice] = useState<OpRecord | null>(null),
    [syncPreview, setSyncPreview] = useState<any>(null),
    [receipt, setReceipt] = useState<OpRecord | null>(null);
  const saving = useRef(false);
  useEffect(() => {
    if (!form && !receipt) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const items = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ) || [],
      );
    items()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setForm("");
        setReceipt(null);
        setInvoice(null);
      }
      if (e.key === "Tab") {
        const list = items(),
          first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [form, receipt, busy]);
  async function load() {
    const r = await fetch("/api/workspace", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Workspace could not be loaded");
    setW(d);
    setClub((c) =>
      d.clubs.some((x: Row) => x.id === c) ? c : d.clubs[0]?.id || "",
    );
    setLoading(false);
    return d as Workspace;
  }
  useEffect(() => {
    let active = true;
    load().catch((e) => {
      if (active) {
        setError(e.message);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  async function run(action: string, data: any) {
    if (saving.current) return null;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Unable to save");
      await load();
      setForm("");
      setInvoice(null);
      setNotice(
        typeof d.result?.generated === "number"
          ? `${d.result.generated} new fee invoices generated. Existing invoices were kept.`
          : "Saved successfully",
      );
      return d.result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }
  const roles = w?.roles || [];
  const platform = roles.some((r) =>
    ["SUPERADMIN", "SYSTEM_ADMIN"].includes(r.role),
  );
  const managing = canManage(roles, club, branch || null);
  const financing = canManage(roles, club, branch || null, true);
  const training =
    managing ||
    roles.some(
      (r) =>
        ["COACH", "ASSISTANT_COACH"].includes(r.role) &&
        r.club_id === club &&
        (!r.branch_id || r.branch_id === branch),
    );
  const allObserver =
    roles.length > 0 && roles.every((r) => r.role === "OBSERVER");
  const branches = w?.club_branches.filter((b) => b.club_id === club) || [];
  const members =
    w?.members.filter(
      (m) => m.club_id === club && (!branch || m.branch_id === branch),
    ) || [];
  const legacyApprovals: OpRecord[] = (w?.approval_requests || []).map((r) => ({
    id: r.id,
    kind: "approval",
    club_id: r.club_id,
    branch_id: r.branch_id,
    member_id: null,
    version: 1,
    created_at: r.created_at,
    updated_at: r.updated_at,
    legacy: true,
    data: {
      title: r.requested_role
        ? `Role request: ${r.requested_role}`
        : "Archived approval request",
      type:
        r.request_type === "ROLE_ASSIGNMENT"
          ? "Pending Member"
          : r.request_type === "PARTICIPANT_CHANGE"
            ? "Participant Change"
            : "KarateTech Reconciliation",
      status:
        r.status === "PENDING_APPROVAL"
          ? "Pending"
          : r.status === "APPROVED"
            ? "Approved"
            : "Rejected",
      requested: r.requested_data,
    },
  }));
  const records: OpRecord[] = [
    ...(w?.scms_records || []),
    ...legacyApprovals,
  ].filter(
    (r) =>
      r.club_id === club && (!branch || !r.branch_id || r.branch_id === branch),
  );
  const byKind = (k: string) => records.filter((r) => r.kind === k);
  const visibleMembers = members.filter((m) =>
    `${m.full_name} ${m.member_no || ""} ${m.email || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const invoices = byKind("invoice");
  const outstanding = invoices.reduce(
    (n, i) => n + i.data.amountSen - i.data.paidSen,
    0,
  );
  const paid = byKind("receipt").reduce((n, r) => n + r.data.amountSen, 0);
  const mName = (id: string) =>
    w?.members.find((m) => m.id === id)?.full_name || "Member";
  const cName =
    w?.clubs.find((c) => c.id === club)?.display_name ||
    w?.clubs.find((c) => c.id === club)?.name ||
    "Your club";
  async function sync(m: Row, send = false) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/integration/karatetech/participants${send ? "" : `/${m.id}`}`,
        send
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ memberId: m.id }),
            }
          : { cache: "no-store" },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error || d.message || "Sync failed");
      setSyncPreview(send ? null : { member: m, ...d.data });
      setNotice(send ? "Participant sync completed" : "");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function health() {
    setBusy(true);
    setNotice("");
    try {
      const r = await fetch("/api/integration/karatetech/health", {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok || !d.isHealthy)
        throw Error(d.error || d.message || "KarateTech is not responding");
      setNotice(
        "KarateTech connection verified at " + date(new Date().toISOString()),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function checkout(i: OpRecord) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: i.id }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Online checkout is unavailable");
      window.location.assign(d.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  function exportRows() {
    const rows = [
      [
        "Invoice",
        "Member",
        "Due date",
        "Amount MYR",
        "Paid MYR",
        "Balance MYR",
        "Status",
      ],
      ...invoices.map((i) => [
        i.data.number,
        mName(i.member_id || ""),
        i.data.dueDate,
        (i.data.amountSen / 100).toFixed(2),
        (i.data.paidSen / 100).toFixed(2),
        ((i.data.amountSen - i.data.paidSen) / 100).toFixed(2),
        i.data.status,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v ?? "")
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = u;
    a.download = "scms-fee-reconciliation.csv";
    a.click();
    URL.revokeObjectURL(u);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const v = (name: string) => String(f.get(name) || "").trim();
    try {
      let action = "",
        data: any = { clubId: club, branchId: branch || null };
      if (form === "member") {
        action = "member-create";
        data = {
          ...data,
          branchId: v("branchId"),
          fullName: v("fullName"),
          gender: v("gender"),
          dob: v("dob"),
          icPassport: v("icPassport"),
          email: v("email"),
          phone: v("phone"),
          isAthlete: f.has("isAthlete"),
          isVolunteer: f.has("isVolunteer"),
          beltRank: v("beltRank"),
          weightKg: v("weightKg") ? Number(v("weightKg")) : null,
          heightCm: v("heightCm") ? Number(v("heightCm")) : null,
          nationalityCode:v("nationalityCode"),emergencyName:v("emergencyName"),emergencyPhone:v("emergencyPhone"),
        };
      }
      if(form === "athlete-details") {action="athlete-details-save";data={memberId:member?.id,icPassport:v("icPassport"),nationalityCode:v("nationalityCode"),weightKg:v("weightKg")?Number(v("weightKg")):null,heightCm:v("heightCm")?Number(v("heightCm")):null,beltRank:v("beltRank"),emergencyName:v("emergencyName"),emergencyPhone:v("emergencyPhone")};}
      if (form === "login") {
        action = "member-link-login";
        data = { memberId: member?.id, email: v("email") };
      }
      if (form === "guardian") {
        action = "guardian-save";
        data = {
          memberId: member?.id,
          name: v("name"),
          relationship: v("relationship"),
          phone: v("phone"),
          email: v("email"),
          profileId: v("profileId"),
        };
      }
      if (form === "change") {
        action = "member-change";
        data = { memberId: member?.id, fullName: v("fullName"), dob: v("dob") };
      }
      if (form === "branch") {
        action = "branch-create";
        data = {
          ...data,
          name: v("name"),
          venue: v("venue"),
          address: v("address"),
        };
      }
      if (form === "club") {
        action = "club-register";
        data = {
          name: v("name"),
          displayName: v("displayName"),
          sport: v("sport"),
        };
      }
      if (form === "invoice") {
        action = "invoice-create";
        data = {
          ...data,
          memberId: v("memberId"),
          title: v("title"),
          amountSen: toSen(v("amount")),
          dueDate: v("dueDate"),
        };
      }
      if (form === "transfer") {
        action = "transfer-submit";
        data = {
          invoiceId: invoice?.id,
          amountSen: toSen(v("amount")),
          reference: v("reference"),
          notes: v("notes"),
        };
      }
      if (form === "bank") {
        action = "bank-save";
        data = {
          clubId: club,
          branchId: v("scope") || null,
          bankName: v("bankName"),
          accountName: v("accountName"),
          accountNumber: v("accountNumber"),
          instructions: v("instructions"),
        };
      }
      if (["task", "session", "event"].includes(form)) {
        action = "record-create";
        data = {
          ...data,
          kind: form,
          memberId: v("memberId") || null,
          data: {
            title: v("title"),
            date: v("date"),
            dueDate: v("date"),
            expiresOn: v("expiresOn"),
            priority: v("priority") || "Normal",
          },
        };
      }
      if (form === "plan") {
        action = "plan-create";
        data = {
          ...data,
          title: v("title"),
          amountSen: toSen(v("amount")),
          months: Number(v("months")),
        };
      }
      if (form === "subscription") {
        action = "subscription-create";
        data = {
          ...data,
          memberId: v("memberId"),
          planId: v("planId"),
          startsOn: v("startsOn"),
          expiresOn: v("expiresOn"),
        };
      }
      if (form === "cycle") {
        action = "billing-generate";
        data = { ...data, period: v("period") };
      }
      if (form === "attendance") {
        action = "attendance-save";
        data = {
          sessionId: v("sessionId"),
          records: members.map((m) => ({
            memberId: m.id,
            status: v("status-" + m.id) || "Absent",
          })),
        };
      }
      const result = await run(action, data);
      if (result) setMember(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const field = (
    name: string,
    label: string,
    type = "text",
    required = true,
    defaultValue?: string,
  ) => (
    <Label title={label}>
      <input
        className={input}
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        required={required}
        maxLength={type === "text" ? 250 : undefined}
        defaultValue={defaultValue}
      />
    </Label>
  );
  if (loading)
    return (
      <main className="p-10" role="status">
        Loading your saved workspace…
      </main>
    );
  if (!w)
    return (
      <main className="p-10">
        <p role="alert">{error}</p>
        <button
          className={button}
          onClick={() => {
            setLoading(true);
            load().catch((e) => {
              setError(e.message);
              setLoading(false);
            });
          }}
        >
          Retry
        </button>
        <Link className="ml-5" href="/login">
          Sign in
        </Link>
      </main>
    );
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header
        inert={!!form || !!receipt}
        className="border-b bg-white px-4 py-4 sm:px-8"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4">
          <div className="mr-auto">
            <p className="text-xs font-bold tracking-widest text-sky-700">
              SP SPORTDATA SOLUTION
            </p>
            <h1 className="text-xl font-bold">SCMS · Club workspace</h1>
          </div>
          <span className="text-xs text-slate-500">
            {w.user.email} ·{" "}
            {roles
              .map((r) => r.role)
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(", ")}
          </span>
          <button
            className="rounded-lg border px-3 py-2 text-sm"
            disabled={busy}
            onClick={() => load().catch((e) => setError(e.message))}
          >
            Refresh
          </button>
          <button
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={async () => {
              try {
                const { createClient } = await import(
                  "@/utils/supabase/client"
                );
                const { error } = await createClient().auth.signOut({
                  scope: "local",
                });
                if (error) throw error;
                window.location.assign("/login");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <div inert={!!form || !!receipt} className="mx-auto max-w-7xl p-4 sm:p-8">
        <div className="mb-6 flex flex-wrap gap-3">
          <label className="text-sm">
            Club
            <select
              className={input}
              value={club}
              onChange={(e) => {
                setClub(e.target.value);
                setBranch("");
                setMember(null);
                setSearch("");
              }}
            >
              {w.clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name || c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Branch
            <select
              className={input}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="">All authorised branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          {platform && (
            <button
              className={button + " self-end"}
              disabled={busy}
              onClick={() => setForm("club")}
            >
              Register club
            </button>
          )}
        </div>
        <nav
          className="mb-6 flex gap-2 overflow-x-auto border-b pb-3"
          aria-label="Workspace modules"
        >
          {[
            "Overview",
            "Members",
            "Approvals",
            "Attendance",
            "Fees",
            "Bank details",
            "KarateTech",
            "Tasks",
            "Events",
            "Renewals",
            "Activity",
          ].map((t) => (
            <button
              className={
                "whitespace-nowrap rounded-lg px-4 py-2 text-sm " +
                (tab === t ? "bg-sky-700 text-white" : "bg-white")
              }
              key={t}
              onClick={() => {
                setTab(t);
                setSearch("");
                setError("");
              }}
            >
              {t}
            </button>
          ))}
        </nav>
        {error && (
          <div
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            className="mb-5 rounded-xl bg-emerald-50 p-4 text-emerald-800"
            role="status"
          >
            {notice}
          </div>
        )}
        {!club && (
          <section className={card}>
            <h2 className="font-bold">Create your club</h2>
            <p className="my-3 text-sm">
              Your club and its administrator will be reviewed before
              activation.
            </p>
            <button className={button} onClick={() => setForm("club")}>
              Start registration
            </button>
          </section>
        )}
        {tab === "Overview" && (
          <>
            <h2 className="mb-5 text-2xl font-bold">{cName}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Members / athletes", String(members.length)],
                ["Outstanding fees", money(outstanding)],
                ["Verified collections", money(paid)],
                [
                  "Pending approvals",
                  String(
                    byKind("approval").filter(
                      (r) => r.data.status === "Pending",
                    ).length,
                  ),
                ],
              ].map(([k, v]) => (
                <section key={k} className={card}>
                  <p className="text-sm text-slate-500">{k}</p>
                  <p className="mt-3 text-3xl font-bold">{v}</p>
                </section>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Totals reflect authorised records loaded in this workspace. Up to
              1,000 records per module; use your accounting export for
              reconciliation.
            </p>
            <section className={card + " mt-6"}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-bold">Branches & dojos</h3>
                {canManage(roles, club, null) && (
                  <button className={button} onClick={() => setForm("branch")}>
                    Add branch
                  </button>
                )}
              </div>
              <ul className="mt-4 divide-y">
                {branches.map((b) => (
                  <li className="py-3" key={b.id}>
                    {b.name}{" "}
                    <span className="text-sm text-slate-500">
                      {b.venue_name} · {b.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        {tab === "Members" && (
          <>
            <div className="mb-5 flex flex-wrap gap-3">
              <input
                className={input + " max-w-md"}
                aria-label="Search members"
                placeholder="Search name, member number or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {managing && (
                <button className={button} onClick={() => setForm("member")}>
                  Add member / athlete
                </button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleMembers.map((m) => (
                <article key={m.id} className={card}>
                  <h3 className="font-bold">{m.full_name}</h3>
                  <p className="my-2 text-xs text-slate-500">
                    {m.member_no} · {m.date_of_birth} · {m.gender}
                  </p>
                  <p className="text-sm">
                    {m.sport_data?.participantStatus || "Approval not recorded"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {managing && <button className="rounded border px-3 py-2 text-xs" onClick={()=>{setMember(m);setForm("athlete-details")}}>Athlete details</button>}
                    {managing && (
                      <>
                        <button
                          className="rounded border px-3 py-2 text-xs"
                          onClick={() => {
                            setMember(m);
                            setForm("guardian");
                          }}
                        >
                          Guardian / siblings
                        </button>
                        <button
                          className="rounded border px-3 py-2 text-xs"
                          onClick={() => {
                            setMember(m);
                            setForm("login");
                          }}
                        >
                          Link member login
                        </button>
                        <button
                          className="rounded border px-3 py-2 text-xs"
                          onClick={() => {
                            setMember(m);
                            setForm("change");
                          }}
                        >
                          Request identity change
                        </button>
                        {!["APPROVED", "SYNCED", "ACTIVE"].includes(
                          m.sport_data?.participantStatus,
                        ) && (
                          <button
                            disabled={busy}
                            className="rounded border px-3 py-2 text-xs"
                            onClick={() =>
                              run("member-approval-request", { memberId: m.id })
                            }
                          >
                            Request member approval
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {w.guardian_relationships
                    .filter((g) => g.child_member_id === m.id)
                    .map((g) => (
                      <p className="mt-2 text-xs" key={g.id}>
                        {g.relationship}: {g.guardian_name} · {g.phone}
                      </p>
                    ))}
                  {w.member_roles.some(
                    (r) => r.member_id === m.id && r.role === "VOLUNTEER",
                  ) && <p className="mt-2 text-xs text-sky-700">Volunteer</p>}
                </article>
              ))}
            </div>
            {!visibleMembers.length && (
              <p className={card}>
                No matching members. Add a member to begin.
              </p>
            )}
          </>
        )}
        {tab === "Approvals" && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                "Pending Members",
                "Participant Changes",
                "KarateTech Reconciliation",
                "Club Registration",
              ].map((t) => (
                <button
                  key={t}
                  className={
                    "rounded border px-3 py-2 text-sm " +
                    (approvalTab === t ? "bg-sky-100" : "bg-white")
                  }
                  onClick={() => setApprovalTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {(approvalTab === "KarateTech Reconciliation"
                ? w.scms_karatetech_participant_links.filter(
                    (l) =>
                      l.club_id === club &&
                      ["CONFLICT", "FAILED", "ERROR"].includes(l.sync_status),
                  )
                : byKind("approval").filter(
                    (r) =>
                      r.data.type ===
                      (
                        {
                          "Pending Members": "Pending Member",
                          "Participant Changes": "Participant Change",
                          "Club Registration": "Club Registration",
                        } as any
                      )[approvalTab],
                  )
              ).map((r: any) => (
                <article key={r.id || r.scms_member_id} className={card}>
                  <h3 className="font-bold">
                    {r.data?.title || mName(r.scms_member_id)}
                  </h3>
                  <p className="my-2 text-sm">
                    {r.data?.status || r.sync_status} {r.last_error}
                  </p>
                  {r.data?.changes && (
                    <p className="my-2 text-sm">
                      Requested name: {r.data.changes.fullName} · DOB:{" "}
                      {r.data.changes.dob}
                    </p>
                  )}
                  {r.data?.status === "Pending" &&
                    canManage(roles, r.club_id, null) && (
                      <div className="flex gap-2">
                        {["Approved", "Rejected"].map((decision) => (
                          <button
                            key={decision}
                            disabled={busy}
                            className={button}
                            onClick={() =>
                              run(
                                r.legacy
                                  ? "legacy-approval-decide"
                                  : "approval-decide",
                                { id: r.id, decision },
                              )
                            }
                          >
                            {decision === "Approved" ? "Approve" : "Reject"}
                          </button>
                        ))}
                      </div>
                    )}
                </article>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Approvals are recorded with the reviewer and timestamp. Identity
              changes require approval before synchronisation.
            </p>
          </>
        )}
        {tab === "Attendance" && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {training && (
                <>
                  <button className={button} onClick={() => setForm("session")}>
                    Create session
                  </button>
                  <button
                    className={button}
                    onClick={() => setForm("attendance")}
                  >
                    Record attendance
                  </button>
                </>
              )}
            </div>
            {byKind("attendance").map((a) => (
              <article key={a.id} className={card + " mb-3"}>
                {mName(a.member_id || "")} · {a.data.date} · {a.data.status}
              </article>
            ))}
            {byKind("session").map((r) => (
              <article key={r.id} className={card + " mb-3"}>
                <h3 className="font-bold">{r.data.title}</h3>
                <p className="text-sm">
                  {r.data.date} ·{" "}
                  {
                    byKind("attendance").filter(
                      (a) =>
                        a.data.sessionId === r.id &&
                        ["Present", "Late"].includes(a.data.status),
                    ).length
                  }{" "}
                  attended
                </p>
              </article>
            ))}
          </>
        )}
        {tab === "Fees" && (
          <>
            <div className="mb-4 flex flex-wrap gap-3">
              {financing && (
                <>
                  <button className={button} onClick={() => setForm("invoice")}>
                    Issue fee invoice
                  </button>
                  <button className={button} onClick={() => setForm("plan")}>
                    Create fee plan
                  </button>
                  <button className={button} onClick={() => setForm("cycle")}>
                    Generate billing cycle
                  </button>
                </>
              )}
              <button
                className="rounded-lg border bg-white px-4 py-2"
                onClick={exportRows}
              >
                Export reconciliation CSV
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Membership, athlete training, grading and event fees. Online
              payments are confirmed by the gateway; bank transfers require
              verification.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {invoices.map((i) => (
                <article className={card} key={i.id}>
                  <p className="text-xs text-slate-500">
                    {i.data.number} · {mName(i.member_id || "")}
                  </p>
                  <h3 className="mt-2 font-bold">{i.data.title}</h3>
                  <p className="mt-2 text-lg">
                    {money(i.data.amountSen - i.data.paidSen)} outstanding
                  </p>
                  <p className="text-sm">
                    Due {i.data.dueDate} · {i.data.status}
                    {i.data.status !== "Paid" && i.data.dueDate < todayMY()
                      ? " · Overdue"
                      : ""}
                  </p>
                  {i.data.paidSen < i.data.amountSen && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        disabled={busy}
                        className={button}
                        onClick={() => checkout(i)}
                      >
                        Pay online
                      </button>
                      <button
                        className="rounded-lg border px-4 py-2 text-sm"
                        onClick={() => {
                          setInvoice(i);
                          setForm("transfer");
                        }}
                      >
                        Bank transfer
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <h3 className="mb-3 mt-8 text-lg font-bold">
              Bank transfers awaiting verification
            </h3>
            {byKind("transfer")
              .filter((t) => t.data.status === "Pending verification")
              .map((t) => (
                <div className={card + " mb-3"} key={t.id}>
                  <p>
                    {mName(t.member_id || "")} · {money(t.data.amountSen)} ·{" "}
                    {t.data.reference}
                  </p>
                  <p className="my-2 text-xs">{t.data.notes}</p>
                  {canManage(roles, t.club_id, t.branch_id, true) && (
                    <div className="flex gap-3">
                      {["Approved", "Rejected"].map((decision) => (
                        <button
                          disabled={busy}
                          className={button}
                          key={decision}
                          onClick={() =>
                            run("transfer-review", { id: t.id, decision })
                          }
                        >
                          {decision === "Approved"
                            ? "Verify received funds"
                            : "Reject reference"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            <h3 className="mb-3 mt-8 text-lg font-bold">
              Gateway reconciliation
            </h3>
            {w.scms_payment_attempts
              .filter(
                (a) =>
                  a.club_id === club && (!branch || a.branch_id === branch),
              )
              .map((a) => (
                <div key={a.id} className={card + " mb-3"}>
                  <p>
                    {money(a.amount_sen)} · {a.status} ·{" "}
                    {a.provider_bill_id || "Bill ID awaiting reconciliation"}
                  </p>
                  {canManage(roles, a.club_id, a.branch_id, true) &&
                    a.status !== "PAID" && (
                      <button
                        disabled={busy}
                        className={button + " mt-3"}
                        onClick={async () => {
                          const id =
                            a.provider_bill_id ||
                            window.prompt(
                              "Billplz bill ID from the merchant dashboard (match the SCMS attempt reference):",
                            );
                          if (!id) return;
                          setBusy(true);
                          try {
                            const r = await fetch("/api/payments/reconcile", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                attemptId: a.id,
                                providerBillId: id,
                              }),
                            });
                            const d = await r.json();
                            if (!r.ok) throw Error(d.error);
                            setNotice(
                              d.result?.review
                                ? "Amount requires finance review"
                                : d.result?.paid === false
                                  ? "Provider reports this bill is not paid"
                                  : "Gateway payment reconciled",
                            );
                            await load();
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Check provider / reconcile
                      </button>
                    )}
                </div>
              ))}
            <h3 className="mb-3 mt-8 text-lg font-bold">Receipts</h3>
            {byKind("receipt").map((r) => (
              <button
                key={r.id}
                className={card + " mb-2 block w-full text-left"}
                onClick={() => setReceipt(r)}
              >
                {mName(r.member_id || "")} · {money(r.data.amountSen)} ·{" "}
                {r.data.reference} · {r.data.status} · View receipt
              </button>
            ))}
          </>
        )}
        {tab === "Bank details" && (
          <>
            <div className={card}>
              <h2 className="font-bold">Club and branch bank accounts</h2>
              <p className="my-3 text-sm text-slate-600">
                Club accounts apply to all branches unless a branch has its own
                account. These details support bank transfers. Online settlement
                uses the club’s approved merchant account.
              </p>
              {managing && (
                <button className={button} onClick={() => setForm("bank")}>
                  Add / update bank details
                </button>
              )}
            </div>
            {byKind("bank").map((r) => (
              <article key={r.id} className={card + " mt-4"}>
                <h3 className="font-bold">
                  {branches.find((b) => b.id === r.branch_id)?.name ||
                    "Club default"}
                </h3>
                <p>
                  {r.data.bankName} · {r.data.accountName}
                </p>
                <p className="font-mono">{r.data.accountNumber}</p>
                <p className="text-sm">{r.data.instructions}</p>
                <small>Updated {date(r.updated_at)}</small>
              </article>
            ))}
          </>
        )}
        {tab === "KarateTech" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button disabled={busy} className={button} onClick={health}>
                Test live connection
              </button>
              <span className="text-sm text-slate-600">
                Category selection and tournament results remain in KarateTech.
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {members
                .filter(
                  (m) =>
                    w.member_roles.some(
                      (r) => r.member_id === m.id && r.role === "ATHLETE",
                    ) || m.sport_data?.isAthlete,
                )
                .map((m) => {
                  const l = w.scms_karatetech_participant_links.find(
                    (l) => l.scms_member_id === m.id,
                  );
                  return (
                    <article key={m.id} className={card}>
                      <h3 className="font-bold">{m.full_name}</h3>
                      <p className="my-2 text-sm">
                        {l?.sync_status || "Not synchronised"} · {l?.last_error}
                      </p>
                      {canManage(roles, m.club_id, m.branch_id) && (
                        <button
                          disabled={busy}
                          className={button}
                          onClick={() => sync(m)}
                        >
                          Preview / retry sync
                        </button>
                      )}
                    </article>
                  );
                })}
            </div>
            {syncPreview && (
              <section className={card + " mt-5"}>
                <h3 className="font-bold">
                  Review {syncPreview.member.full_name}
                </h3>
                {!syncPreview.approved && (
                  <p className="my-3 text-amber-800">
                    Member approval is required before synchronisation.
                  </p>
                )}
                <pre className="my-3 overflow-x-auto text-xs">
                  {JSON.stringify(syncPreview.payload, null, 2)}
                </pre>
                {syncPreview.conflicts?.map((c: any) => (
                  <p key={c.fieldName} className="my-2 text-sm">
                    {c.fieldName}: SCMS {String(c.scmsValue)} · KarateTech{" "}
                    {String(c.karateTechValue)}
                  </p>
                ))}
                {syncPreview.conflicts?.length > 0 ? (
                  <p className="text-red-700">
                    Name or date-of-birth conflict detected. Compare the values
                    below, correct the appropriate system, then retry. SCMS
                    identity changes require approval.
                  </p>
                ) : (
                  <button
                    disabled={busy || !syncPreview.approved}
                    className={button}
                    onClick={() => sync(syncPreview.member, true)}
                  >
                    Confirm participant sync
                  </button>
                )}
                <button
                  className="ml-3 underline"
                  onClick={() => setSyncPreview(null)}
                >
                  Close
                </button>
              </section>
            )}
            <h3 className="my-4 font-bold">Persistent sync history</h3>
            {w.sync_history
              .filter((h) => h.club_id === club)
              .map((h) => (
                <article key={h.id} className={card + " mb-2"}>
                  {mName(h.scms_participant_id)} · {h.status} ·{" "}
                  {date(h.start_time)}
                  <p className="text-xs text-red-700">{h.error_message}</p>
                </article>
              ))}
          </>
        )}
        {["Tasks", "Events", "Renewals"].includes(tab) && (
          <>
            <button
              className={button + " mb-4"}
              disabled={tab === "Renewals" ? !financing : !managing}
              onClick={() =>
                setForm(
                  tab === "Tasks"
                    ? "task"
                    : tab === "Events"
                      ? "event"
                      : "subscription",
                )
              }
            >
              {tab === "Renewals"
                ? "Add membership renewal"
                : `Create ${tab === "Tasks" ? "task" : "event"}`}
            </button>
            {byKind(
              tab === "Tasks"
                ? "task"
                : tab === "Events"
                  ? "event"
                  : "subscription",
            ).map((r) => (
              <article className={card + " mb-3"} key={r.id}>
                <h3 className="font-bold">{r.data.title}</h3>
                <p className="my-2 text-sm">
                  {r.data.status} · {r.data.date || r.data.expiresOn}{" "}
                  {r.member_id && mName(r.member_id)}
                </p>
                {r.kind === "task" && !allObserver && (
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() =>
                      run("task-status", {
                        id: r.id,
                        status:
                          r.data.status === "Completed" ? "Open" : "Completed",
                      })
                    }
                  >
                    {r.data.status === "Completed" ? "Reopen" : "Complete"}
                  </button>
                )}
              </article>
            ))}
            {tab === "Renewals" && (
              <section className={card}>
                <h3 className="font-bold">Expiring within 30 days</h3>
                {members
                  .filter(
                    (m) =>
                      m.membership_expires_on &&
                      m.membership_expires_on <=
                        new Date(Date.now() + 30 * 86400000)
                          .toISOString()
                          .slice(0, 10),
                  )
                  .map((m) => (
                    <p key={m.id}>
                      {m.full_name} · {m.membership_expires_on}
                    </p>
                  ))}
              </section>
            )}
          </>
        )}
        {tab === "Activity" && (
          <div className="space-y-3">
            {w.audit_logs
              .filter((a) => !a.club_id || a.club_id === club)
              .map((a) => (
                <article className={card} key={a.id}>
                  <strong>{a.action}</strong>
                  <p className="text-xs">
                    {date(a.created_at)} · {a.entity_id}
                  </p>
                </article>
              ))}
          </div>
        )}
        <footer className="mt-10 border-t pt-4 text-xs text-slate-500">
          {platform && (
            <a
              className="mr-4 underline"
              href="/api/legacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read-only legacy archive
            </a>
          )}
          SCMS · Server-verified permissions · Saved records · Malaysia (UTC+8)
        </footer>
      </div>
      {receipt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment receipt"
          className="fixed inset-0 z-50 overflow-auto bg-slate-900/50 p-4"
        >
          <section className={card + " scms-receipt mx-auto mt-12 max-w-xl"}>
            <h2 className="text-2xl font-bold">Official payment receipt</h2>
            <p className="mt-3">{cName}</p>
            <p>{mName(receipt.member_id || "")}</p>
            <p className="mt-5 text-3xl font-bold">
              {money(receipt.data.amountSen)}
            </p>
            <dl className="my-5 space-y-2 text-sm">
              <div>Receipt: {receipt.id}</div>
              <div>
                Invoice: {receipt.data.invoiceNumber || receipt.data.invoiceId}
              </div>
              <div>Reference: {receipt.data.reference}</div>
              <div>Method: {receipt.data.method}</div>
              <div>Status: {receipt.data.status}</div>
              <div>Recorded: {date(receipt.created_at)}</div>
            </dl>
            <div className="flex gap-3 print:hidden">
              <button className={button} onClick={() => window.print()}>
                Print / Save PDF
              </button>
              <button
                className="rounded border px-4"
                onClick={() => setReceipt(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
      {form && (
        <div className="fixed inset-0 z-50 overflow-auto bg-slate-900/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={form + " form"}
            className={card + " mx-auto my-8 max-w-xl"}
          >
            <div className="mb-5 flex justify-between">
              <h2 className="text-xl font-bold capitalize">
                {form === "bank"
                  ? "Bank account details"
                  : form === "transfer"
                    ? "Record bank transfer"
                    : form === "change"
                      ? "Request identity change"
                      : form}
              </h2>
              <button
                disabled={busy}
                aria-label="Close form"
                onClick={() => {
                  setForm("");
                  setInvoice(null);
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              {form === "club" && (
                <>
                  {field("name", "Registered club name")}
                  {field("displayName", "Display name (maximum 30 characters)")}
                  {field("sport", "Sport", "text", true, "Karate")}
                </>
              )}
              {form === "branch" && (
                <>
                  {field("name", "Branch / dojo name")}
                  {field("venue", "Venue", "text", false)}
                  {field("address", "Address", "text", false)}
                </>
              )}
              {form === "member" && (
                <>
                  <Label title="Branch">
                    <select
                      required
                      name="branchId"
                      className={input}
                      defaultValue={branch}
                    >
                      <option value="">Choose branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </Label>
                  {field("fullName", "Full name")}
                  {field("dob", "Date of birth", "date")}
                  <Label title="Gender">
                    <select className={input} name="gender">
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </Label>
                  {field("icPassport", "IC / passport", "text", false)}
                  {field("email", "Email", "email", false)}
                  {field("phone", "Phone", "tel", false)}
                  {field("beltRank", "Belt / grade", "text", false)}
                  {field("weightKg", "Weight (kg)", "number", false)}
                  {field("heightCm", "Height (cm)", "number", false)}
                  {field("nationalityCode", "Nationality code from KarateTech countries", "text", false)}
                  {field("emergencyName", "Emergency contact name", "text", false)}
                  {field("emergencyPhone", "Emergency contact phone", "tel", false)}
                  <label className="block">
                    <input type="checkbox" name="isAthlete" defaultChecked />{" "}
                    Athlete
                  </label>
                  <label className="block">
                    <input type="checkbox" name="isVolunteer" /> Volunteer
                  </label>
                  <p className="text-xs">
                    Similar names with matching DOB or identity numbers are
                    flagged before saving.
                  </p>
                </>
              )}
              {form === "athlete-details" && <>
                <p className="text-sm">Update the athlete fields shared with KarateTech. Changes to IC/passport require approval again. Tournament categories and results stay in KarateTech.</p>
                {field("icPassport","IC / passport","text",true,member?.ic_passport||"")}
                {field("nationalityCode","Nationality code from KarateTech countries","text",false,member?.sport_data?.nationalityCode||member?.nationality||"")}
                {field("weightKg","Weight (kg)","number",true,String(member?.sport_data?.weightKg||""))}
                {field("heightCm","Height (cm)","number",true,String(member?.sport_data?.heightCm||""))}
                {field("beltRank","Belt / grade","text",false,member?.sport_data?.beltRank||"")}
                {field("emergencyName","Emergency contact name","text",false,member?.emergency_contact?.name||"")}
                {field("emergencyPhone","Emergency contact phone","tel",false,member?.emergency_contact?.phone||"")}
              </>}
              {form === "login" && (
                <>
                  {field(
                    "email",
                    "Approved account email",
                    "email",
                    true,
                    member?.email,
                  )}
                  <p className="text-xs">
                    The account email must match this member’s recorded email.
                    Linking grants access to this member’s fees and attendance.
                  </p>
                </>
              )}
              {form === "guardian" && (
                <>
                  <Label title="Reuse an existing guardian">
                    <select
                      className={input}
                      defaultValue=""
                      onChange={(e) => {
                        const g = w.guardian_relationships.find(
                          (g) => g.id === e.target.value,
                        );
                        if (g) {
                          const el = e.currentTarget.form!;
                          for (const [key, value] of Object.entries({
                            name: g.guardian_name,
                            relationship: g.relationship,
                            phone: g.phone,
                            email: g.email,
                            profileId: g.guardian_profile_id,
                          })) {
                            const field = el.elements.namedItem(
                              key,
                            ) as HTMLInputElement | null;
                            if (field) field.value = String(value || "");
                          }
                        }
                      }}
                    >
                      <option value="">New guardian</option>
                      {w.guardian_relationships
                        .filter(
                          (g, i, a) =>
                            a.findIndex(
                              (x) =>
                                x.guardian_name === g.guardian_name &&
                                x.phone === g.phone,
                            ) === i,
                        )
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.guardian_name} · {g.phone}
                          </option>
                        ))}
                    </select>
                  </Label>
                  {field("name", "Guardian full name")}
                  <Label title="Relationship">
                    <select className={input} name="relationship">
                      {["Father", "Mother", "Guardian", "Spouse", "Other"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                  </Label>
                  {field("phone", "Phone", "tel")}
                  {field("email", "Email", "email", false)}
                  {field(
                    "profileId",
                    "Linked Parent user UUID (optional)",
                    "text",
                    false,
                  )}
                  <p className="text-xs">
                    A linked login must already have a Parent role in this club.
                  </p>
                </>
              )}
              {form === "change" && (
                <>
                  {field(
                    "fullName",
                    "Full name",
                    "text",
                    true,
                    member?.full_name,
                  )}
                  {field(
                    "dob",
                    "Date of birth",
                    "date",
                    true,
                    member?.date_of_birth,
                  )}
                </>
              )}
              {form === "invoice" && (
                <>
                  <Label title="Member / athlete">
                    <select className={input} name="memberId" required>
                      <option value="">Choose member</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                  </Label>
                  {field("title", "Fee description")}
                  {field("amount", "Amount (MYR)", "text")}
                  {field("dueDate", "Due date", "date")}
                </>
              )}
              {form === "transfer" && (
                <>
                  {(() => {
                    const banks = w.scms_records.filter(
                      (r) =>
                        r.kind === "bank" && r.club_id === invoice?.club_id,
                    );
                    const bank =
                      banks.find((r) => r.branch_id === invoice?.branch_id) ||
                      banks.find((r) => !r.branch_id);
                    return bank ? (
                      <div className="rounded-xl bg-sky-50 p-4 text-sm">
                        <p>{bank.data.bankName}</p>
                        <p>{bank.data.accountName}</p>
                        <p className="font-mono">{bank.data.accountNumber}</p>
                        <p>{bank.data.instructions}</p>
                      </div>
                    ) : (
                      <p className="text-amber-800">
                        Ask your club administrator to register bank details
                        before transferring.
                      </p>
                    );
                  })()}
                  {field(
                    "amount",
                    "Transferred amount (MYR)",
                    "text",
                    true,
                    invoice
                      ? (
                          (invoice.data.amountSen - invoice.data.paidSen) /
                          100
                        ).toFixed(2)
                      : "",
                  )}
                  {field("reference", "Bank transaction reference")}
                  {field("notes", "Transfer date / notes", "text", false)}
                  <p className="text-xs">
                    The invoice remains outstanding until finance verifies
                    receipt of funds.
                  </p>
                </>
              )}
              {form === "bank" && (
                <>
                  <Label title="Account scope">
                    <select
                      className={input}
                      name="scope"
                      defaultValue={branch}
                    >
                      {canManage(roles, club, null) && (
                        <option value="">Club default</option>
                      )}
                      {branches
                        .filter((b) => canManage(roles, club, b.id))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </Label>
                  {field("bankName", "Bank name")}
                  {field("accountName", "Account holder / club name")}
                  {field("accountNumber", "Account number")}
                  {field("instructions", "Payment instructions", "text", false)}
                </>
              )}
              {["task", "session", "event"].includes(form) && (
                <>
                  {field("title", "Title")}
                  {field("date", form === "task" ? "Due date" : "Date", "date")}
                  {form === "task" && (
                    <Label title="Priority">
                      <select className={input} name="priority">
                        {["Normal", "High", "Urgent"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </Label>
                  )}
                </>
              )}
              {form === "plan" && (
                <>
                  {field("title", "Fee plan name")}
                  {field("amount", "Amount per billing interval (MYR)")}
                  <Label title="Frequency">
                    <select className={input} name="months">
                      <option value="1">Monthly</option>
                      <option value="3">Quarterly</option>
                      <option value="6">Every six months</option>
                      <option value="12">Annually</option>
                    </select>
                  </Label>
                </>
              )}
              {form === "cycle" && (
                <>
                  {field("period", "Billing month", "month")}
                  <p className="text-xs">
                    Creates invoices for active subscriptions due in this month.
                    Repeating this operation does not duplicate existing
                    invoices. Invoices are due on the 7th.
                  </p>
                </>
              )}
              {form === "subscription" && (
                <>
                  <Label title="Member / athlete">
                    <select className={input} name="memberId" required>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                  </Label>
                  <Label title="Fee plan">
                    <select className={input} name="planId" required>
                      <option value="">Choose a fee plan</option>
                      {byKind("plan").map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.data.title} · {money(p.data.amountSen)}
                        </option>
                      ))}
                    </select>
                  </Label>
                  {field("startsOn", "Membership start", "date")}
                  {field("expiresOn", "Membership expiry", "date")}
                </>
              )}
              {form === "attendance" && (
                <>
                  <p className="text-xs">
                    Select a branch before recording attendance.
                  </p>
                  <Label title="Session">
                    <select className={input} required name="sessionId">
                      <option value="">Choose session</option>
                      {byKind("session")
                        .filter((s) => s.branch_id === branch)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.data.title} · {s.data.date}
                          </option>
                        ))}
                    </select>
                  </Label>
                  {members.map((m) => (
                    <Label title={m.full_name} key={m.id}>
                      <select className={input} name={"status-" + m.id}>
                        <option>Absent</option>
                        <option>Present</option>
                        <option>Late</option>
                        <option>Excused</option>
                      </select>
                    </Label>
                  ))}
                </>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <button className={button + " w-full"} disabled={busy}>
                {busy
                  ? "Saving…"
                  : form === "transfer"
                    ? "Submit for verification"
                    : "Save"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
