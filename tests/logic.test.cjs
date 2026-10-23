const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
function load(file, imports = {}) {
  const src = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const c = {
    exports: {},
    require: (id) => imports[id] || require(id),
    process,
    Buffer,
    URL,
    URLSearchParams,
    fetch,
    AbortSignal,
    Response,
    Request,
  };
  vm.runInNewContext(src, c);
  return c.exports;
}
const a = load("src/lib/scms/access.ts");
const b = load("src/lib/payments/billplz.ts");
test("club and branch assignments cannot grant other clubs or siblings", () => {
  const r = [{ role: "BRANCH_MANAGER", club_id: "c", branch_id: "b" }];
  assert.equal(a.canManage(r, "c", "b"), true);
  assert.equal(a.canManage(r, "c", "other"), false);
  assert.equal(a.canManage(r, "c", null), false);
  assert.equal(a.canManage(r, "other", "b"), false);
  assert.equal(
    a.canManage(
      [{ role: "OBSERVER", club_id: "c", branch_id: null }],
      "c",
      "b",
      true,
    ),
    false,
  );
});
test("deterministic role routing handles multi-role and unassigned accounts", () => {
  assert.equal(
    a.sortAssignments([{ role: "MEMBER" }, { role: "CLUB_ADMIN" }])[0].role,
    "CLUB_ADMIN",
  );
  assert.equal(a.routeForRole("CLUB_CO_ADMIN"), "/dashboard/club");
  assert.equal(a.routeForRole(""), "/pending-approval");
});
test("name/DOB conflicts are real, and whitespace-only name changes are ignored", () => {
  assert.equal(
    a.identityConflicts(
      { participant_name: " Test  Athlete ", date_of_birth: "2012-01-01" },
      { full_name: "test athlete", date_of_birth: "2012-01-01" },
    ).length,
    0,
  );
  assert.equal(
    a.identityConflicts(
      { participant_name: "Athlete", date_of_birth: "2012-01-01" },
      { name: "Other", dob: "2013-01-01" },
    ).length,
    2,
  );
});
test("money conversion rejects negative, non-finite and sub-sen amounts", () => {
  assert.equal(a.toSen("12.34"), 1234);
  for (const v of [-1, 0, "NaN", "Infinity", "1.001"])
    assert.throws(() => a.toSen(v));
});
test("Billplz callback accepts a valid signature and rejects tampering/repetition", () => {
  const p = new URLSearchParams({
    id: "zq0tm2wc",
    collection_id: "yhx5t1pp",
    paid: "true",
    state: "paid",
    amount: "100",
    paid_amount: "100",
    due_at: "2018-9-27",
    email: "api@billplz.com",
    mobile: "",
    name: "TESTER",
    url: "http://www.billplz-sandbox.com/bills/zq0tm2wc",
    paid_at: "2018-09-27 15:15:09 +0800",
  });
  const { createHmac } = require("node:crypto");
  p.set(
    "x_signature",
    createHmac("sha256", "test-secret")
      .update(b.signatureSource(p))
      .digest("hex"),
  );
  assert.equal(b.verifySignature(p, "test-secret"), true);
  p.set("amount", "101");
  assert.equal(b.verifySignature(p, "test-secret"), false);
  p.append("id", "other");
  assert.equal(b.verifySignature(p, "test-secret"), false);
});
test("checkout destinations remain on the selected provider environment", () => {
  assert.equal(
    b.safeCheckout("https://www.billplz-sandbox.com/bills/id", {
      sandbox: true,
    }),
    "https://www.billplz-sandbox.com/bills/id",
  );
  for (const url of [
    "https://evil.example/",
    "http://www.billplz.com/bills/id",
    "https://user:password@www.billplz.com/bills/id",
  ])
    assert.throws(() => b.safeCheckout(url, { sandbox: false }));
});

test("request parser rejects cross-site, malformed and oversized operations", async () => {
  const server = load("src/lib/scms/server.ts", {
    "@/utils/supabase/server": {},
    "./access": a,
  });
  await assert.rejects(
    server.body(
      new Request("https://scms.example/api/workspace", {
        method: "POST",
        headers: {
          Origin: "https://other.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    ),
    /Cross-origin/,
  );
  await assert.rejects(
    server.body(
      new Request("https://scms.example/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    ),
    /Invalid JSON/,
  );
  await assert.rejects(
    server.body(
      new Request("https://scms.example/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(128001),
      }),
    ),
    /too large/,
  );
});
test("payment callback verifies signature and amount before calling settlement", async () => {
  const { createHmac } = require("node:crypto");
  let settlements = 0;
  const merchant = {
    collectionId: "test-collection",
    signatureKey: "test-secret",
    sandbox: true,
    apiKey: "test-key",
  };
  const attempt = {
    id: "attempt",
    club_id: "club",
    branch_id: null,
    provider_bill_id: "bill",
    amount_sen: 100,
  };
  let bill = {
    id: "bill",
    collection_id: "test-collection",
    paid: true,
    amount: 100,
    paid_amount: 100,
  };
  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: attempt }) }),
      }),
    }),
    rpc: async () => {
      settlements++;
      return { data: {} };
    },
  };
  const route = load("src/app/api/payments/billplz/callback/route.ts", {
    "@/lib/payments/admin": { gatewayDb: () => mockDb },
    "@/lib/payments/billplz": {
      ...b,
      merchant: () => merchant,
      billplz: async () => bill,
    },
  });
  function request(amount = "100", valid = true) {
    const p = new URLSearchParams({
      id: "bill",
      collection_id: "test-collection",
      paid: "true",
      amount,
      paid_amount: amount,
    });
    p.set(
      "x_signature",
      valid
        ? createHmac("sha256", merchant.signatureKey)
            .update(b.signatureSource(p))
            .digest("hex")
        : "0".repeat(64),
    );
    return new Request("https://scms.example/api/payments/billplz/callback", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: p,
    });
  }
  assert.equal((await route.POST(request("100", false))).status, 401);
  assert.equal(settlements, 0);
  assert.equal((await route.POST(request("101"))).status, 409);
  assert.equal(settlements, 0);
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(settlements, 1);
  bill = { ...bill, paid: false };
  assert.equal((await route.POST(request())).status, 409);
  assert.equal(settlements, 1);
});
