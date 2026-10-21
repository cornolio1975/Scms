# SCMS Database Migration Reproducibility

The live SCMS Supabase database is currently authoritative.

## Current status

The live migration history contains these versions:

- 0000 initial_schema
- 0001 csv_and_sync
- 0002 rbac_and_approvals
- 0003 multi_club
- 0004 rpc_functions
- 0005 fix_user_roles_rls
- 20261021130639 consolidate_tenant_rls_policies
- 20261021130741 secure_integration_rls_and_functions
- 20261021131006 lock_down_legacy_state_and_rpc_grants
- 20261021131130 index_foreign_keys_and_optimize_rls
- 20261021131143 consolidate_role_and_branch_policies
- 20261021131834 align_user_role_enum_with_application
- 20261021131906 create_normalized_member_domain
- 20261021131916 secure_normalized_member_domain
- 20261021131932 optimize_normalized_member_domain
- 20261021132324 normalize_missing_legacy_dojos
- 20261021132900 migrate_legacy_members_to_normalized_domain
- 20261021133456 create_atomic_member_rpc
- 20261021133901 restore_legacy_member_athlete_roles

The repository does not yet contain a one-file-per-live-history reconstruction. Some repository migrations intentionally consolidate multiple live changes.

## Safety rule

Do not invent historical migration SQL or mark missing migrations as synchronized without reconstructing them from the live schema and validating a fresh deployment.

Do not delete or rewrite live migration history merely to make filenames match.

## Required release work

1. Reconstruct the missing baseline changes represented by live versions 0002 through 0005 from the current schema and known application requirements.
2. Ensure the tenant RLS, integration security, legacy-state lockdown, FK indexes, role/branch policy consolidation, normalized member security/indexes, and dojo normalization are represented reproducibly in repository SQL.
3. Validate the complete repository migration chain against a disposable database or Supabase development branch before production merge.
4. Preserve KarateTech participant UUID compatibility and legacy cms_state rollback/reference data.
