import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';

  // If Supabase redirects with an error from the OAuth provider (like Google)
  const authError = requestUrl.searchParams.get('error');
  const authErrorDescription = requestUrl.searchParams.get('error_description');

  if (authError || authErrorDescription) {
    console.error('OAuth Provider Error:', authErrorDescription || authError);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(authErrorDescription || 'OAuth Error')}`, requestUrl.origin));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect to the correct dashboard based on authoritative DB role
      const { getDashboardRouteForUser } = await import('@/utils/auth-routing');
      const { route } = await getDashboardRouteForUser();
      return NextResponse.redirect(new URL(route, requestUrl.origin));
    } else {
      console.error('Supabase exchangeCodeForSession error:', error);
    }
  } else {
    console.error('No code found in the callback URL');
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(new URL('/login?error=Could not authenticate user', requestUrl.origin));
}
