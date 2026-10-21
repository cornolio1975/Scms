-- Normalize legacy Senshi dojo records required by cms_state member migration.
insert into public.club_branches(id,club_id,name,address,city,state,postcode,country,phone,email,manager_id,venue_name,operating_hours,status,created_at,updated_at,display_name,district)
values
('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','Dojo Shihan Bala','Puchong Utama Martial Arts Center, Jalan PU 7/2','Puchong','Selangor','47140','Malaysia','012-311 8780','bala@senshi-gojuryu.com',null,'Puchong Utama Martial Arts Center','Monday & Wednesday: 8:00 PM – 9:30 PM | Sunday: 8:30 AM – 11:00 AM','Active',now(),now(),'DOJO SHIHAN BALA','Puchong'),
('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','Dojo Sensei Mohan','Puchong Perdana Multi-Purpose Dojo, Jalan Perdana 3/1','Puchong','Selangor','47150','Malaysia','017-894 9753','mohan@senshi-gojuryu.com',null,'Puchong Perdana Multi-Purpose Dojo','Friday: 8:00 PM – 10:00 PM | Sunday: 4:00 PM – 6:30 PM','Active',now(),now(),'SENSEI MOHAN','Puchong')
on conflict(id) do nothing;

with legacy as (
 select jsonb_array_elements(data->'members') m from public.cms_state where data ? 'members'
), transformed as (
 select m, case m->>'dojoId'
  when 'dojo-kannan' then '22222222-2222-2222-2222-222222222222'::uuid
  when 'dojo-bala' then '33333333-3333-3333-3333-333333333333'::uuid
  when 'dojo-mohan' then '44444444-4444-4444-4444-444444444444'::uuid end branch_id
 from legacy
)
insert into public.members(member_no,club_id,branch_id,full_name,gender,date_of_birth,ic_passport,email,phone,status,joined_date,sport_data,medical_notes,emergency_contact,legacy_member_id)
select m->>'memberId','11111111-1111-1111-1111-111111111111'::uuid,branch_id,m->>'fullName',m->>'gender',
 nullif(m->>'dob','')::date,m->>'icPassport',m->>'email',m->>'phone',
 coalesce(nullif(upper(m->>'membershipStatus'),''),'ACTIVE'),nullif(m->>'dateJoined','')::date,
 jsonb_strip_nulls(jsonb_build_object(
 'rankId',m->>'rankId','rankName',m->>'rankName','kyu',m->>'kyu','beltColor',m->>'beltColor',
 'instructor',m->>'instructor','attendanceRate',nullif(m->>'attendanceRate','')::numeric,
 'totalSessionsAttended',nullif(m->>'totalSessionsAttended','')::integer,
 'lastGradingDate',m->>'lastGradingDate','nextGradingEligibleDate',m->>'nextGradingEligibleDate',
 'competitionExperience',m->>'competitionExperience','membershipType',m->>'membershipType',
 'paymentStatus',m->>'paymentStatus','renewalDate',m->>'renewalDate',
 'legacyDojoId',m->>'dojoId','legacyDojoName',m->>'dojoName')),
 nullif(m->>'medicalConditions',''),
 jsonb_strip_nulls(jsonb_build_object('name',m->>'emergencyContactName','phone',m->>'emergencyContactPhone')),
 m->>'id'
from transformed where branch_id is not null
on conflict(member_no) do nothing;

insert into public.member_roles(member_id,role,club_id,branch_id)
select id,'MEMBER'::public.user_role_type,club_id,branch_id from public.members
where legacy_member_id in ('mem-1','mem-2','mem-3','mem-4','mem-5')
on conflict do nothing;
