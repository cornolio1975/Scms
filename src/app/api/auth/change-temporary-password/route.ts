import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const TEMP_PASSWORD = 'Password123!';

export async function POST(request: NextRequest) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
  }
  if (password.length < 8 || password === TEMP_PASSWORD) {
    return NextResponse.json(
      { error: 'Choose a new password of at least 8 characters, different from the temporary password' },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Password and trusted flags are changed together on the server so the flag cannot be cleared
  // without actually replacing the temporary password.
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { ...(user.app_metadata || {}), must_change_password: false },
    user_metadata: { ...(user.user_metadata || {}), temp_password: null },
  });
  if (error) return NextResponse.json({ error: 'Unable to update password' }, { status: 400 });

  return NextResponse.json({ success: true });
}

