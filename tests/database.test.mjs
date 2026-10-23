import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth to authenticated,anon,service_role;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
);
for (const file of [
  "0000_initial_schema.sql",
  "0001_csv_and_sync.sql",
  "20261023075653_scms_operational_upgrade.sql",
  "20261023123733_athlete_sync_fields.sql",
]) {
  let sql = fs
    .readFileSync(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    )
    .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', "")
    .replaceAll("uuid_generate_v4()", "gen_random_uuid()");
  await db.exec(sql);
}
const users = {
  admin: "00000000-0000-4000-8000-000000000001",
  clubA: "00000000-0000-4000-8000-000000000002",
  clubB: "00000000-0000-4000-8000-000000000003",
  observer: "00000000-0000-4000-8000-000000000004",
  parent: "00000000-0000-4000-8000-000000000005",
  branch: "00000000-0000-4000-8000-000000000006",
};
for (const [name, id] of Object.entries(users)) {
  await db.query("insert into auth.users(id,email)values($1,$2)", [
    id,
    name + "@example.invalid",
  ]);
  await db.query("update public.profiles set status='ACTIVE' where id=$1", [
    id,
  ]);
}
const clubA = "10000000-0000-4000-8000-000000000001",
  clubB = "10000000-0000-4000-8000-000000000002",
  branchA = "20000000-0000-4000-8000-000000000001",
  branchB = "20000000-0000-4000-8000-000000000002";
await db.query(
  "insert into public.clubs(id,name,status) values($1,'Club A','Active'),($2,'Club B','Active')",
  [clubA, clubB],
);
await db.query(
  "insert into public.club_branches(id,club_id,name) values($1,$2,'Branch A'),($3,$4,'Branch B')",
  [branchA, clubA, branchB, clubB],
);
for (const [name, role, c, b] of [
  ["admin", "SUPERADMIN", null, null],
  ["clubA", "CLUB_ADMIN", clubA, null],
  ["clubB", "CLUB_ADMIN", clubB, null],
  ["observer", "OBSERVER", clubA, null],
  ["parent", "PARENT", clubA, null],
  ["branch", "BRANCH_MANAGER", clubA, branchA],
])
  await db.query(
    "insert into public.user_roles(user_id,role,club_id,branch_id)values($1,$2,$3,$4)",
    [users[name], role, c, b],
  );
