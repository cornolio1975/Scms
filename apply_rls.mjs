import { Client } from 'pg';
import fs from 'fs';

const connectionString = "postgresql://postgres:Bundar%403575@db.burkkjwkgwfmzcdelwqn.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Drop existing functions to replace them easily
    await client.query(`
      CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND role = 'SUPERADMIN'
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      CREATE OR REPLACE FUNCTION public.is_club_admin(check_club_id UUID) RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND club_id = check_club_id AND role = 'CLUB_ADMIN'
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      CREATE OR REPLACE FUNCTION public.is_branch_manager(check_branch_id UUID) RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND branch_id = check_branch_id AND role = 'BRANCH_MANAGER'
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    console.log("Functions created/replaced.");

    // Define policies to create
    const policies = [
      // user_roles
      `DROP POLICY IF EXISTS "SuperAdmins manage all roles" ON public.user_roles;`,
      `CREATE POLICY "SuperAdmins manage all roles" ON public.user_roles FOR ALL USING (public.is_superadmin());`,
      
      `DROP POLICY IF EXISTS "Club Admins manage own club roles" ON public.user_roles;`,
      `CREATE POLICY "Club Admins manage own club roles" ON public.user_roles FOR ALL USING (public.is_club_admin(club_id));`,

      `DROP POLICY IF EXISTS "Branch Managers manage own branch roles" ON public.user_roles;`,
      `CREATE POLICY "Branch Managers manage own branch roles" ON public.user_roles FOR ALL USING (public.is_branch_manager(branch_id));`,

      `DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;`,
      `CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);`,

      // club_branches
      `DROP POLICY IF EXISTS "SuperAdmins manage all branches" ON public.club_branches;`,
      `CREATE POLICY "SuperAdmins manage all branches" ON public.club_branches FOR ALL USING (public.is_superadmin());`,

      `DROP POLICY IF EXISTS "Club Admins manage own branches" ON public.club_branches;`,
      `CREATE POLICY "Club Admins manage own branches" ON public.club_branches FOR ALL USING (public.is_club_admin(club_id));`,

      `DROP POLICY IF EXISTS "Branch Managers view own branch" ON public.club_branches;`,
      `CREATE POLICY "Branch Managers view own branch" ON public.club_branches FOR SELECT USING (public.is_branch_manager(id));`,

      `DROP POLICY IF EXISTS "Members view own club branches" ON public.club_branches;`,
      `CREATE POLICY "Members view own club branches" ON public.club_branches FOR SELECT USING (
         EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND club_id = club_branches.club_id)
      );`,

      // clubs
      `DROP POLICY IF EXISTS "SuperAdmins manage all clubs" ON public.clubs;`,
      `CREATE POLICY "SuperAdmins manage all clubs" ON public.clubs FOR ALL USING (public.is_superadmin());`,

      `DROP POLICY IF EXISTS "Club Admins manage own club" ON public.clubs;`,
      `CREATE POLICY "Club Admins manage own club" ON public.clubs FOR ALL USING (public.is_club_admin(id));`,

      `DROP POLICY IF EXISTS "Members view own club" ON public.clubs;`,
      `CREATE POLICY "Members view own club" ON public.clubs FOR SELECT USING (
         EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND club_id = clubs.id)
      );`
    ];

    for (const p of policies) {
      await client.query(p);
    }
    
    // Enable RLS on all
    await client.query(`
      ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.club_branches ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
    `);

    console.log("Policies successfully dropped and recreated.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
