# Branch manager onboarding and scope

New manager emails can be created from either branch manager assignment dialog.
New accounts sign in with Password123! and are redirected to change their
password; the replacement must differ and contain at least eight characters.
Existing accounts retain their passwords. Manager assignment is authorized on
the server and validates that the branch belongs to the administrator's club.
Replacing a branch manager removes the previous manager's role for that branch.

The branch dashboard uses trusted database roles and branch-filtered queries.
Branch managers cannot select all branches or pass another branch through the
URL. Platform KPI queries now require a platform administrator.

## Release checks

- Apply 20261112133142_branch_manager_scope_guard.sql to staging first. The
  restrictive policies cover UUID branch_id tables and club_branches; they
  intersect existing permissions and do not grant new write access.
- Verify existing permissive policies still permit the intended assigned-branch
  writes. Check data reachable through tables without a branch_id separately.
- Require SUPABASE_SERVICE_ROLE_KEY on the server; never expose it to clients.
- Run authenticated staging checks: create new manager, sign in, change password,
  view dashboard, create/update own branch member, reject another branch and
  blank/all-branch requests, and revoke the replaced manager's access.
- Manager role and branch updates use separate Supabase requests; inspect/retry
  failed assignments before release. A transaction-backed RPC is recommended
  before treating assignment as atomic under concurrent administrative changes.

Local verification includes seven server scope tests, TypeScript and the Next
production build. No live credentials were available during development, so no
live account creation, SQL application, or deployed browser test is claimed.