async function as(name, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    users[name] || "",
  ]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function command(name, a, d) {
  return as(name, async () => {
    const r = await db.query(
      "select public.scms_command($1,$2::jsonb) as result",
      [a, JSON.stringify(d)],
    );
    return r.rows[0].result;
  });
}
const create = {
  clubId: clubA,
  branchId: branchA,
  fullName: "Test Athlete",
  gender: "Female",
  dob: "2012-01-01",
  icPassport: "TEST-001",
  isAthlete: true,
};
const member = await command("clubA", "member-create", create);
assert.ok(member.id);
await assert.rejects(
  command("clubA", "member-create", {
    ...create,
    fullName: " Test  Athlete ",
    icPassport: "",
  }),
  /Similar member/,
);
await assert.rejects(command("clubB", "member-create", create), /denied/);
await assert.rejects(command("observer", "member-create", create), /denied/);
await as("clubB", async () =>
  assert.equal((await db.query("select * from public.members")).rows.length, 0),
);
await as("parent", async () =>
  assert.equal((await db.query("select * from public.members")).rows.length, 0),
);
await command("clubA", "guardian-save", {
  memberId: member.id,
  name: "Parent Test",
  relationship: "Mother",
  profileId: users.parent,
  phone: "000",
});
await as("parent", async () =>
  assert.equal((await db.query("select * from public.members")).rows.length, 1),
);
const sibling = await command("clubA", "member-create", {
  ...create,
  fullName: "Sibling Test",
  dob: "2014-01-01",
  icPassport: "TEST-002",
});
await command("clubA", "guardian-save", {
  memberId: sibling.id,
  name: "Parent Test",
  relationship: "Mother",
  profileId: users.parent,
  phone: "000",
});
await as("parent", async () =>
  assert.equal((await db.query("select * from public.members")).rows.length, 2),
);
await assert.rejects(
  command("branch", "member-create", { ...create, branchId: branchB }),
  /Branch does not belong/,
);
const approve = (
  await db.query(
    "select id from public.scms_records where kind='approval' and member_id=$1",
    [member.id],
  )
).rows[0].id;
await command("clubA", "approval-decide", {
  id: approve,
  decision: "Approved",
});
const invoice = await command("clubA", "invoice-create", {
  memberId: member.id,
  title: "Monthly training",
  amountSen: 10000,
  dueDate: "2026-11-01",
});
await assert.rejects(
  command("parent", "invoice-create", {
    memberId: member.id,
    title: "Fake",
    amountSen: 100,
    dueDate: "2026-11-01",
  }),
  /denied/,
);
await assert.rejects(
  command("parent", "transfer-submit", {
    invoiceId: invoice.id,
    amountSen: -1,
    reference: "TEST-NEG",
  }),
  /Valid reference/,
);
await assert.rejects(
  command("parent", "transfer-submit", {
    invoiceId: invoice.id,
    amountSen: 10001,
    reference: "TEST-OVER",
  }),
  /Valid reference/,
);
const transfer = await command("parent", "transfer-submit", {
  invoiceId: invoice.id,
  amountSen: 4000,
  reference: "BANK-001",
});
await assert.rejects(
  command("parent", "transfer-review", {
    id: transfer.id,
    decision: "Approved",
  }),
  /cannot be verified/,
);
await command("clubA", "transfer-review", {
  id: transfer.id,
  decision: "Approved",
});
await assert.rejects(
  command("parent", "transfer-submit", {
    invoiceId: invoice.id,
    amountSen: 1000,
    reference: "bank-001",
  }),
  /already recorded/,
);
await assert.rejects(
  command("clubA", "transfer-review", {
    id: transfer.id,
    decision: "Approved",
  }),
  /cannot be verified/,
);
const bank = await command("branch", "bank-save", {
  clubId: clubA,
  branchId: branchA,
  bankName: "Test bank",
  accountName: "Club A",
  accountNumber: "123456789",
});
assert.ok(bank.id);
await assert.rejects(
  command("branch", "bank-save", {
    clubId: clubA,
    bankName: "Test bank",
    accountName: "Club A",
    accountNumber: "123456789",
  }),
  /denied/,
);
let a = await as("parent", async () => {
  const r = await db.query("select public.scms_reserve_checkout($1) as r", [
    invoice.id,
  ]);
  return r.rows[0].r;
});
let a2 = await as("parent", async () => {
  const r = await db.query("select public.scms_reserve_checkout($1) as r", [
    invoice.id,
  ]);
  return r.rows[0].r;
});
assert.equal(a.id, a2.id);
assert.equal(a.amount_sen, 6000);
await as("parent", async () =>
  assert.rejects(
    db.query("select public.scms_gateway_event($1,'paid','fake',null,6000)", [
      a.id,
    ]),
    /permission denied/,
  ),
);
await db.exec("set role service_role");
await db.query(
  "select public.scms_gateway_event($1,'attach','test-bill','https://www.billplz-sandbox.com/bills/test-bill')",
  [a.id],
);
await db.query(
  "select public.scms_gateway_event($1,'paid','test-bill',null,6000)",
  [a.id],
);
await db.query(
  "select public.scms_gateway_event($1,'paid','test-bill',null,6000)",
  [a.id],
);
await db.exec("reset role");
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from public.scms_records where kind='receipt' and data->>'reference'='BILLPLZ-test-bill'",
    )
  ).rows[0].n,
  1,
);
assert.equal(
  (
    await db.query("select data from public.scms_records where id=$1", [
      invoice.id,
    ])
  ).rows[0].data.status,
  "Paid",
);
await as("clubA", async () =>
  assert.rejects(
    db.query(
      "select public.scms_sync_state($1,'SUCCESS','forged','fake',null,null)",
      [member.id],
    ),
    /permission denied/,
  ),
);
await as("observer", async () =>
  assert.rejects(
    db.query(
      "insert into public.scms_records(kind,club_id,data)values('invoice',$1,'{}')",
      [clubA],
    ),
    /permission denied/,
  ),
);
const plan = await command("clubA", "plan-create", {
  clubId: clubA,
  title: "Monthly athlete fees",
  amountSen: 5000,
  months: 1,
});
await command("clubA", "subscription-create", {
  memberId: sibling.id,
  planId: plan.id,
  startsOn: "2026-10-01",
  expiresOn: "2027-10-01",
});
assert.equal(
  (
    await command("clubA", "billing-generate", {
      clubId: clubA,
      period: "2026-10",
    })
  ).generated,
  1,
);
assert.equal(
  (
    await command("clubA", "billing-generate", {
      clubId: clubA,
      period: "2026-10",
    })
  ).generated,
  0,
);
const sess = await command("clubA", "record-create", {
  clubId: clubA,
  branchId: branchA,
  kind: "session",
  data: { title: "Weekly training", date: "2026-10-23" },
});
await command("clubA", "attendance-save", {
  sessionId: sess.id,
  records: [{ memberId: member.id, status: "Present" }],
});
await command("clubA", "attendance-save", {
  sessionId: sess.id,
  records: [{ memberId: member.id, status: "Late" }],
});
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from public.scms_records where kind='attendance' and member_id=$1",
      [member.id],
    )
  ).rows[0].n,
  1,
);
await assert.rejects(
  command("clubB", "attendance-save", {
    sessionId: sess.id,
    records: [{ memberId: member.id, status: "Present" }],
  }),
  /denied/,
);
await db.query("update public.profiles set status='SUSPENDED' where id=$1", [
  users.clubA,
]);
await assert.rejects(
  command("clubA", "bank-save", {
    clubId: clubA,
    bankName: "Test bank",
    accountName: "Club A",
    accountNumber: "123456789",
  }),
  /approval required/,
);
await db.exec(
  "create table public.cms_state(id text primary key,data jsonb,updated_at timestamptz default now())",
);
await db.query(
  "insert into public.cms_state(id,data)values('legacy',$1::jsonb)",
  [
    JSON.stringify({
      invoices: [
        {
          id: "legacy-one",
          memberId: member.id,
          amount: 25,
          status: "Paid",
          invoiceNo: "OLD-001",
          feeType: "Legacy training",
          issueDate: "2026-01-01",
          receiptNo: "R-001",
          paymentMethod: "Cash",
        },
        {
          id: "legacy-unsupported",
          memberId: member.id,
          amount: 50,
          status: "Partially Paid",
          invoiceNo: "OLD-002",
        },
      ],
    }),
  ],
);
const migration = fs.readFileSync(
  new URL(
    "../supabase/migrations/20261023075653_scms_operational_upgrade.sql",
    import.meta.url,
  ),
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from public.scms_records where kind='invoice' and data->>'number'='OLD-001'",
    )
  ).rows[0].n,
  1,
);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from public.scms_records where kind='receipt' and data->>'status'='Imported historical'",
    )
  ).rows[0].n,
  1,
);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from public.scms_records where kind='invoice' and data->>'number'='OLD-002'",
    )
  ).rows[0].n,
  0,
);
assert.equal(
  (
    await db.query(
      "select jsonb_array_length(data->'invoices') as n from public.cms_state",
    )
  ).rows[0].n,
  2,
);
console.log(
  "PASS: migration replay, cross-club isolation, branch scope, observer denial, parent/sibling access, duplicate identity, approvals, payment validation, transfer verification, bank scope, checkout reuse, service-only settlement, callback replay, recurring billing idempotency, attendance upserts and suspension.",
);
await db.close();
