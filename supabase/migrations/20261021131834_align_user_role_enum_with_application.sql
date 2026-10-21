-- SCMS role vocabulary alignment
-- Mirrors live migration: 20261021131834_align_user_role_enum_with_application
alter type public.user_role_type add value if not exists 'SYSTEM_ADMIN';
alter type public.user_role_type add value if not exists 'CLUB_CO_ADMIN';
alter type public.user_role_type add value if not exists 'BRANCH_CO_ADMIN';
alter type public.user_role_type add value if not exists 'ASSISTANT_COACH';
alter type public.user_role_type add value if not exists 'FINANCE';
alter type public.user_role_type add value if not exists 'REGISTRATION_OFFICER';
