-- Extend the transaction, retaining all existing permission/duplicate/approval checks.
create or replace function scms_private.command_with_athlete_fields(a text,d jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb;m uuid;x public.members;changed_identity boolean;begin
 if a not in ('member-create','athlete-details-save') then return scms_private.command(a,d);end if;
 if nullif(d->>'nationalityCode','') is not null and (d->>'nationalityCode') !~ '^[A-Z]{2,3}$' then raise exception 'Use an KarateTech country code';end if;
 if coalesce((d->>'heightCm')::numeric,1)<=0 or coalesce((d->>'heightCm')::numeric,1)>999.99 or coalesce((d->>'weightKg')::numeric,1)<=0 or coalesce((d->>'weightKg')::numeric,1)>999.99 then raise exception 'Correct the athlete measurements';end if;
 if a='member-create' then r:=scms_private.command(a,d);m:=(r->>'id')::uuid;
 else
  m:=(d->>'memberId')::uuid;select * into x from public.members where id=m for update;
  if not found or not scms_private.allowed(x.club_id,x.branch_id,array['CLUB_ADMIN','CLUB_CO_ADMIN','BRANCH_MANAGER','BRANCH_CO_ADMIN']) then raise exception 'Athlete access denied' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(x.club_id::text,0));
  if nullif(trim(d->>'icPassport'),'') is not null and exists(select 1 from public.members where club_id=x.club_id and id<>m and lower(trim(ic_passport))=lower(trim(d->>'icPassport'))) then raise exception 'Identity number already exists' using errcode='23505';end if;
  changed_identity:=x.ic_passport is distinct from nullif(trim(d->>'icPassport'),'');
  if changed_identity then
   update public.members set sport_data=coalesce(sport_data,'{}')||jsonb_build_object('participantStatus','PENDING_APPROVAL') where id=m;
   insert into public.scms_records(kind,club_id,branch_id,member_id,data,created_by) values('approval',x.club_id,x.branch_id,m,jsonb_build_object('type','Pending Member','title','Athlete identity details updated','status','Pending'),auth.uid());
  end if;
  r:=jsonb_build_object('id',m);
 end if;
 update public.members set ic_passport=nullif(trim(d->>'icPassport'),''),nationality=nullif(d->>'nationalityCode',''),
 emergency_contact=jsonb_build_object('name',nullif(d->>'emergencyName',''),'phone',nullif(d->>'emergencyPhone','')),
 sport_data=coalesce(sport_data,'{}')||jsonb_build_object('heightCm',d->'heightCm','weightKg',d->'weightKg','beltRank',d->>'beltRank','nationalityCode',nullif(d->>'nationalityCode','')),updated_at=now() where id=m;
 select * into x from public.members where id=m;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,club_id,branch_id) values(auth.uid(),'athlete-details-saved','member',m::text,x.club_id,x.branch_id);
 return r;
end $$;
revoke all on function scms_private.command_with_athlete_fields(text,jsonb) from public,anon;
grant execute on function scms_private.command_with_athlete_fields(text,jsonb) to authenticated;
create or replace function public.scms_command(p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select scms_private.command_with_athlete_fields(p_action,p_data)$$;
revoke all on function public.scms_command(text,jsonb) from public,anon;
grant execute on function public.scms_command(text,jsonb) to authenticated;
-- Fresh databases do not inherit Supabase's historical default table grants.
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
