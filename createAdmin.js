const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const email = 'admin@spsportdatasolution.org';
  const password = 'password123!';

  console.log('Creating SuperAdmin user...');
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'System SuperAdmin' }
  });

  if (authError) {
    if (authError.code === 'email_exists' || authError.message.includes('already')) {
      console.log('User already exists, fetching user ID...');
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
      const user = existingUser.users.find(u => u.email === email);
      if (user) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
        await assignRole(user.id);
      }
    } else {
      console.error('Failed to create user:', authError);
    }
  } else {
    await assignRole(authData.user.id);
  }
}

async function assignRole(userId) {
  console.log('Updating profile and role...');
  await supabaseAdmin.from('profiles').update({ status: 'ACTIVE' }).eq('id', userId);
  
  // Assign SuperAdmin role
  const { error } = await supabaseAdmin.from('user_roles').insert({
    user_id: userId,
    role: 'SUPERADMIN'
  });
  
  if (error && error.code !== '23505') { // Ignore duplicate key errors
    console.error('Error assigning role:', error);
  } else {
    console.log('Successfully created/configured SuperAdmin!');
    console.log('Email: superadmin@scms.com');
    console.log('Password: SuperAdmin!123');
  }
}

main();
