# SCMS operational and fee collection upgrade

The authenticated workspace now reads normalized clubs, branches, members, member roles,
guardian relationships and volunteer profiles. Tasks, approvals, invoices, receipts,
bank accounts, sessions, attendance, events, fee plans and subscriptions use scoped,
persistent operational records. Original UUIDs remain unchanged. The old demonstration
screens/store remain in source for reference and are not mounted by application routes.
The public home page routes users into real authentication instead of a browser-only demo.

## Access and data

All API operations validate the Supabase session, current account status and database role
assignments. Multi-role routing is deterministic. Write permission is checked again inside
the database transaction; Observer roles cannot mutate records. A Branch Manager is limited
to their assigned branch. Parents see linked children and their invoices/attendance, with
explicit guardian-to-profile relationships. Guardian records can be reused for siblings;
a contact name alone does not grant account access. Sign Out ends the Supabase session.

Apply `supabase/migrations/20261023075653_scms_operational_upgrade.sql` before deploying the
new application. It adds tables/functions and replaces scoped policies/grants; it does not
delete existing records. It includes the normalized member-domain compatibility definitions
so a clean database can replay the repository migrations. Existing live schema was inspected
read-only before preparing this migration.

Do not switch production traffic to this version until the migration, backup and role checks
are complete. The code upgrade alone does not deploy Hostinger or change Supabase.

Legacy member identities already normalized by previous migrations are reused. Unambiguous
legacy paid/unpaid invoices are copied by matching normalized member identities. Historical
receipts are labelled `Imported historical`, never gateway-verified. Unsupported statuses and
unmatched records remain untouched in `cms_state` and are visible through the platform-only,
read-only `/api/legacy` archive. Review archive counts and balances during rollout. No import
uses a hardcoded production club/member UUID. Reapplying the invoice importer is idempotent.

The workspace loads at most 1,000 records per module; the UI states that limit. For larger
clubs, implement server pagination/aggregate reports before using these totals as company-wide
financial statements. Exported CSV text neutralises formula prefixes.

## Member approval and KarateTech

New members are checked for duplicate normalized name/DOB or identity number, with club-level
serialization to prevent concurrent duplicates. New participant identities and subsequent
name/DOB changes require approval. Existing members can request a recorded approval without
changing their UUID. Older role-assignment approvals remain visible. Archived identity-change
requests must be resubmitted through the explicit identity form; they are not blindly applied.

Single and batch sync use the same normalized member/club payload, including club display
name, gender and DOB. Server code re-reads the member instead of trusting caller-supplied
payloads or actor IDs. Preview compares remote identity fields and refuses unresolved conflicts.
Request keys are stable for the member payload; retries use the same key. A short database
lease prevents overlapping participant sends. Successful/failed/conflicting attempts are saved,
and bookkeeping errors never become a successful response. Sync confirmations require the
trusted server key; a browser cannot call the settlement/status functions directly.

Configure the existing KarateTech integration contract:

- `KARATETECH_API_URL`: HTTPS origin serving `/api/integration/scms/health`,
  `/api/integration/scms/sync-status` and `/api/integration/scms/participants`.
- `KARATETECH_API_KEY`: server-side integration key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-side only, used for trusted external confirmations.

The upstream service must honour the idempotency key and return a participant identity.
KarateTech's currently inspected GitHub main did not contain these integration routes;
confirm the deployed upstream contract before enabling live sync. No production participants
were transmitted during this implementation. Categories, brackets and results remain owned
by KarateTech. A remote name/DOB conflict is never overwritten automatically.

## Fee collection

Club Admins can enter club bank details. Assigned Branch Managers can enter their own branch
bank details. Branch details override the club default on that branch's invoices. These are
payment instructions, not a payment gateway registration or authority to redirect settlement.
No card numbers or gateway secrets are stored in those records.

Members/athletes and linked parents can see invoices, choose hosted checkout, or submit a
bank-transfer reference. A transfer remains `Pending verification` until an authorised finance
operator checks receipt of funds. Negative amounts, overpayments and reused references are
rejected. Receipt/invoice updates and their audit entry commit together. Receipt printing and
reconciliation CSV export are available. Monthly, quarterly, six-month and annual fee plans
can be assigned to members. `Generate billing cycle` creates the interval's invoices once;
repeating the operation does not duplicate them. This is an explicit admin operation, not an
unconfigured automatic debit or background scheduler.

Billplz provides the hosted checkout adapter. Members choose payment channels enabled on the
club's merchant account; FPX/card/e-wallet/DuitNow availability depends on that account.
Configure these values securely on the server/hosting environment (never commit real keys):

- `SCMS_PUBLIC_URL`: the actual HTTPS SCMS origin.
- `SUPABASE_SERVICE_ROLE_KEY`: trusted callback/checkout persistence only.
- `BILLPLZ_CLUB_ACCOUNTS`: JSON object keyed by club UUID, with optional `clubUUID:branchUUID`
  overrides for a separately approved branch merchant account. Each entry contains
  `apiKey`, `signatureKey`, `collectionId` and boolean `sandbox` (defaults to true).

Example shape with placeholders:

```json
{
  "CLUB_UUID": {
    "apiKey": "SERVER_SECRET",
    "signatureKey": "SERVER_SIGNATURE_SECRET",
    "collectionId": "MERCHANT_COLLECTION",
    "sandbox": true
  }
}
```

The callback URL is `/api/payments/billplz/callback`. Enable Billplz X Signature callbacks.
Checkout reserves the invoice's server-calculated outstanding amount and uses an atomic
claim to prevent duplicate bill creation in two tabs. Interrupted/uncertain creations move
to review instead of issuing another bill blindly. Finance can reconcile the provider bill
using the stored attempt reference. Callbacks verify HMAC using constant-time comparison,
reject duplicate parameters, check the collection, re-fetch provider status, check the exact
amount, and settle once under a database row lock. Browser return parameters never mark an
invoice paid. A late payment after manual settlement is placed in review instead of silently
creating an overpayment. Refunds/payouts and automatic recurring debits are not performed.

No live merchant account was created, no bank details were entered for a club, and no real
payment was charged. Activate production only after a real sandbox checkout, duplicate callback,
failed/abandoned payment and reconciliation have been checked with the approved merchant account.

## Verification

- `npm test`: pure permission/identity/signature checks and a local PostgreSQL-compatible
  PGlite migration/transaction suite with synthetic users, two clubs, branch manager,
  observer, parent/siblings, approvals, billing, transfers and replayed gateway events.
- `npx tsc --noEmit` and `npm run build`: application compilation.
- `npm audit --omit=dev`: production dependency advisories.
- `SCMS_TEST_URL=... node test-e2e.mjs`: read-only unauthenticated endpoint smoke checks.
- GitHub Actions runs tests, types and build on push/PR. Test role impersonation is removed.

The production build does not prove live account authorization or merchant configuration.
No authenticated production browser test, actual Billplz sandbox account payment, production
migration, Hostinger deployment or upstream KarateTech integration test is claimed by these checks.

## Athlete contract follow-up

See `ATHLETE_SYNC_TEST.md` for the complete mock integration test, additional athlete fields, matching receiver commit and required staging rollout.
