-- Reverse sync only updates a previously linked active athlete. Never creates members.
alter table public.scms_karatetech_participant_links
 add column if not exists kt_last_snapshot jsonb,
 add column if not exists kt_last_revision bigint not null default -1;
alter table public.sync_history add column if not exists external_actor_id uuid;
grant select,update on public.members,public.scms_karatetech_participant_links to service_role;
grant select on public.member_roles to service_role;
grant insert on public.sync_history to service_role;
create or replace function public.scms_receive_karatetech(p_remote jsonb,p_actor uuid,p_apply boolean default false,p_expected timestamptz default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 m public.members;l public.scms_karatetech_participant_links;b jsonb;cur jsonb;patch jsonb:='{}';
 changes jsonb:='[]';conflicts jsonb:='[]';f text;v jsonb;revision bigint;
begin
 if p_actor is null then raise exception 'Verified administrator required' using errcode='42501';end if;
 if current_user<>'service_role' then raise exception 'Trusted server required' using errcode='42501';end if;
 select * into m from public.members where id=(p_remote->>'scms_member_id')::uuid for update;
 if not found or m.status<>'ACTIVE' or not exists(select 1 from public.member_roles where member_id=m.id and role='ATHLETE') then
 raise exception 'Linked active athlete unavailable' using errcode='P0002';end if;
 perform pg_advisory_xact_lock(hashtextextended(m.id::text,0));
 select * into l from public.scms_karatetech_participant_links where scms_member_id=m.id::text for update;
 if not found or l.karatetech_participant_id is distinct from p_remote->>'karatetech_participant_id' or
 m.club_id::text is distinct from p_remote->>'scms_club_id' or p_remote->>'club_mapping_valid' is distinct from 'true' then
 raise exception 'Participant or club mapping requires reconciliation' using errcode='P0002';end if;
 if p_remote->>'karatetech_revision' is null or p_remote->'source_snapshot' is null then raise exception 'Upgrade KarateTech return-sync contract' using errcode='22023';end if;
 if p_remote->>'contract_version' is distinct from '1' or
 p_remote->'source_snapshot'->>'scms_member_id' is distinct from m.id::text or
 nullif(trim(p_remote->>'participant_name'),'') is null or length(p_remote->>'participant_name')>200 or
 p_remote->>'gender' not in ('Male','Female') or (p_remote->>'date_of_birth')::date>current_date or
 nullif(trim(p_remote->>'passport_ic'),'') is null or
 coalesce((p_remote->>'weight')::numeric,0)<=0 or coalesce((p_remote->>'height')::numeric,0)<=0 then
 raise exception 'Correct required KarateTech athlete details' using errcode='22023';end if;
 revision:=(p_remote->>'karatetech_revision')::bigint;
 if revision<l.kt_last_revision then raise exception 'Stale KarateTech revision' using errcode='40001';end if;
 if p_apply and (p_expected is null or p_expected is distinct from m.updated_at) then raise exception 'Athlete changed; review again' using errcode='40001';end if;
 b:=coalesce(l.kt_last_snapshot,p_remote->'source_snapshot');
 cur:=jsonb_build_object('participant_name',m.full_name,'gender',m.gender,'date_of_birth',m.date_of_birth::text,
 'passport_ic',m.ic_passport,'nationality_code',coalesce(m.sport_data->>'nationalityCode',m.nationality),
 'email',nullif(trim(m.email),''),'phone',nullif(trim(m.phone),''),
 'weight',(m.sport_data->>'weightKg')::numeric,'height',(m.sport_data->>'heightCm')::numeric,
 'emergency_contact_name',m.emergency_contact->>'name','emergency_contact_phone',m.emergency_contact->>'phone');
 foreach f in array array['participant_name','gender','date_of_birth','passport_ic','nationality_code','email','phone','weight','height','emergency_contact_name','emergency_contact_phone'] loop
  if not p_remote ? f or not b ? f then raise exception 'Incomplete athlete snapshot' using errcode='22023';end if;
  v:=p_remote->f;
  if v is distinct from b->f and v is distinct from cur->f then
   if cur->f is distinct from b->f then conflicts:=conflicts||jsonb_build_array(jsonb_build_object('field',f,'scms',cur->f,'karatetech',v));
   else patch:=patch||jsonb_build_object(f,v);changes:=changes||jsonb_build_array(jsonb_build_object('field',f,'before',cur->f,'after',v));end if;
  end if;
 end loop;
 if jsonb_array_length(conflicts)>0 then return jsonb_build_object('success',false,'conflicts',conflicts,'changes',changes);end if;
 if p_apply then
  -- Duplicate identity checks include normalized names, DOB and IC/passport, never fuzzy matching.
  perform pg_advisory_xact_lock(hashtextextended('kt-return-identity',0));
  if exists(select 1 from public.members x where x.id<>m.id and
   (lower(trim(x.full_name))=lower(trim(coalesce(patch->>'participant_name',m.full_name))) and x.date_of_birth=coalesce((patch->>'date_of_birth')::date,m.date_of_birth)
   or nullif(trim(coalesce(patch->>'passport_ic',m.ic_passport)),'') is not null and lower(trim(x.ic_passport))=lower(trim(coalesce(patch->>'passport_ic',m.ic_passport))))) then
   raise exception 'Duplicate athlete identity requires reconciliation' using errcode='23505';end if;
  if patch<>'{}'::jsonb then
   update public.members set full_name=coalesce(patch->>'participant_name',full_name),gender=coalesce(patch->>'gender',gender),
   date_of_birth=coalesce((patch->>'date_of_birth')::date,date_of_birth),ic_passport=coalesce(patch->>'passport_ic',ic_passport),
   nationality=case when patch?'nationality_code' then patch->>'nationality_code' else nationality end,
   email=case when patch?'email' then patch->>'email' else email end,phone=case when patch?'phone' then patch->>'phone' else phone end,
   sport_data=coalesce(sport_data,'{}')||case when patch?'weight' then jsonb_build_object('weightKg',patch->'weight') else '{}'::jsonb end
    ||case when patch?'height' then jsonb_build_object('heightCm',patch->'height') else '{}'::jsonb end
    ||case when patch?'nationality_code' then jsonb_build_object('nationalityCode',patch->'nationality_code') else '{}'::jsonb end,
   emergency_contact=coalesce(emergency_contact,'{}')||case when patch?'emergency_contact_name' then jsonb_build_object('name',patch->'emergency_contact_name') else '{}'::jsonb end
    ||case when patch?'emergency_contact_phone' then jsonb_build_object('phone',patch->'emergency_contact_phone') else '{}'::jsonb end,updated_at=clock_timestamp()
   where id=m.id;
   insert into public.sync_history(scms_participant_id,karatetech_participant_id,club_id,operation,direction,status,fields_changed,completion_time,request_id,external_actor_id)
   values(m.id::text,l.karatetech_participant_id,m.club_id,'CONFIRMED_UPDATE','KT_TO_SCMS','SUCCESS',changes,now(),'KT-'||l.karatetech_participant_id||'-'||revision::text,p_actor);
  end if;
  update public.scms_karatetech_participant_links set kt_last_snapshot=p_remote,kt_last_revision=revision,
  sync_status='SYNCED',last_error=null,last_synced_at=now(),last_sync_direction='KT_TO_SCMS' where scms_member_id=m.id::text;
 end if;
 return jsonb_build_object('success',true,'changes',changes,'member_revision',m.updated_at,'applied',p_apply,'actor',p_actor);
end $$;
revoke all on function public.scms_receive_karatetech(jsonb,uuid,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.scms_receive_karatetech(jsonb,uuid,boolean,timestamptz) to service_role;
