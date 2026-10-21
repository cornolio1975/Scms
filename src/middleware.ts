import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname;

  // Protect Dashboard Routes
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Mock-store clubs (Scms- prefix) keep roles in localStorage, which the
    // middleware cannot read. Role enforcement for these happens client-side.
    const clubIdParam = request.nextUrl.searchParams.get('club_id') || '';
    if (clubIdParam.startsWith('Scms-')) {
      return supabaseResponse
    }

    // Determine role and routing
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    const role = roleData?.role || 'MEMBER';

    // Route Protection Logic
    if (pathname.startsWith('/dashboard/club') && !['SUPERADMIN', 'CLUB_ADMIN'].includes(role)) {
      if (role === 'BRANCH_MANAGER') {
        return NextResponse.redirect(new URL('/dashboard/branch', request.url));
      }
      return NextResponse.redirect(new URL('/dashboard', request.url)); // Default fallback
    }

    if (pathname.startsWith('/dashboard/branch') && !['SUPERADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
