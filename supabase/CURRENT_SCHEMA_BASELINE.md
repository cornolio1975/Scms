# SCMS Verified Current Schema Baseline

This document records facts recovered directly from the live SCMS Supabase project on 2026-10-21.

It is a reproducibility reference, not a replacement for Supabase migration history. The historical SQL for live migrations `0002` through `0005` is not known exactly and must not be invented.

## Public tables

The live public schema contains 16 RLS-enabled tables:

- approval_requests
- audit_logs
- club_branches
- clubs
- cms_state
- csv_conflicts
- csv_history
- guardian_relationships
- member_roles
- members
- profiles
- scms_karatetech_participant_links
- sync_history
- sync_jobs
- user_roles
- volunteer_profiles

## Recovered missing-baseline tables

### approval_requests

Columns:
- id uuid primary key default uuid_generate_v4()
- user_id uuid nullable
- club_id uuid nullable
- branch_id uuid nullable
- requested_role user_role_type not null
- status text default 'PENDING_APPROVAL'
- reviewed_by uuid nullable
- reviewed_at timestamptz nullable
- created_at timestamptz default now()
- updated_at timestamptz default now()
- request_type text default 'ROLE_ASSIGNMENT'
- previous_data jsonb nullable
- requested_data jsonb nullable

Foreign keys:
- user_id -> profiles(id) ON DELETE CASCADE
- club_id -> clubs(id) ON DELETE CASCADE
- branch_id -> club_branches(id) ON DELETE CASCADE
- reviewed_by -> profiles(id)

Checks:
- status IN ('PENDING_APPROVAL','APPROVED','REJECTED')
- request_type IN ('ROLE_ASSIGNMENT','PARTICIPANT_CHANGE','KARATETECH_RECONCILIATION')

Indexes:
- approval_requests_pkey(id)
- idx_approval_requests_branch_id(branch_id)
- idx_approval_requests_club(club_id,status)
- idx_approval_requests_reviewed_by(reviewed_by)
- idx_approval_requests_user_id(user_id)

Current RLS:
- authenticated SELECT: own request, Super Admin, or Club Admin for club
- authenticated INSERT/UPDATE/DELETE: Super Admin or Club Admin for club

### sync_jobs

Columns:
- id uuid primary key default uuid_generate_v4()
- participant_id text not null
- club_id uuid nullable
- operation text not null
- direction text not null
- status text not null
- attempts integer default 0
- scheduled_at timestamptz default now()
- started_at timestamptz nullable
- completed_at timestamptz nullable
- error text nullable
- payload jsonb nullable
- result jsonb nullable
- created_at timestamptz default now()
- updated_at timestamptz default now()

Foreign key:
- club_id -> clubs(id)

Checks:
- direction IN ('SCMS_TO_KT','KT_TO_SCMS')
- status IN ('PENDING','PROCESSING','COMPLETED','FAILED','RETRYING')

Indexes:
- sync_jobs_pkey(id)
- idx_sync_jobs_club_id(club_id)
- idx_sync_jobs_status_scheduled(status,scheduled_at)

Current RLS:
- authenticated ALL: Super Admin or Club Admin for club

### cms_state

Columns:
- id text primary key
- data jsonb not null
- updated_at timestamptz not null default now()

Current RLS:
- authenticated ALL: Super Admin only

Legacy cms_state remains a rollback/reference source and must not be removed during normalization.

## Public functions

The live public schema currently contains:
- auto_confirm_email()
- create_member_atomic(uuid,uuid,text,text,date,text,text,text,text,numeric,boolean,boolean)
- find_profile_by_email(text)
- handle_new_user()
- is_branch_manager(uuid)
- is_club_admin(uuid)
- is_superadmin()
- rls_auto_enable()

All are SECURITY DEFINER with fixed search_path configuration.

Execution grants recovered from live state:
- anon: none of the above functions
- authenticated: create_member_atomic, is_branch_manager, is_club_admin, is_superadmin
- service_role: all eight functions

find_profile_by_email authenticated execution was intentionally revoked on 2026-10-21 after verifying no repository, RLS-policy, or trigger dependency.

## Auth triggers

Live auth.users triggers:
- BEFORE INSERT: on_auth_user_created_auto_confirm -> auto_confirm_email()
- AFTER INSERT: on_auth_user_created -> handle_new_user()

The live handle_new_user() is newer than the implementation in repository migration 0000. In addition to creating profiles, it can create a club from signup metadata and assign CLUB_ADMIN.

## Reproducibility rule

Do not manufacture files named 0002-0005 and imply they are the original historical SQL.

For a fresh-deploy guarantee:
1. Build a consolidated current-state migration/baseline from verified catalog metadata.
2. Preserve existing historical migration records.
3. Validate the repository chain/current-state baseline against a disposable Supabase project or development branch.
4. Compare tables, columns, constraints, indexes, functions, grants, triggers, RLS policies and required seed/reference data.
5. Preserve KarateTech participant UUID compatibility and legacy cms_state data.
