-- Additive normalized compatibility layer. Existing UUID identities are preserved.
create schema if not exists scms_private;
revoke all on schema scms_private from public,anon;
grant usage on schema scms_private to authenticated,service_role;
create table if not exists public.members(id uuid primary key default gen_random_uuid(),member_no text unique,club_id uuid references public.clubs,branch_id uuid references public.club_branches,profile_id uuid references public.profiles,full_name text not null,preferred_name text,gender text,date_of_birth date,ic_passport text,nationality text,email text,phone text,status text default 'ACTIVE',joined_date date default current_date,sport_data jsonb default '{}',medical_notes text,emergency_contact jsonb default '{}',legacy_member_id text unique,created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists public.member_roles(id uuid primary key default gen_random_uuid(),member_id uuid references public.members,role public.user_role_type,club_id uuid references public.clubs,branch_id uuid references public.club_branches,granted_at timestamptz default now(),granted_by uuid references public.profiles);
create table if not exists public.guardian_relationships(id uuid primary key default gen_random_uuid(),child_member_id uuid references public.members,guardian_profile_id uuid references public.profiles,guardian_member_id uuid references public.members,guardian_name text,relationship text,phone text,email text,is_primary boolean default true,created_at timestamptz default now());
create table if not exists public.volunteer_profiles(member_id uuid primary key references public.members,skills text[] default '{}',preferred_duties text[] default '{}',certifications text[] default '{}',availability text[] default '{}',status text default 'ACTIVE',total_hours numeric default 0 check(total_hours>=0),notes text,created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists public.approval_requests(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles,club_id uuid references public.clubs,branch_id uuid references public.club_branches,requested_role public.user_role_type,status text default 'PENDING_APPROVAL',reviewed_by uuid references public.profiles,reviewed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),request_type text default 'ROLE_ASSIGNMENT',previous_data jsonb,requested_data jsonb);
alter table public.clubs add column if not exists display_name varchar(30);
alter table public.clubs add column if not exists approval_status text default 'APPROVED';
alter table public.user_roles add column if not exists participant_status text default 'ACTIVE';
alter table public.members add column if not exists membership_expires_on date;
alter table public.scms_karatetech_participant_links add column if not exists last_error text;
alter table public.scms_karatetech_participant_links add column if not exists last_attempted_sync_at timestamptz;
alter table public.scms_karatetech_participant_links add column if not exists retry_count integer not null default 0;
alter table public.sync_history add column if not exists request_id text;
create table if not exists public.scms_records(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('task','approval','invoice','receipt','transfer','bank','session','attendance','event','subscription','draft','plan')),club_id uuid references public.clubs,branch_id uuid references public.club_branches,member_id uuid references public.members,data jsonb not null default '{}',version integer not null default 1,created_by uuid references public.profiles default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists scms_records_scope on public.scms_records(club_id,branch_id,kind,created_at desc);
create index if not exists scms_members_scope on public.members(club_id,branch_id);
create index if not exists scms_guardian_profile on public.guardian_relationships(guardian_profile_id,child_member_id);
create index if not exists scms_roles_user_scope on public.user_roles(user_id,club_id,branch_id);
-- Deliberately non-unique for existing data: duplicate prevention below is serialized per club.
create index if not exists scms_member_identity_lookup on public.members(club_id,date_of_birth,lower(full_name));
create unique index if not exists scms_receipt_reference on public.scms_records(club_id,(data->>'reference')) where kind='receipt';
create unique index if not exists scms_bank_scope on public.scms_records(club_id,coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid)) where kind='bank';
create table if not exists public.scms_payment_attempts(id uuid primary key default gen_random_uuid(),invoice_id uuid not null references public.scms_records,club_id uuid not null references public.clubs,branch_id uuid references public.club_branches,amount_sen bigint not null check(amount_sen>0),provider text not null default 'billplz',provider_bill_id text unique,checkout_url text,status text not null default 'CREATING' check(status in ('CREATING','PENDING','PAID','FAILED','REVIEW')),created_by uuid references public.profiles,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index if not exists scms_one_checkout on public.scms_payment_attempts(invoice_id) where status in ('CREATING','PENDING');
-- Permission helpers run outside exposed schemas, never accept a user ID from callers.
create or replace function scms_private.allowed(c uuid,b uuid default null,roles text[] default null) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.status::text='ACTIVE') and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and (r.role::text in ('SUPERADMIN','SYSTEM_ADMIN') or (r.club_id=c and (r.branch_id is null or r.branch_id=b) and (roles is null or r.role::text=any(roles)))))
$$;
create or replace function scms_private.member_visible(m uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.members x where x.id=m and (scms_private.allowed(x.club_id,x.branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','STAFF','COACH','ASSISTANT_COACH','REGISTRATION_OFFICER','FINANCE','OBSERVER']) or x.profile_id=auth.uid() or exists(select 1 from public.guardian_relationships g where g.child_member_id=x.id and g.guardian_profile_id=auth.uid()))) and exists(select 1 from public.profiles where id=auth.uid() and status::text='ACTIVE')
$$;
create or replace function scms_private.payer(m uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.members x where x.id=m and (x.profile_id=auth.uid() or exists(select 1 from public.guardian_relationships g where g.child_member_id=x.id and g.guardian_profile_id=auth.uid()))) and exists(select 1 from public.profiles where id=auth.uid() and status::text='ACTIVE')
$$;
revoke all on function scms_private.allowed(uuid,uuid,text[]),scms_private.member_visible(uuid),scms_private.payer(uuid) from public,anon;
grant execute on function scms_private.allowed(uuid,uuid,text[]),scms_private.member_visible(uuid),scms_private.payer(uuid) to authenticated,service_role;
-- Replace old permissive policies on these tables; no records are removed.
do $$ declare t text;p record;begin
 foreach t in array array['clubs','club_branches','user_roles','members','member_roles','guardian_relationships','volunteer_profiles','csv_history','csv_conflicts','sync_history','scms_karatetech_participant_links','audit_logs','scms_records','scms_payment_attempts','approval_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t);end loop;
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;end $$;
create policy clubs_scope on public.clubs for select to authenticated using(primary_admin_id=auth.uid() or scms_private.allowed(id,null,null) or exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.club_id=clubs.id));
create policy branches_scope on public.club_branches for select to authenticated using(scms_private.allowed(club_id,id,null));
create policy roles_scope on public.user_roles for select to authenticated using(user_id=auth.uid() or scms_private.allowed(club_id,branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN']));
create policy members_scope on public.members for select to authenticated using(scms_private.member_visible(id));
create policy member_roles_scope on public.member_roles for select to authenticated using(scms_private.member_visible(member_id));
create policy guardians_scope on public.guardian_relationships for select to authenticated using(guardian_profile_id=auth.uid() or scms_private.member_visible(child_member_id));
create policy volunteers_scope on public.volunteer_profiles for select to authenticated using(scms_private.member_visible(member_id));
create policy csv_scope on public.csv_history for select to authenticated using(user_id=auth.uid() or scms_private.allowed(null,null,null));
create policy csv_conflicts_scope on public.csv_conflicts for select to authenticated using(exists(select 1 from public.csv_history h where h.id=import_id));
create policy history_scope on public.sync_history for select to authenticated using(scms_private.allowed(club_id,null,array['CLUB_ADMIN','CLUB_CO_ADMIN','OBSERVER']) or exists(select 1 from public.members m where m.id::text=scms_participant_id and scms_private.allowed(m.club_id,m.branch_id,array['BRANCH_MANAGER','BRANCH_CO_ADMIN'])));
create policy links_scope on public.scms_karatetech_participant_links for select to authenticated using(exists(select 1 from public.members m where m.id::text=scms_member_id and scms_private.allowed(m.club_id,m.branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','OBSERVER'])));
alter table public.audit_logs add column if not exists club_id uuid references public.clubs;
alter table public.audit_logs add column if not exists branch_id uuid references public.club_branches;
create policy audit_scope on public.audit_logs for select to authenticated using(scms_private.allowed(club_id,branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','OBSERVER']));
create policy records_scope on public.scms_records for select to authenticated using(
 (kind in ('task','approval','session','attendance','event','subscription','draft','plan') and scms_private.allowed(club_id,branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','COACH','ASSISTANT_COACH','STAFF','REGISTRATION_OFFICER','OBSERVER'])) or
 (kind in ('invoice','receipt','transfer','plan') and (scms_private.allowed(club_id,branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','FINANCE','OBSERVER']) or scms_private.payer(member_id))) or
 (kind='bank' and scms_private.allowed(club_id,branch_id,null)) or (created_by=auth.uid() and kind='approval') or (member_id is not null and kind in ('attendance','subscription') and scms_private.payer(member_id)));
create policy attempts_scope on public.scms_payment_attempts for select to authenticated using(exists(select 1 from public.scms_records r where r.id=invoice_id));
create policy legacy_approvals_scope on public.approval_requests for select to authenticated using(user_id=auth.uid() or scms_private.allowed(club_id,branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','OBSERVER']));
-- Revoke the old direct creation RPC: all member writes now validate identity and scope atomically.
do $$ begin if to_regprocedure('public.create_member_atomic(uuid,uuid,text,text,date,text,text,text,text,numeric,boolean,boolean)') is not null then execute 'revoke execute on function public.create_member_atomic(uuid,uuid,text,text,date,text,text,text,text,numeric,boolean,boolean) from public,anon,authenticated';end if;end $$;
create or replace function scms_private.command(a text,d jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();c uuid:=nullif(d->>'clubId','')::uuid;b uuid:=nullif(d->>'branchId','')::uuid;mid uuid:=nullif(d->>'memberId','')::uuid;rid uuid:=nullif(d->>'id','')::uuid;rec public.scms_records;inv public.scms_records;res jsonb;v uuid;amt bigint;paid bigint;ref text;k text;g jsonb;target public.members;lr public.approval_requests;decision text;
begin
 if uid is null then raise exception 'Sign in required' using errcode='42501';end if;
 if a='club-register' then
  if not exists(select 1 from public.profiles where id=uid and status::text in ('ACTIVE','PENDING')) then raise exception 'Account unavailable' using errcode='42501';end if;
  if length(trim(d->>'name')) not between 2 and 120 or length(trim(d->>'displayName')) not between 1 and 30 then raise exception 'Club name and display name are required';end if;
  if exists(select 1 from public.clubs where primary_admin_id=uid) then raise exception 'A club is already registered for this account';end if;
  insert into public.clubs(name,display_name,sport,primary_admin_id,status,approval_status) values(trim(d->>'name'),trim(d->>'displayName'),coalesce(d->>'sport','Karate'),uid,'Submitted','PENDING_APPROVAL') returning id into c;
  insert into public.scms_records(kind,club_id,data,created_by) values('approval',c,jsonb_build_object('type','Club Registration','title',d->>'name','status','Pending','ownerId',uid),uid) returning id into v;
  res:=jsonb_build_object('id',c);
 else
  if not exists(select 1 from public.profiles where id=uid and status::text='ACTIVE') then raise exception 'Account approval required' using errcode='42501';end if;
  if a in ('approval-decide','task-status','transfer-review') then
   select * into rec from public.scms_records where id=rid for update;if not found then raise exception 'Record unavailable';end if;c:=rec.club_id;b:=rec.branch_id;mid:=rec.member_id;
  end if;
  if b is not null and not exists(select 1 from public.club_branches where id=b and club_id=c) then raise exception 'Branch does not belong to club';end if;
  if a='member-create' then
   if not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','REGISTRATION_OFFICER']) then raise exception 'Member access denied' using errcode='42501';end if;
   if b is null or length(trim(d->>'fullName')) not between 2 and 150 or (d->>'dob')::date>current_date then raise exception 'Name, branch and valid date of birth required';end if;
   perform pg_advisory_xact_lock(hashtextextended(c::text,0));
   if exists(select 1 from public.members m where m.club_id=c and ((lower(regexp_replace(trim(m.full_name),'\s+',' ','g'))=lower(regexp_replace(trim(d->>'fullName'),'\s+',' ','g')) and m.date_of_birth=(d->>'dob')::date) or (nullif(trim(d->>'icPassport'),'') is not null and lower(m.ic_passport)=lower(trim(d->>'icPassport'))))) then raise exception 'Similar member already exists. Review name, DOB and identity number.' using errcode='23505';end if;
   v:=gen_random_uuid();insert into public.members(id,member_no,club_id,branch_id,full_name,gender,date_of_birth,ic_passport,email,phone,status,sport_data) values(v,'SCMS-'||upper(replace(v::text,'-','')),c,b,trim(d->>'fullName'),d->>'gender',(d->>'dob')::date,nullif(trim(d->>'icPassport'),''),nullif(d->>'email',''),nullif(d->>'phone',''),'ACTIVE',jsonb_build_object('isAthlete',coalesce((d->>'isAthlete')::boolean,true),'isVolunteer',coalesce((d->>'isVolunteer')::boolean,false),'participantStatus','PENDING_APPROVAL','weightKg',d->'weightKg','beltRank',d->>'beltRank'));
   insert into public.member_roles(member_id,club_id,branch_id,role,granted_by) values(v,c,b,'MEMBER',uid);
   if coalesce((d->>'isAthlete')::boolean,true) then insert into public.member_roles(member_id,club_id,branch_id,role,granted_by) values(v,c,b,'ATHLETE',uid);end if;
   if coalesce((d->>'isVolunteer')::boolean,false) then insert into public.member_roles(member_id,club_id,branch_id,role,granted_by) values(v,c,b,'VOLUNTEER',uid);insert into public.volunteer_profiles(member_id) values(v);end if;
   insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values('approval',c,b,v,jsonb_build_object('type','Pending Member','title',d->>'fullName','status','Pending'),uid);
   res:=jsonb_build_object('id',v);
  elsif a='member-link-login' then
   select * into target from public.members where id=mid for update;
   if not found or not scms_private.allowed(target.club_id,target.branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN']) then raise exception 'Member access denied' using errcode='42501';end if;c:=target.club_id;b:=target.branch_id;
   if lower(trim(coalesce(target.email,'')))<>lower(trim(coalesce(d->>'email',''))) or nullif(target.email,'') is null then raise exception 'Use the member email recorded on the member profile';end if;
   select id into v from public.profiles where lower(email)=lower(trim(d->>'email')) and status::text='ACTIVE';if v is null then raise exception 'An approved account with this email is required';end if;
   if target.profile_id is not null and target.profile_id<>v then raise exception 'Member already has a linked account. Request platform review before reassignment';end if;
   update public.members set profile_id=v,updated_at=now() where id=mid;
   if not exists(select 1 from public.user_roles where user_id=v and club_id=c and branch_id is not distinct from b and role::text='MEMBER') then insert into public.user_roles(user_id,club_id,branch_id,role,participant_status) values(v,c,b,'MEMBER','ACTIVE');end if;
   res:=jsonb_build_object('id',mid);
  elsif a='guardian-save' then
   select * into target from public.members where id=mid;if not found then raise exception 'Member unavailable';end if;c:=target.club_id;b:=target.branch_id;
   if not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN']) then raise exception 'Guardian access denied' using errcode='42501';end if;
   if length(trim(d->>'name'))<2 or coalesce(d->>'relationship','') not in ('Father','Mother','Guardian','Spouse','Other') then raise exception 'Guardian name and relationship required';end if;
   if nullif(d->>'profileId','') is not null and not exists(select 1 from public.user_roles r where r.user_id=(d->>'profileId')::uuid and r.club_id=c and r.role::text='PARENT') then raise exception 'Guardian login must have a Parent role in this club';end if;
   insert into public.guardian_relationships(child_member_id,guardian_profile_id,guardian_name,relationship,phone,email) values(mid,nullif(d->>'profileId','')::uuid,trim(d->>'name'),d->>'relationship',d->>'phone',d->>'email') returning id into v;res:=jsonb_build_object('id',v);
  elsif a='branch-create' then
   if not scms_private.allowed(c,null,array['CLUB_ADMIN','CLUB_CO_ADMIN']) then raise exception 'Club administrator required' using errcode='42501';end if;
   if length(trim(d->>'name'))<2 then raise exception 'Branch name required';end if;
   insert into public.club_branches(club_id,name,venue_name,address,status) values(c,trim(d->>'name'),d->>'venue',d->>'address','Active') returning id into v;res:=jsonb_build_object('id',v);
  elsif a='approval-decide' then
   if rec.kind<>'approval' or rec.data->>'status'<>'Pending' then raise exception 'Approval is no longer pending' using errcode='40001';end if;
   if rec.data->>'type'='Club Registration' then
    if not scms_private.allowed(null,null,null) then raise exception 'Platform administrator required' using errcode='42501';end if;
   elsif not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN']) then raise exception 'Club administrator required' using errcode='42501';end if;
   decision:=d->>'decision';if decision not in ('Approved','Rejected') then raise exception 'Invalid decision';end if;
   update public.scms_records set data=data||jsonb_build_object('status',decision,'notes',left(d->>'notes',2000),'reviewedBy',uid,'reviewedAt',now()),version=version+1,updated_at=now() where id=rid;
   if rec.data->>'type'='Club Registration' then
    update public.clubs set status=case when decision='Approved' then 'Active' else 'Rejected' end,approval_status=upper(decision) where id=c;
    if decision='Approved' then insert into public.user_roles(user_id,club_id,role) values((rec.data->>'ownerId')::uuid,c,'CLUB_ADMIN');update public.profiles set status='ACTIVE' where id=(rec.data->>'ownerId')::uuid;end if;
   elsif mid is not null then
    if rec.data->>'type'='Participant Change' and decision='Approved' then
     perform pg_advisory_xact_lock(hashtextextended(c::text,0));
     if exists(select 1 from public.members where club_id=c and id<>mid and lower(regexp_replace(trim(full_name),'\s+',' ','g'))=lower(regexp_replace(trim(rec.data->'changes'->>'fullName'),'\s+',' ','g')) and date_of_birth=(rec.data->'changes'->>'dob')::date) then raise exception 'Identity change conflicts with another member' using errcode='23505';end if;
     update public.members set full_name=coalesce(rec.data->'changes'->>'fullName',full_name),date_of_birth=coalesce(nullif(rec.data->'changes'->>'dob','')::date,date_of_birth),updated_at=now() where id=mid;end if;
    update public.members set sport_data=sport_data||jsonb_build_object('participantStatus',case when decision='Approved' then 'APPROVED' else 'REJECTED' end),updated_at=now() where id=mid;
   end if;res:=jsonb_build_object('id',rid);
  elsif a='member-approval-request' then
   select * into target from public.members where id=mid;
   if not found or not scms_private.allowed(target.club_id,target.branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN']) then raise exception 'Member access denied' using errcode='42501';end if;c:=target.club_id;b:=target.branch_id;
   perform pg_advisory_xact_lock(hashtextextended(mid::text,0));
   select id into v from public.scms_records where kind='approval' and member_id=mid and data->>'type'='Pending Member' and data->>'status'='Pending';
   if v is null then insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values('approval',c,b,mid,jsonb_build_object('type','Pending Member','title',target.full_name,'status','Pending'),uid) returning id into v;end if;res:=jsonb_build_object('id',v);
  elsif a='legacy-approval-decide' then
   select * into lr from public.approval_requests where id=rid for update;
   if not found or lr.status<>'PENDING_APPROVAL' then raise exception 'Approval is no longer pending' using errcode='40001';end if;c:=lr.club_id;b:=lr.branch_id;
   if not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN']) then raise exception 'Club approval access denied' using errcode='42501';end if;
   decision:=upper(d->>'decision');if decision not in ('APPROVED','REJECTED') then raise exception 'Invalid decision';end if;
   if decision='APPROVED' and lr.request_type='ROLE_ASSIGNMENT' then
    if lr.requested_role::text in ('SUPERADMIN','SYSTEM_ADMIN','CLUB_ADMIN','CLUB_CO_ADMIN','OBSERVER') and not scms_private.allowed(null,null,null) then raise exception 'Platform approval is required for this role' using errcode='42501';end if;
    if lr.requested_role is null or c is null or (b is not null and not exists(select 1 from public.club_branches where id=b and club_id=c)) then raise exception 'Role assignment scope is incomplete';end if;
    if not exists(select 1 from public.user_roles where user_id=lr.user_id and role=lr.requested_role and club_id is not distinct from c and branch_id is not distinct from b) then insert into public.user_roles(user_id,role,club_id,branch_id,participant_status) values(lr.user_id,lr.requested_role,c,b,'APPROVED');end if;
    update public.profiles set status='ACTIVE',updated_at=now() where id=lr.user_id and status::text='PENDING';
   elsif decision='APPROVED' and lr.request_type='PARTICIPANT_CHANGE' then
    raise exception 'Review this archived identity request and resubmit through the member identity form. No member identity has been changed.';
   end if;
   update public.approval_requests set status=decision,reviewed_by=uid,reviewed_at=now(),updated_at=now() where id=rid;res:=jsonb_build_object('id',rid);
  elsif a='member-change' then
   select * into target from public.members where id=mid;if not found or not scms_private.allowed(target.club_id,target.branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN']) then raise exception 'Member access denied' using errcode='42501';end if;c:=target.club_id;b:=target.branch_id;
   if length(trim(d->>'fullName'))<2 or (d->>'dob')::date>current_date then raise exception 'Valid name and DOB required';end if;
   insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values('approval',c,b,mid,jsonb_build_object('type','Participant Change','title',target.full_name,'status','Pending','changes',jsonb_build_object('fullName',trim(d->>'fullName'),'dob',d->>'dob')),uid) returning id into v;res:=jsonb_build_object('id',v);
  elsif a='task-status' then
   if rec.kind<>'task' or not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','COACH','STAFF']) then raise exception 'Task access denied' using errcode='42501';end if;
   if d->>'status' not in ('Open','In Progress','Completed','Cancelled') then raise exception 'Invalid status';end if;
   update public.scms_records set data=data||jsonb_build_object('status',d->>'status'),version=version+1,updated_at=now() where id=rid;res:=jsonb_build_object('id',rid);
  elsif a='plan-create' then
   if not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','FINANCE']) then raise exception 'Finance access denied' using errcode='42501';end if;
   amt:=(d->>'amountSen')::bigint;if amt<=0 or amt>100000000 or coalesce((d->>'months')::int,0) not in (1,3,6,12) or coalesce(length(trim(d->>'title')),0)<2 then raise exception 'Valid plan, frequency and amount required';end if;
   insert into public.scms_records(kind,club_id,branch_id,data,created_by) values('plan',c,b,jsonb_build_object('title',trim(d->>'title'),'amountSen',amt,'months',(d->>'months')::int,'status','Active'),uid) returning id into v;res:=jsonb_build_object('id',v);
  elsif a='subscription-create' then
   select * into target from public.members where id=mid;if not found then raise exception 'Member unavailable';end if;c:=target.club_id;b:=target.branch_id;
   if not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','FINANCE']) then raise exception 'Finance access denied' using errcode='42501';end if;
   select * into rec from public.scms_records where id=(d->>'planId')::uuid and kind='plan' and club_id=c and (branch_id is null or branch_id=b);if not found then raise exception 'Fee plan does not belong to this member scope';end if;
   if (d->>'expiresOn')::date<(d->>'startsOn')::date then raise exception 'Expiry must follow the start date';end if;
   insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values('subscription',c,b,mid,jsonb_build_object('title',rec.data->>'title','planId',rec.id,'startsOn',(d->>'startsOn')::date,'expiresOn',(d->>'expiresOn')::date,'status','Active'),uid) returning id into v;
   update public.members set membership_expires_on=(d->>'expiresOn')::date where id=mid;res:=jsonb_build_object('id',v);
  elsif a='billing-generate' then
   if not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','FINANCE']) then raise exception 'Finance access denied' using errcode='42501';end if;
   perform pg_advisory_xact_lock(hashtextextended(c::text||coalesce(b::text,'')||'billing',0));paid:=0;
   for rec in select * from public.scms_records where kind='subscription' and club_id=c and (b is null or branch_id=b) and data->>'status'='Active' and (data->>'startsOn')::date<=((d->>'period')||'-01')::date and (data->>'expiresOn')::date>=((d->>'period')||'-01')::date loop
    select * into inv from public.scms_records where id=(rec.data->>'planId')::uuid and kind='plan' and club_id=c;
    if not found then continue;end if;
    if mod((extract(year from ((d->>'period')||'-01')::date)::int-extract(year from (rec.data->>'startsOn')::date)::int)*12+extract(month from ((d->>'period')||'-01')::date)::int-extract(month from (rec.data->>'startsOn')::date)::int,(inv.data->>'months')::int)<>0 then continue;end if;
    if exists(select 1 from public.scms_records where kind='invoice' and data->>'subscriptionId'=rec.id::text and data->>'period'=d->>'period') then continue;end if;
    v:=gen_random_uuid();insert into public.scms_records(id,kind,club_id,branch_id,member_id,data,created_by) values(v,'invoice',c,rec.branch_id,rec.member_id,jsonb_build_object('title',(inv.data->>'title')||' · '||(d->>'period'),'number','INV-'||upper(left(v::text,8)),'amountSen',(inv.data->>'amountSen')::bigint,'paidSen',0,'dueDate',((d->>'period')||'-07')::date,'status','Pending','subscriptionId',rec.id,'period',d->>'period'),uid);paid:=paid+1;
   end loop;res:=jsonb_build_object('generated',paid);
  elsif a='invoice-create' then
   select * into target from public.members where id=mid;if not found then raise exception 'Member unavailable';end if;c:=target.club_id;b:=target.branch_id;
   if not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','FINANCE']) then raise exception 'Finance access denied' using errcode='42501';end if;
   amt:=(d->>'amountSen')::bigint;if amt<=0 or amt>100000000 or length(trim(d->>'title'))<2 then raise exception 'Valid amount and title required';end if;
   v:=gen_random_uuid();insert into public.scms_records(id,kind,club_id,branch_id,member_id,data,created_by) values(v,'invoice',c,b,mid,jsonb_build_object('title',trim(d->>'title'),'number','INV-'||upper(left(v::text,8)),'amountSen',amt,'paidSen',0,'dueDate',(d->>'dueDate')::date,'status','Pending'),uid);res:=jsonb_build_object('id',v);
  elsif a='transfer-submit' then
   select * into inv from public.scms_records where id=(d->>'invoiceId')::uuid and kind='invoice' for update;if not found or not (scms_private.payer(inv.member_id) or scms_private.allowed(inv.club_id,inv.branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','FINANCE'])) then raise exception 'Invoice access denied' using errcode='42501';end if;
   c:=inv.club_id;b:=inv.branch_id;mid:=inv.member_id;amt:=(d->>'amountSen')::bigint;ref:=trim(d->>'reference');
   if amt<=0 or amt>(inv.data->>'amountSen')::bigint-(inv.data->>'paidSen')::bigint or length(ref)<3 then raise exception 'Valid reference and outstanding amount required';end if;
   perform pg_advisory_xact_lock(hashtextextended(c::text||lower(ref),0));
   if exists(select 1 from public.scms_records where club_id=c and kind in ('transfer','receipt') and lower(data->>'reference')=lower(ref) and data->>'status' is distinct from 'Rejected') then raise exception 'Payment reference already recorded' using errcode='23505';end if;
   insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values('transfer',c,b,mid,jsonb_build_object('invoiceId',inv.id,'amountSen',amt,'reference',ref,'status','Pending verification','notes',left(d->>'notes',1000)),uid) returning id into v;res:=jsonb_build_object('id',v);
  elsif a='transfer-review' then
   if rec.kind<>'transfer' or rec.data->>'status'<>'Pending verification' or not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','FINANCE']) then raise exception 'Transfer cannot be verified' using errcode='42501';end if;
   decision:=d->>'decision';if decision not in ('Approved','Rejected') then raise exception 'Invalid decision';end if;
   if decision='Approved' then
    select * into inv from public.scms_records where id=(rec.data->>'invoiceId')::uuid for update;amt:=(rec.data->>'amountSen')::bigint;paid:=(inv.data->>'paidSen')::bigint+amt;
    if inv.kind<>'invoice' or inv.club_id<>c or paid>(inv.data->>'amountSen')::bigint then raise exception 'Invoice balance changed; review transfer' using errcode='40001';end if;
    insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values('receipt',c,b,mid,jsonb_build_object('invoiceId',inv.id,'invoiceNumber',inv.data->>'number','amountSen',amt,'reference',rec.data->>'reference','method','Bank Transfer','status','Verified','verifiedBy',uid),uid);
    update public.scms_records set data=data||jsonb_build_object('paidSen',paid,'status',case when paid=(data->>'amountSen')::bigint then 'Paid' else 'Partially Paid' end),version=version+1,updated_at=now() where id=inv.id;
   end if;
   update public.scms_records set data=data||jsonb_build_object('status',decision,'verifiedBy',uid,'notes',left(d->>'notes',1000)),version=version+1,updated_at=now() where id=rid;res:=jsonb_build_object('id',rid);
  elsif a='bank-save' then
   if not scms_private.allowed(c,b,case when b is null then array['CLUB_ADMIN','CLUB_CO_ADMIN'] else array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN'] end) then raise exception 'Bank detail access denied' using errcode='42501';end if;
   if length(trim(d->>'bankName'))<2 or length(trim(d->>'accountName'))<2 or coalesce(d->>'accountNumber','')!~'^[0-9 -]{5,40}$' then raise exception 'Valid bank and account details required';end if;
   perform pg_advisory_xact_lock(hashtextextended(c::text||coalesce(b::text,'club'),0));
   select id into v from public.scms_records where kind='bank' and club_id=c and branch_id is not distinct from b;
   if v is null then insert into public.scms_records(kind,club_id,branch_id,data,created_by) values('bank',c,b,jsonb_build_object('bankName',trim(d->>'bankName'),'accountName',trim(d->>'accountName'),'accountNumber',trim(d->>'accountNumber'),'instructions',left(d->>'instructions',1000)),uid) returning id into v;
   else update public.scms_records set data=jsonb_build_object('bankName',trim(d->>'bankName'),'accountName',trim(d->>'accountName'),'accountNumber',trim(d->>'accountNumber'),'instructions',left(d->>'instructions',1000)),version=version+1,updated_at=now() where id=v;end if;res:=jsonb_build_object('id',v);
  elsif a='attendance-save' then
   select * into rec from public.scms_records where id=(d->>'sessionId')::uuid and kind='session';if not found then raise exception 'Session unavailable';end if;c:=rec.club_id;b:=rec.branch_id;
   if not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','COACH','ASSISTANT_COACH']) then raise exception 'Attendance access denied' using errcode='42501';end if;
   for g in select * from jsonb_array_elements(d->'records') loop
    mid:=(g->>'memberId')::uuid;if g->>'status' not in ('Present','Absent','Late','Excused') or not exists(select 1 from public.members where id=mid and club_id=c and branch_id=b) then raise exception 'Invalid attendee or status';end if;
    perform pg_advisory_xact_lock(hashtextextended(rec.id::text||mid::text,0));
    select id into v from public.scms_records where kind='attendance' and member_id=mid and data->>'sessionId'=rec.id::text;
    if v is null then insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values('attendance',c,b,mid,jsonb_build_object('sessionId',rec.id,'status',g->>'status','date',rec.data->>'date'),uid);
    else update public.scms_records set data=data||jsonb_build_object('status',g->>'status'),version=version+1,updated_at=now() where id=v;end if;
   end loop;res:=jsonb_build_object('saved',true);
  elsif a='record-create' then
   k:=d->>'kind';if k not in ('task','session','event','draft') or not scms_private.allowed(c,b,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','COACH','STAFF']) then raise exception 'Operation denied' using errcode='42501';end if;
   if c is null or (k='session' and b is null) or coalesce(length(trim(d->'data'->>'title')),0)<2 then raise exception 'Title required';end if;
   if mid is not null and not exists(select 1 from public.members where id=mid and club_id=c and (b is null or branch_id=b)) then raise exception 'Member scope mismatch';end if;
   insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values(k,c,b,mid,(d->'data')||jsonb_build_object('status',case when k='task' then 'Open' else coalesce(d->'data'->>'status','Active') end),uid) returning id into v;
   if k='subscription' then update public.members set membership_expires_on=(d->'data'->>'expiresOn')::date where id=mid;end if;res:=jsonb_build_object('id',v);
  else raise exception 'Unknown operation';end if;
 end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,changes,club_id,branch_id) values(uid,a,'scms',coalesce(res->>'id',mid::text),jsonb_build_object('action',a),c,b);
 return res;
end $$;
revoke all on function scms_private.command(text,jsonb) from public,anon;
grant execute on function scms_private.command(text,jsonb) to authenticated;
create or replace function public.scms_command(p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select scms_private.command(p_action,p_data)$$;
revoke all on function public.scms_command(text,jsonb) from public,anon;
grant execute on function public.scms_command(text,jsonb) to authenticated;
-- Reserve a checkout under the payer's session. Only a trusted server can attach a provider bill or settle funds.
create or replace function scms_private.reserve_checkout(i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv public.scms_records;attempt public.scms_payment_attempts;v uuid;amt bigint;
begin
 select * into inv from public.scms_records where id=i and kind='invoice' for update;
 if not found or not (scms_private.payer(inv.member_id) or scms_private.allowed(inv.club_id,inv.branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN','FINANCE'])) then raise exception 'Invoice access denied' using errcode='42501';end if;
 amt:=(inv.data->>'amountSen')::bigint-(inv.data->>'paidSen')::bigint;if amt<=0 then raise exception 'Invoice is already paid';end if;
 select * into attempt from public.scms_payment_attempts where invoice_id=i and status in ('CREATING','PENDING') limit 1;
 if found then return to_jsonb(attempt);end if;
 insert into public.scms_payment_attempts(invoice_id,club_id,branch_id,amount_sen,created_by) values(i,inv.club_id,inv.branch_id,amt,auth.uid()) returning * into attempt;
 return to_jsonb(attempt);
end $$;
revoke all on function scms_private.reserve_checkout(uuid) from public,anon;
grant execute on function scms_private.reserve_checkout(uuid) to authenticated;
create or replace function public.scms_reserve_checkout(p_invoice uuid) returns jsonb language sql security invoker set search_path='' as $$select scms_private.reserve_checkout(p_invoice)$$;
revoke all on function public.scms_reserve_checkout(uuid) from public,anon;
grant execute on function public.scms_reserve_checkout(uuid) to authenticated;
create or replace function public.scms_gateway_event(p_attempt uuid,p_action text,p_bill text,p_url text default null,p_paid_amount bigint default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.scms_payment_attempts;i public.scms_records;paid bigint;receipt uuid;
begin
 if current_user<>'service_role' and session_user<>'postgres' then raise exception 'Gateway service required' using errcode='42501';end if;
 select * into a from public.scms_payment_attempts where id=p_attempt for update;if not found then raise exception 'Payment attempt unavailable';end if;
 if p_action='attach' then
  if a.status<>'CREATING' then raise exception 'Checkout already attached';end if;
  update public.scms_payment_attempts set provider_bill_id=p_bill,checkout_url=p_url,status='PENDING',updated_at=now() where id=a.id;return jsonb_build_object('ok',true);
 elsif p_action='review' then
  if a.status<>'PAID' then update public.scms_payment_attempts set status='REVIEW',updated_at=now() where id=a.id;end if;return jsonb_build_object('review',true);
 elsif p_action='paid' then
  if a.provider_bill_id is distinct from p_bill or p_paid_amount is distinct from a.amount_sen then raise exception 'Payment amount or bill mismatch';end if;
  if a.status='PAID' then return jsonb_build_object('duplicate',true);end if;
  select * into i from public.scms_records where id=a.invoice_id for update;
  paid:=(i.data->>'paidSen')::bigint+a.amount_sen;
  if paid>(i.data->>'amountSen')::bigint then update public.scms_payment_attempts set status='REVIEW',updated_at=now() where id=a.id;return jsonb_build_object('review',true);end if;
  insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values('receipt',i.club_id,i.branch_id,i.member_id,jsonb_build_object('invoiceId',i.id,'invoiceNumber',i.data->>'number','amountSen',a.amount_sen,'reference','BILLPLZ-'||p_bill,'method','Billplz','status','Verified'),a.created_by) returning id into receipt;
  update public.scms_records set data=data||jsonb_build_object('paidSen',paid,'status',case when paid=(data->>'amountSen')::bigint then 'Paid' else 'Partially Paid' end),version=version+1,updated_at=now() where id=i.id;
  update public.scms_payment_attempts set status='PAID',updated_at=now() where id=a.id;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,changes,club_id,branch_id) values(a.created_by,'gateway-payment-confirmed','invoice',i.id::text,jsonb_build_object('receiptId',receipt,'providerBill',p_bill),i.club_id,i.branch_id);
  return jsonb_build_object('receiptId',receipt);
 end if;raise exception 'Unknown gateway event';
end $$;
revoke all on function public.scms_gateway_event(uuid,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.scms_gateway_event(uuid,text,text,text,bigint) to service_role;
-- Durable sync bookkeeping is scoped to a validated normalized member, never a caller-supplied club.
create or replace function scms_private.sync_state(m uuid,s text,k text,kt text,msg text,conf jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare x public.members;l public.scms_karatetech_participant_links;begin
 select * into x from public.members where id=m;
 if not found or not scms_private.allowed(x.club_id,x.branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN']) then raise exception 'Participant access denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(m::text,0));
 select * into l from public.scms_karatetech_participant_links where scms_member_id=m::text;
 if s='START' then
  if coalesce(x.sport_data->>'participantStatus','') not in ('APPROVED','SYNCED','ACTIVE') then raise exception 'Participant approval required';end if;
  if l.sync_status='PENDING' and l.last_attempted_sync_at>now()-interval '30 seconds' then raise exception 'Participant sync is already in progress' using errcode='40001';end if;
  insert into public.scms_karatetech_participant_links(scms_member_id,club_id,sync_status,last_attempted_sync_at,retry_count) values(m::text,x.club_id,'PENDING',now(),0) on conflict(scms_member_id) do update set sync_status='PENDING',last_attempted_sync_at=now(),retry_count=public.scms_karatetech_participant_links.retry_count+1;
 else
  if s not in ('SUCCESS','ERROR','CONFLICT') then raise exception 'Invalid sync state';end if;
  insert into public.scms_karatetech_participant_links(scms_member_id,club_id,karatetech_participant_id,sync_status,last_error,last_synced_at,last_sync_direction) values(m::text,x.club_id,kt,case when s='SUCCESS' then 'SYNCED' when s='CONFLICT' then 'CONFLICT' else 'DISCONNECTED' end,msg,case when s='SUCCESS' then now() end,'SCMS_TO_KT') on conflict(scms_member_id) do update set karatetech_participant_id=coalesce(excluded.karatetech_participant_id,public.scms_karatetech_participant_links.karatetech_participant_id),sync_status=excluded.sync_status,last_error=excluded.last_error,last_synced_at=case when s='SUCCESS' then now() else public.scms_karatetech_participant_links.last_synced_at end,last_sync_direction='SCMS_TO_KT';
  insert into public.sync_history(scms_participant_id,karatetech_participant_id,club_id,operation,direction,status,conflicts,user_id,completion_time,error_message,request_id) values(m::text,kt,x.club_id,'UPSERT','SCMS_TO_KT',s,conf,auth.uid(),now(),msg,k);
  if s='SUCCESS' then update public.members set sport_data=coalesce(sport_data,'{}')||jsonb_build_object('participantStatus','SYNCED'),updated_at=now() where id=m;end if;
 end if;return jsonb_build_object('ok',true);
end $$;
revoke all on function scms_private.sync_state(uuid,text,text,text,text,jsonb) from public,anon;
grant execute on function scms_private.sync_state(uuid,text,text,text,text,jsonb) to authenticated;
create or replace function public.scms_sync_state(p_member uuid,p_state text,p_key text,p_kt text default null,p_message text default null,p_conflicts jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select scms_private.sync_state(p_member,p_state,p_key,p_kt,p_message,p_conflicts)$$;
revoke all on function public.scms_sync_state(uuid,text,text,text,text,jsonb) from public,anon;
grant execute on function public.scms_sync_state(uuid,text,text,text,text,jsonb) to authenticated;
-- External sync confirmations are server-only; an authenticated browser cannot forge a successful sync.
revoke execute on function public.scms_sync_state(uuid,text,text,text,text,jsonb) from authenticated;
create or replace function public.scms_sync_state_trusted(p_actor uuid,p_member uuid,p_state text,p_key text,p_kt text default null,p_message text default null,p_conflicts jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous text:=current_setting('request.jwt.claim.sub',true);r jsonb;begin
 if current_user<>'service_role' then raise exception 'Trusted server required' using errcode='42501';end if;
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 r:=scms_private.sync_state(p_member,p_state,p_key,p_kt,p_message,p_conflicts);
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);return r;
end $$;
revoke all on function public.scms_sync_state_trusted(uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.scms_sync_state_trusted(uuid,uuid,text,text,text,text,jsonb) to service_role;
grant execute on function scms_private.sync_state(uuid,text,text,text,text,jsonb) to service_role;

create unique index if not exists scms_invoice_billing_period on public.scms_records((data->>'subscriptionId'),(data->>'period')) where kind='invoice' and data ? 'subscriptionId';

alter function public.handle_new_user() set search_path=public,pg_catalog;
-- Preserve legacy invoices by matching existing normalized member identities. The original
-- cms_state is never modified. Only unambiguous paid/unpaid amounts are imported;
-- unsupported statuses remain in the platform-only archive for review.
create unique index if not exists scms_legacy_record_key on public.scms_records(kind,(data->>'legacyKey')) where data ? 'legacyKey';
do $$ declare snapshot jsonb;x jsonb;m public.members;v uuid;c uuid;amt bigint;paid bigint;state text;begin
 if to_regclass('public.cms_state') is null then return;end if;
 for snapshot in select data from public.cms_state loop
  for x in select * from jsonb_array_elements(coalesce(snapshot->'invoices','[]'::jsonb)) loop
   if jsonb_typeof(x->'amount')<>'number' or nullif(x->>'id','') is null or lower(x->>'status') not in ('paid','unpaid','pending','overdue') then continue;end if;
   select * into m from public.members where id::text=x->>'memberId' or legacy_member_id=x->>'memberId' or member_no=x->>'memberId' limit 1;
   if not found then continue;end if;
   amt:=round((x->>'amount')::numeric*100);if amt<=0 or amt>100000000 then continue;end if;
   paid:=case when lower(x->>'status')='paid' then amt else 0 end;
   v:=md5('scms-legacy-invoice:'||m.club_id::text||':'||(x->>'id'))::uuid;
   insert into public.scms_records(id,kind,club_id,branch_id,member_id,data,created_by) values(v,'invoice',m.club_id,m.branch_id,m.id,jsonb_build_object('title',coalesce(x->>'feeType','Legacy club fee'),'number',x->>'invoiceNo','amountSen',amt,'paidSen',paid,'status',case when paid=amt then 'Paid' else 'Pending' end,'dueDate',left(x->>'issueDate',10),'legacyKey',m.club_id::text||':'||(x->>'id'),'source','Legacy SCMS archive'),null) on conflict do nothing;
   if paid>0 then insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values('receipt',m.club_id,m.branch_id,m.id,jsonb_build_object('invoiceId',v,'invoiceNumber',x->>'invoiceNo','amountSen',paid,'reference','LEGACY-'||m.club_id::text||'-'||(x->>'id'),'method',coalesce(x->>'paymentMethod','Legacy record'),'status','Imported historical','receiptNumber',x->>'receiptNo','paymentDate',x->>'paymentDate','legacyKey',m.club_id::text||':'||(x->>'id'),'source','Legacy SCMS archive'),null) on conflict do nothing;end if;
  end loop;
 end loop;
end $$;
