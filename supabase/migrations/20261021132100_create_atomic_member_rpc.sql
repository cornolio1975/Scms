-- Atomic normalized member creation.
create or replace function public.create_member_atomic(
 p_club_id uuid,p_branch_id uuid,p_full_name text,p_gender text,p_dob date,p_ic_passport text,
 p_email text default null,p_phone text default null,p_belt_rank text default null,p_weight_kg numeric default null,
 p_is_athlete boolean default false,p_is_volunteer boolean default false
) returns uuid language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_member_id uuid; v_member_no text;
begin
 if not (public.is_superadmin() or public.is_club_admin(p_club_id) or public.is_branch_manager(p_branch_id)) then
  raise exception 'Not authorized to create members in this branch' using errcode='42501';
 end if;
 if not exists(select 1 from public.club_branches where id=p_branch_id and club_id=p_club_id) then
  raise exception 'Branch does not belong to club' using errcode='23503';
 end if;
 v_member_no:='SCMS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.members(member_no,club_id,branch_id,full_name,gender,date_of_birth,ic_passport,email,phone,status,joined_date,sport_data)
 values(v_member_no,p_club_id,p_branch_id,trim(p_full_name),p_gender,p_dob,nullif(trim(p_ic_passport),''),nullif(trim(p_email),''),nullif(trim(p_phone),''),'ACTIVE',current_date,jsonb_strip_nulls(jsonb_build_object('beltRank',p_belt_rank,'weightKg',p_weight_kg)))
 returning id into v_member_id;
 insert into public.member_roles(member_id,role,club_id,branch_id) values(v_member_id,'MEMBER',p_club_id,p_branch_id);
 if p_is_athlete then insert into public.member_roles(member_id,role,club_id,branch_id) values(v_member_id,'ATHLETE',p_club_id,p_branch_id); end if;
 if p_is_volunteer then
  insert into public.member_roles(member_id,role,club_id,branch_id) values(v_member_id,'VOLUNTEER',p_club_id,p_branch_id);
  insert into public.volunteer_profiles(member_id,status) values(v_member_id,'ACTIVE');
 end if;
 return v_member_id;
end $$;
revoke all on function public.create_member_atomic(uuid,uuid,text,text,date,text,text,text,text,numeric,boolean,boolean) from public,anon;
grant execute on function public.create_member_atomic(uuid,uuid,text,text,date,text,text,text,text,numeric,boolean,boolean) to authenticated,service_role;
