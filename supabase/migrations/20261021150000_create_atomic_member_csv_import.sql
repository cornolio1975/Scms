-- Atomic tenant-scoped member CSV import.
-- Any validation or insert failure aborts the complete RPC transaction.
create or replace function public.import_members_csv_atomic(
  p_club_id uuid,
  p_branch_id uuid,
  p_filename text,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_import_id uuid;
  v_row jsonb;
  v_member_id uuid;
  v_member_no text;
  v_total integer;
  v_inserted integer := 0;
  v_ic text;
  v_name text;
  v_gender text;
  v_dob date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (
    public.is_superadmin()
    or public.is_club_admin(p_club_id)
    or (
      public.is_branch_manager(p_branch_id)
      and exists (
        select 1 from public.club_branches
        where id = p_branch_id and club_id = p_club_id
      )
    )
  ) then
    raise exception 'Not authorized to import members in this branch' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.club_branches
    where id = p_branch_id and club_id = p_club_id
  ) then
    raise exception 'Branch does not belong to club' using errcode = '23503';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows must be a JSON array' using errcode = '22023';
  end if;

  v_total := jsonb_array_length(p_rows);
  if v_total < 1 or v_total > 500 then
    raise exception 'Import must contain between 1 and 500 rows' using errcode = '22023';
  end if;

  -- Validate the full payload before creating the import history or any member.
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_name := trim(coalesce(v_row->>'fullName', ''));
    v_gender := trim(coalesce(v_row->>'gender', ''));
    v_ic := trim(coalesce(v_row->>'icPassport', ''));

    if v_name = '' or v_ic = '' then
      raise exception 'Full Name and IC/Passport are required' using errcode = '22023';
    end if;

    if v_gender not in ('Male', 'Female') then
      raise exception 'Gender must be Male or Female' using errcode = '22023';
    end if;

    begin
      v_dob := (v_row->>'dob')::date;
    exception when others then
      raise exception 'Invalid DOB for %', v_name using errcode = '22007';
    end;

    if exists (
      select 1 from public.members
      where club_id = p_club_id
        and lower(trim(ic_passport)) = lower(v_ic)
    ) then
      raise exception 'Duplicate IC/Passport already exists in club: %', v_ic using errcode = '23505';
    end if;

    if (
      select count(*)
      from jsonb_array_elements(p_rows) x
      where lower(trim(x->>'icPassport')) = lower(v_ic)
    ) > 1 then
      raise exception 'Duplicate IC/Passport appears more than once in import: %', v_ic using errcode = '23505';
    end if;
  end loop;

  insert into public.csv_history(
    operation, module_name, user_id, filename,
    total_records, successful_records, error_records, status
  ) values (
    'IMPORT', 'MEMBERS', auth.uid(), nullif(trim(p_filename), ''),
    v_total, 0, 0, 'PROCESSING'
  ) returning id into v_import_id;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_member_no := 'SCMS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    insert into public.members(
      member_no, club_id, branch_id, full_name, gender, date_of_birth,
      ic_passport, email, phone, status, joined_date, sport_data
    ) values (
      v_member_no, p_club_id, p_branch_id,
      trim(v_row->>'fullName'),
      trim(v_row->>'gender'),
      (v_row->>'dob')::date,
      trim(v_row->>'icPassport'),
      nullif(trim(v_row->>'email'), ''),
      nullif(trim(v_row->>'phone'), ''),
      'ACTIVE',
      current_date,
      jsonb_strip_nulls(jsonb_build_object(
        'beltRank', nullif(trim(v_row->>'beltRank'), ''),
        'weightKg', case
          when nullif(trim(v_row->>'weightKg'), '') is null then null
          else (v_row->>'weightKg')::numeric
        end
      ))
    ) returning id into v_member_id;

    insert into public.member_roles(member_id, role, club_id, branch_id)
    values (v_member_id, 'MEMBER', p_club_id, p_branch_id);

    if coalesce((v_row->>'isAthlete')::boolean, false) then
      insert into public.member_roles(member_id, role, club_id, branch_id)
      values (v_member_id, 'ATHLETE', p_club_id, p_branch_id);
    end if;

    if coalesce((v_row->>'isVolunteer')::boolean, false) then
      insert into public.member_roles(member_id, role, club_id, branch_id)
      values (v_member_id, 'VOLUNTEER', p_club_id, p_branch_id);
      insert into public.volunteer_profiles(member_id, status)
      values (v_member_id, 'ACTIVE');
    end if;

    v_inserted := v_inserted + 1;
  end loop;

  update public.csv_history
  set successful_records = v_inserted,
      error_records = 0,
      status = 'COMPLETED'
  where id = v_import_id;

  return jsonb_build_object(
    'importId', v_import_id,
    'total', v_total,
    'inserted', v_inserted
  );
end;
$$;

revoke all on function public.import_members_csv_atomic(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.import_members_csv_atomic(uuid, uuid, text, jsonb) to authenticated, service_role;
