const { Client } = require('pg');

const pgClient = new Client({
  connectionString: 'postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres'
});

async function run() {
  await pgClient.connect();
  
  const query = `
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_email();
  `;
  
  await pgClient.query(query);
  console.log('Trigger for auto confirm email created.');
  
  await pgClient.end();
}
run();
