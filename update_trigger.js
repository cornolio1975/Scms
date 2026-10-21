const { Client } = require('pg');

const pgClient = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres'
});

async function run() {
  await pgClient.connect();
  
  const query = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  req_role text;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  
  -- Check for requested_role
  req_role := new.raw_user_meta_data->>'requested_role';
  
  -- Create approval request if role needs approval
  IF req_role IN ('CLUB_ADMIN', 'BRANCH_MANAGER') THEN
    INSERT INTO public.approval_requests (user_id, requested_role, status)
    VALUES (new.id, req_role::public.user_role_type, 'PENDING_APPROVAL');
  END IF;

  RETURN new;
END;
$function$;
  `;
  
  await pgClient.query(query);
  console.log('Trigger updated.');
  await pgClient.end();
}
run();
