-- Normalized SCMS member domain
-- Mirrors live migrations 20261021131906 through 20261021131932.
create unique index if not exists club_branches_id_club_unique on public.club_branches(id, club_id);

create table if not exists public.members (
 id uuid primary key default gen_random_uuid(), member_no text not null unique,
 club_id uuid not null references public.clubs(id) on delete restrict, branch_id uuid not null,
 profile_id uuid references public.profiles(id) on delete set null, full_name text not null,
 preferred_name text, gender text, date_of_birth date, ic_passport text, nationality text,
 email text, phone text, status text not null default 'ACTIVE', joined_date date,
 sport_data jsonb not null default '{}'::jsonb, medical_notes text,
 emergency_contact jsonb not null default '{}'::jsonb, legacy_member_id text unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(branch_id,club_id) references public.club_branches(id,club_id) on delete restrict
);
create table if not exists public.member_roles (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id) on delete cascade,
 role public.user_role_type not null, club_id uuid not null references public.clubs(id) on delete restrict,
 branch_id uuid references public.club_branches(id) on delete restrict, granted_at timestamptz not null default now(),
 granted_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists member_roles_scope_unique on public.member_roles(member_id,role,club_id,coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid));
create table if not exists public.volunteer_profiles (
 member_id uuid primary key references public.members(id) on delete cascade, skills text[] not null default '{}',
 preferred_duties text[] not null default '{}', certifications text[] not null default '{}',
 availability text[] not null default '{}', status text not null default 'ACTIVE',
 total_hours numeric(10,2) not null default 0 check(total_hours>=0), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.guardian_relationships (
 id uuid primary key default gen_random_uuid(), child_member_id uuid not null references public.members(id) on delete cascade,
 guardian_profile_id uuid references public.profiles(id) on delete set null,
 guardian_member_id uuid references public.members(id) on delete set null,
 guardian_name text not null, relationship text not null, phone text, email text,
 is_primary boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists members_club_id_idx on public.members(club_id);
create index if not exists members_branch_id_idx on public.members(branch_id);
create index if not exists members_profile_id_idx on public.members(profile_id);
create index if not exists members_branch_club_idx on public.members(branch_id,club_id);
create index if not exists member_roles_member_id_idx on public.member_roles(member_id);
create index if not exists member_roles_club_id_idx on public.member_roles(club_id);
create index if not exists member_roles_branch_id_idx on public.member_roles(branch_id);
create index if not exists member_roles_granted_by_idx on public.member_roles(granted_by);
create index if not exists guardian_child_member_idx on public.guardian_relationships(child_member_id);
create index if not exists guardian_profile_idx on public.guardian_relationships(guardian_profile_id);
create index if not exists guardian_member_idx on public.guardian_relationships(guardian_member_id);

alter table public.members enable row level security;
alter table public.member_roles enable row level security;
alter table public.volunteer_profiles enable row level security;
alter table public.guardian_relationships enable row level security;
grant select,insert,update,delete on public.members,public.member_roles,public.volunteer_profiles,public.guardian_relationships to authenticated,service_role;

drop policy if exists "Authorized users view members" on public.members;
create policy "Authorized users view members" on public.members for select to authenticated using (
 public.is_superadmin() or public.is_club_admin(club_id) or profile_id=(select auth.uid())
 or exists(select 1 from public.user_roles ur where ur.user_id=(select auth.uid()) and ur.club_id=members.club_id and (ur.branch_id is null or ur.branch_id=members.branch_id))
);
drop policy if exists "Authorized admins insert members" on public.members;
create policy "Authorized admins insert members" on public.members for insert to authenticated with check(public.is_superadmin() or public.is_club_admin(club_id) or public.is_branch_manager(branch_id));
drop policy if exists "Authorized admins update members" on public.members;
create policy "Authorized admins update members" on public.members for update to authenticated using(public.is_superadmin() or public.is_club_admin(club_id) or public.is_branch_manager(branch_id)) with check(public.is_superadmin() or public.is_club_admin(club_id) or public.is_branch_manager(branch_id));
drop policy if exists "Authorized admins delete members" on public.members;
create policy "Authorized admins delete members" on public.members for delete to authenticated using(public.is_superadmin() or public.is_club_admin(club_id) or public.is_branch_manager(branch_id));

drop policy if exists "Authorized users view member roles" on public.member_roles;
create policy "Authorized users view member roles" on public.member_roles for select to authenticated using(public.is_superadmin() or public.is_club_admin(club_id) or public.is_branch_manager(branch_id) or exists(select 1 from public.members m where m.id=member_roles.member_id and m.profile_id=(select auth.uid())));
drop policy if exists "Authorized admins insert member roles" on public.member_roles;
create policy "Authorized admins insert member roles" on public.member_roles for insert to authenticated with check(public.is_superadmin() or(public.is_club_admin(club_id) and role not in('SUPERADMIN','SYSTEM_ADMIN','CLUB_ADMIN','CLUB_CO_ADMIN')) or(public.is_branch_manager(branch_id) and role not in('SUPERADMIN','SYSTEM_ADMIN','CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN')));
drop policy if exists "Authorized admins update member roles" on public.member_roles;
create policy "Authorized admins update member roles" on public.member_roles for update to authenticated using(public.is_superadmin() or public.is_club_admin(club_id) or public.is_branch_manager(branch_id)) with check(public.is_superadmin() or(public.is_club_admin(club_id) and role not in('SUPERADMIN','SYSTEM_ADMIN','CLUB_ADMIN','CLUB_CO_ADMIN')) or(public.is_branch_manager(branch_id) and role not in('SUPERADMIN','SYSTEM_ADMIN','CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN')));
drop policy if exists "Authorized admins delete member roles" on public.member_roles;
create policy "Authorized admins delete member roles" on public.member_roles for delete to authenticated using(public.is_superadmin() or public.is_club_admin(club_id) or public.is_branch_manager(branch_id));

drop policy if exists "Authorized users view volunteer profiles" on public.volunteer_profiles;
create policy "Authorized users view volunteer profiles" on public.volunteer_profiles for select to authenticated using(exists(select 1 from public.members m where m.id=volunteer_profiles.member_id and(public.is_superadmin() or public.is_club_admin(m.club_id) or public.is_branch_manager(m.branch_id) or m.profile_id=(select auth.uid()))));
drop policy if exists "Authorized admins insert volunteer profiles" on public.volunteer_profiles;
create policy "Authorized admins insert volunteer profiles" on public.volunteer_profiles for insert to authenticated with check(exists(select 1 from public.members m where m.id=volunteer_profiles.member_id and(public.is_superadmin() or public.is_club_admin(m.club_id) or public.is_branch_manager(m.branch_id))));
drop policy if exists "Authorized admins update volunteer profiles" on public.volunteer_profiles;
create policy "Authorized admins update volunteer profiles" on public.volunteer_profiles for update to authenticated using(exists(select 1 from public.members m where m.id=volunteer_profiles.member_id and(public.is_superadmin() or public.is_club_admin(m.club_id) or public.is_branch_manager(m.branch_id)))) with check(exists(select 1 from public.members m where m.id=volunteer_profiles.member_id and(public.is_superadmin() or public.is_club_admin(m.club_id) or public.is_branch_manager(m.branch_id))));
drop policy if exists "Authorized admins delete volunteer profiles" on public.volunteer_profiles;
create policy "Authorized admins delete volunteer profiles" on public.volunteer_profiles for delete to authenticated using(exists(select 1 from public.members m where m.id=volunteer_profiles.member_id and(public.is_superadmin() or public.is_club_admin(m.club_id) or public.is_branch_manager(m.branch_id))));

drop policy if exists "Authorized users view guardian relationships" on public.guardian_relationships;
create policy "Authorized users view guardian relationships" on public.guardian_relationships for select to authenticated using(exists(select 1 from public.members m where m.id=guardian_relationships.child_member_id and(public.is_superadmin() or public.is_club_admin(m.club_id) or public.is_branch_manager(m.branch_id) or m.profile_id=(select auth.uid()) or guardian_profile_id=(select auth.uid()))));
drop policy if exists "Authorized admins insert guardian relationships" on public.guardian_relationships;
create policy "Authorized admins insert guardian relationships" on public.guardian_relationships for insert to authenticated with check(exists(select 1 from public.members m where m.id=guardian_relationships.child_member_id and(public.is_superadmin() or public.is_club_admin(m.club_id) or public.is_branch_manager(m.branch_id))));
drop policy if exists "Authorized admins update guardian relationships" on public.guardian_relationships;
create policy "Authorized admins update guardian relationships" on public.guardian_relationships for update to authenticated using(exists(select 1 from public.members m where m.id=guardian_relationships.child_member_id and(public.is_superadmin() or public.is_club_admin(m.club_id) or public.is_branch_manager(m.branch_id)))) with check(exists(select 1 from public.members m where m.id=guardian_relationships.child_member_id and(public.is_superadmin() or public.is_club_admin(m.club_id) or public.is_branch_manager(m.branch_id))));
drop policy if exists "Authorized admins delete guardian relationships" on public.guardian_relationships;
create policy "Authorized admins delete guardian relationships" on public.guardian_relationships for delete to authenticated using(exists(select 1 from public.members m where m.id=guardian_relationships.child_member_id and(public.is_superadmin() or public.is_club_admin(m.club_id) or public.is_branch_manager(m.branch_id))));
