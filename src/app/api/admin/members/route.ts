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
    const { email, fullName, icPassport, phone, address, roles, clubId, branchId } = body;

    if (!email || !clubId) {
      return NextResponse.json({ error: 'Email and Club ID are required' }, { status: 400 });
    }

    // Verify Caller is SUPERADMIN or CLUB_ADMIN of clubId or BRANCH_MANAGER of branchId
    const { data: callerRoles } = await supabaseServer
      .from('user_roles')
      .select('role, club_id, branch_id')
      .eq('user_id', callerUser.id);
      
    const isSuperAdmin = callerRoles?.some(r => r.role === 'SUPERADMIN');
    const isClubAdmin = callerRoles?.some(r => r.role === 'CLUB_ADMIN' && r.club_id === clubId);
    const isBranchManager = callerRoles?.some(r => r.role === 'BRANCH_MANAGER' && r.club_id === clubId && r.branch_id === branchId);

    if (!isSuperAdmin && !isClubAdmin && !isBranchManager) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to add members to this club or branch' }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing' }, { status: 500 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'password123', // Temporary password
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        temp_password: true, // Flag for first-time login redirect
      }
    });

    if (authError) {
      if (authError.message.includes('already exists')) {
        return NextResponse.json({ error: 'A user with this email already exists in the system.' }, { status: 400 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Update their profile
    await supabaseAdmin
      .from('profiles')
      .update({
        phone: phone || null,
        status: 'ACTIVE'
      })
      .eq('id', userId);

    // 3. Assign roles in user_roles table
    if (roles && roles.length > 0) {
      const roleInserts = roles.map((role: string) => ({
        user_id: userId,
        club_id: clubId,
        branch_id: (role === 'BRANCH_MANAGER' && branchId) ? branchId : null,
        role: role,
      }));
      
      const { error: rolesError } = await supabaseAdmin.from('user_roles').insert(roleInserts);
      if (rolesError) {
        console.error('Error assigning roles:', rolesError);
      }
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (err: any) {
    console.error('Error creating member:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
