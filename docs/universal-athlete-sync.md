# Universal athlete profiles

Implemented with KarateTech as the canonical personal-profile service. SCMS and KarateTech remain in separate Supabase organizations and retain separate credentials. All cross-organization traffic uses the existing authenticated HTTPS integration. No database connection or service-role key crosses between the applications.

## Scope and ownership

Shared: full name, gender, date of birth, IC/passport, contact email and phone, address, nationality code, emergency contact name and phone, weight, height and photo URL.

Independent: SCMS member ID, club and branch membership, assigned coach, rank and grading, discipline selections, tournament registration, categories, brackets, payments, medical clearance, scores and results. Auth/login email is not changed by athlete contact-email edits. Neither Kumite nor Kata scoring/panel code was modified.

An athlete has a permanent UUID; normalized IC/passport locates initial identities, and old IC aliases remain linked after corrections. Names, email and club names never establish identity. Separate member IDs can link the same athlete across branches. A tournament entry cannot silently switch its club/branch representation.

## Conflict and retry contract

The canonical service serializes profile writes, keeps revision history and requires the last accepted revision for changed profiles. Identical retries do not create revisions. A stale profile returns HTTP 409 with the canonical revision. An unchanged local copy can pull a remote-only edit. Concurrent local and remote changes remain a conflict.

SCMS commits a received profile and its synchronization baseline in one transaction, checking both the original member snapshot and the accepted revision. A member edited during the HTTP round trip is retained and retried. Open member directories refresh every 60 seconds. The authenticated worker processes up to ten queued/saved database members per invocation, five concurrently, oldest first. Browser-only records sync while their directory is open, require a database-verified system administrator, and retain the baseline on the browser member. They are not available to a server cron until persisted/imported.

Use **Sync profile** in Members / Athletes to inspect conflicting personal fields. **Keep club details** and **Use universal details** are explicit, revision-checked decisions. A membership/identity collision requires an administrator to reconcile the membership; it cannot be overridden as a personal-detail conflict.

## Deployment order: separate organizations

1. Back up both application databases using each organization's own credentials. Preserve original athlete/member IDs and membership relationships.
2. Review existing normalized-IC duplicates. The KarateTech migration atomically stops on inconsistent pre-existing profiles instead of selecting a winner. The SCMS migration stops on duplicate identities in the same branch. Reconcile those records explicitly; do not delete/merge records or rewrite tournament results as a workaround.
3. Apply KarateTech `supabase/migrations/20261110234556_universal_athlete_profiles.sql` to the **KarateTech database only**, after the existing SCMS receiver migrations. Private profile/history/alias tables use RLS, no browser grants and fixed function search paths. Only `service_role` executes the integration RPC.
4. Build and deploy KarateTech using **`npm run build:server`**, not the default static export build. Keep `SCMS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and the existing tournament receiver configuration on its server.
5. Apply SCMS `supabase/migrations/20261110234557_universal_athlete_sync.sql` to the **SCMS database only**. This supplies the roster table on older installations plus private sync tracking and a service-only apply RPC. Existing roster tables are preserved.
6. Deploy SCMS with `npm run build`. Its `SUPABASE_SERVICE_ROLE_KEY` belongs to **SCMS**, and its existing `KARATETECH_API_KEY` must match KarateTech's **integration** `SCMS_API_KEY`. `KARATETECH_API_URL` points to the KarateTech Node.js application. Do not copy either database's service-role key into the other application or into `NEXT_PUBLIC_*` settings.
7. Set a separate server-only `ATHLETE_SYNC_CRON_SECRET` and `SCMS_APP_URL` on SCMS. Configure the hosting scheduler to run `node scripts/sync-athlete-profiles.mjs` every minute with those environment variables. The script logs counts only, never credentials or profiles. The worker accepts POST with Bearer authentication. No ChatGPT automation is needed.
8. Refresh all old client tabs after deployment. Legacy browser-only clubs need authorized import/persistence for unattended synchronization; browser refresh alone does not turn localStorage into a server database.

## Hosted acceptance checks

- Confirm the two actual project references in their respective organizations before applying anything. The connected account in this development session listed only Command Center and LMS; neither production migration was applied.
- Verify an authorized edit in branch A updates the same athlete's linked personal details in KarateTech and branch B; another athlete sharing the parent's email stays unchanged.
- Edit a participant in KarateTech, run the SCMS worker, and verify the club roster receives it.
- Make edits on both sides and resolve the displayed conflict. Submit a stale revision and verify it is rejected.
- Verify cross-branch users cannot write each other's memberships, and a foreign branch ID is rejected.
- Compare tournament categories, bracket/bout records, scores, payment and medical status before and after; they must be identical for a profile-only sync.
- Test retries and a network outage. Saved data must remain available and queued work must recover.
- Run Supabase security advisors separately in each organization. Inspect the worker schedule and logs after a full polling cycle.

## Rollback

Stop the worker first. Keep the additive profile/alias/history tables and IDs as evidence; do not drop them or restore a database backup over new tournament results. Revert application branches only after checking compatibility with revision-enforced profile edits. Resolve migration-preflight failures without applying partial SQL. Both migrations use transactions.
