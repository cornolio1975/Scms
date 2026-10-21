-- Preserve athlete semantics for migrated legacy karate members.
insert into public.member_roles(member_id,role,club_id,branch_id)
select id,'ATHLETE'::public.user_role_type,club_id,branch_id
from public.members
where legacy_member_id is not null
  and coalesce(sport_data->>'rankName',sport_data->>'beltRank',sport_data->>'kyu') is not null
on conflict do nothing;
