# Athlete sync repair and isolated tests

## Run the test

Check out SCMS `fix/scms-athlete-contract` and KarateTech3.0 receiver commit `1e8a39b62c7ea5a53dbb8b1adfa551b006b0c475` (full SHA is pinned in CI). In each repository run `npm ci`. From SCMS run:

```bash
KARATETECH_TEST_ROOT=/absolute/path/to/KarateTech3.0 npm run test:athlete-sync
npm test
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=build-placeholder npm run build
```

On Windows PowerShell set `$env:KARATETECH_TEST_ROOT` to the KarateTech checkout before `npm run test:athlete-sync`. No production URL or credentials are used. The test generates a temporary integration key in memory and destroys both disposable databases and HTTP servers at exit.

## Actual coverage and limits

The test starts two loopback HTTP services using actual SCMS and KarateTech route handlers, the actual SCMS sync client, and two separate PGlite databases. It replays checked-in SCMS migrations and the KarateTech participant baseline plus receiver migration. Synthetic session/DB adapters replace Supabase Auth and PostgREST; RLS, authorization SQL, transactions, mappings and read-back use real application code and database functions. This is a contract/integration test, not a deployed Supabase Auth/browser test or a real multi-process PostgreSQL concurrency/load test.

The scenarios cover complete athlete creation, approval before sync, authenticated health, first send and full field read-back, repeat send with stable participant UUID, contact/measurement update, preserved competition/payment status, name/DOB conflicts, observer/other-club/signed-out denial, duplicate identity under a second source ID, ten simultaneous receiver retries, invalid input, browser DB denial, missing fields with rollback, bad integration keys, read-back mismatch, batch deduplication, stale request rejection and recovery/audit state.

## Contract

SCMS sends name, DOB, gender, club display name, email, phone, IC/passport, nationality code from KarateTech's country registry, weight kg, height cm, emergency contact name and phone. Source UUIDs, member number, branch UUID and belt/grade are retained in server-only KarateTech source metadata. An athlete source revision prevents stale payloads overwriting newer details. Missing IC/passport or measurements are an actionable validation error; no dummy values are inserted. Medical notes, passwords, fees, tournament categories and results are not copied.

Only active members with an ATHLETE role can sync. Approval is checked in the application and again inside trusted database bookkeeping. SCMS will not record success until the returned participant UUID and every contract field pass a read-back comparison. Existing names/DOB, club moves and ambiguous participant/club matches require reconciliation rather than an automatic merge. Bulk reports count unique members and distinguish created, updated and unchanged outcomes.

## Staging rollout

1. Keep the production databases and current real athlete records unchanged while staging is tested.
2. Back up and apply the SCMS operational upgrade migration first, then `20261023123733_athlete_sync_fields.sql`, to an isolated staging database. The second migration adds the missing profile read grant for a fresh database and stores the additional athlete fields within the existing scoped transaction.
3. Apply the receiver migration to KarateTech staging, following that repository's `docs-SCMS-INTEGRATION.md`. Use `npm run build:integration` and a Node server; the old Hostinger static export excludes APIs.
4. Configure staging Supabase URL/publishable keys and server-only service keys. Set `KARATETECH_API_URL` to the actual HTTPS KarateTech Node origin. `KARATETECH_API_KEY` in SCMS must equal server-only `SCMS_INTEGRATION_KEY` in KarateTech, with at least 32 random characters. Never put server keys in browser variables or Git.
5. In staging, sign in as Club Admin, add a fictional athlete with all required fields, approve, preview sync, send, compare the target fields and retry. Repeat with Branch Manager and Observer to verify deployed sessions and tenant boundaries. Check denied requests, network failure/retry, server logs and database audit records before production rollout.

The published SCMS private visual review has no backend connection and cannot run this integration. This repair does not activate payments, alter real athletes or deploy Hostinger/Supabase production changes.
