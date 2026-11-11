BEGIN;
-- Some older installs only have Auth profiles; create the existing members API's
-- roster table so an athlete has its own stable ID and explicit branch membership.
CREATE TABLE IF NOT EXISTS public.members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_no text NOT NULL,
 club_id uuid NOT NULL REFERENCES public.clubs(id), branch_id uuid REFERENCES public.club_branches(id),
 profile_id uuid REFERENCES public.profiles(id), full_name text NOT NULL,
 gender text, date_of_birth date, ic_passport text, nationality text, email text, phone text,
 photo_url text, status text NOT NULL DEFAULT 'Active', sport_data jsonb NOT NULL DEFAULT '{}',
 emergency_contact jsonb NOT NULL DEFAULT '{}', medical_notes text, joined_date date,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.members TO service_role;
-- Access goes through verified server routes; no broad authenticated table policy.
CREATE INDEX IF NOT EXISTS members_club_branch_profile_idx ON public.members(club_id,branch_id,profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS members_branch_identity_unique ON public.members
 (club_id,branch_id,(regexp_replace(upper(ic_passport),'[^A-Z0-9]','','g'))) NULLS NOT DISTINCT
 WHERE ic_passport IS NOT NULL AND regexp_replace(upper(ic_passport),'[^A-Z0-9]','','g') NOT IN ('','NA','PENDING','NONE');
CREATE TABLE public.athlete_sync_state (
 source_id uuid PRIMARY KEY REFERENCES public.members(id), athlete_id uuid,
 revision bigint, baseline jsonb, status text NOT NULL DEFAULT 'PENDING',
 remote_profile jsonb, last_error text, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.athlete_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.athlete_sync_state FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.athlete_sync_state TO service_role;

CREATE FUNCTION public.scms_apply_athlete_sync(member_id uuid, expected_member jsonb,
 expected_state_revision bigint, result jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_member public.members; state public.athlete_sync_state; p jsonb;
BEGIN
 SELECT * INTO current_member FROM public.members WHERE id=member_id FOR UPDATE;
 IF current_member.id IS NULL THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
 SELECT * INTO state FROM public.athlete_sync_state WHERE source_id=member_id FOR UPDATE;
 IF to_jsonb(current_member) IS DISTINCT FROM expected_member OR state.revision IS DISTINCT FROM expected_state_revision THEN
   RETURN jsonb_build_object('success',false,'status','RETRY','error','Athlete changed during synchronization.');
 END IF;
 IF coalesce((result->>'success')::boolean,false) THEN
   p:=result->'profile';
   UPDATE public.members SET full_name=p->>'full_name',gender=p->>'gender',date_of_birth=(p->>'dob')::date,
     ic_passport=p->>'passport_ic',email=p->>'email',phone=p->>'phone',photo_url=p->>'photo_url',
     address=p->>'address',nationality=p->>'nationality_code',
     sport_data=coalesce(sport_data,'{}') || jsonb_build_object('weightKg',p->'weight','heightCm',p->'height'),
     emergency_contact=coalesce(emergency_contact,'{}') || jsonb_build_object('name',p->'emergency_contact_name','phone',p->'emergency_contact_phone'),
     updated_at=now()
     WHERE id=member_id AND (
       full_name IS DISTINCT FROM p->>'full_name' OR gender IS DISTINCT FROM p->>'gender'
       OR date_of_birth IS DISTINCT FROM (p->>'dob')::date OR ic_passport IS DISTINCT FROM p->>'passport_ic'
       OR address IS DISTINCT FROM p->>'address' OR nationality IS DISTINCT FROM p->>'nationality_code'
       OR email IS DISTINCT FROM p->>'email' OR phone IS DISTINCT FROM p->>'phone' OR photo_url IS DISTINCT FROM p->>'photo_url'
       OR sport_data->'weightKg' IS DISTINCT FROM p->'weight' OR sport_data->'heightCm' IS DISTINCT FROM p->'height'
       OR emergency_contact->'name' IS DISTINCT FROM p->'emergency_contact_name'
       OR emergency_contact->'phone' IS DISTINCT FROM p->'emergency_contact_phone');
   INSERT INTO public.athlete_sync_state(source_id,athlete_id,revision,baseline,status)
     VALUES(member_id,(result->>'athlete_id')::uuid,(result->>'revision')::bigint,p,'SYNCED')
     ON CONFLICT(source_id) DO UPDATE SET athlete_id=excluded.athlete_id,revision=excluded.revision,
       baseline=excluded.baseline,status='SYNCED',remote_profile=NULL,last_error=NULL,updated_at=now();
 ELSE
   INSERT INTO public.athlete_sync_state(source_id,status,remote_profile,last_error)
     VALUES(member_id,'CONFLICT',result->'profile',coalesce(result->>'status','CONFLICT'))
     ON CONFLICT(source_id) DO UPDATE SET status='CONFLICT',remote_profile=excluded.remote_profile,
       last_error=excluded.last_error,updated_at=now();
 END IF;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.scms_apply_athlete_sync(uuid,jsonb,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scms_apply_athlete_sync(uuid,jsonb,bigint,jsonb) TO service_role;
COMMIT;
