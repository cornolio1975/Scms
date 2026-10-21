import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user: callerUser } } = await supabaseServer.auth.getUser();
    
    if (!callerUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { clubId, branchId, email } = body;

    if (!email || !clubId || !branchId) {
      return NextResponse.json({ error: 'Email, Club ID, and Branch ID are required' }, { status: 400 });
    }

    // Verify Caller is SUPERADMIN or CLUB_ADMIN of clubId
    const { data: callerRoles } = await supabaseServer
      .from('user_roles')
      .select('role, club_id')
      .eq('user_id', callerUser.id);
      
    const isSuperAdmin = callerRoles?.some(r => r.role === 'SUPERADMIN');
    const isClubAdmin = callerRoles?.some(r => r.role === 'CLUB_ADMIN' && r.club_id === clubId);

    if (!isSuperAdmin && !isClubAdmin) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to modify branches in this club' }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing' }, { status: 500 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Find user by email in profiles
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (profileError || !targetProfile) {
      return NextResponse.json({ error: 'No user found with that email. They must be registered first.' }, { status: 404 });
    }

    const userId = targetProfile.id;

    // 2. Add or update BRANCH_MANAGER role in user_roles
    // Check if they already have a BRANCH_MANAGER role for this club and branch
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .eq('branch_id', branchId)
      .eq('role', 'BRANCH_MANAGER')
      .single();

    if (!existingRole) {
      await supabaseAdmin.from('user_roles').insert({
        user_id: userId,
        club_id: clubId,
        branch_id: branchId,
        role: 'BRANCH_MANAGER'
      });
    }

    // 3. Update club_branches manager_id
    await supabaseAdmin
      .from('club_branches')
      .update({ manager_id: userId })
      .eq('id', branchId)
      .eq('club_id', clubId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error assigning manager:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
