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

    if (user.app_metadata?.must_change_password || user.user_metadata?.temp_password) {
      return NextResponse.redirect(new URL('/update-password', request.url))
    }

    const { data: roles, error: rolesError } = await supabase.from('user_roles')
      .select('role,club_id,branch_id').eq('user_id', user.id);
    if (rolesError) return new NextResponse('Unable to verify access', { status: 503 });
    const elevated = roles?.some(r => ['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(r.role));
    const manager = roles?.find(r => ['BRANCH_MANAGER', 'BRANCH_CO_ADMIN'].includes(r.role));
    if (!elevated && manager) {
      const clubId = request.nextUrl.searchParams.get('club_id');
      const branchId = request.nextUrl.searchParams.get('branch_id');
      const matchedAssignment = roles?.find(r => ['BRANCH_MANAGER', 'BRANCH_CO_ADMIN'].includes(r.role)
        && (!clubId || clubId === r.club_id) && (!branchId || branchId === r.branch_id));
      if (!matchedAssignment) {
        return new NextResponse('Forbidden: assigned branch only', { status: 403 });
      }
      if (pathname !== '/dashboard/branch' && pathname !== '/dashboard/profile') {
        const url = new URL('/dashboard/branch', request.url);
        if (matchedAssignment.club_id) url.searchParams.set('club_id', matchedAssignment.club_id);
        if (matchedAssignment.branch_id) url.searchParams.set('branch_id', matchedAssignment.branch_id);
        return NextResponse.redirect(url);
      }
    }
    const role = roles?.find(r => ['SUPERADMIN', 'CLUB_ADMIN'].includes(r.role))?.role || manager?.role || roles?.[0]?.role || 'MEMBER';

    // Route Protection Logic
    if (pathname.startsWith('/dashboard/club') && !['SUPERADMIN', 'CLUB_ADMIN'].includes(role)) {
      if (role === 'BRANCH_MANAGER') {
        return NextResponse.redirect(new URL('/dashboard/branch', request.url));
      }
      return NextResponse.redirect(new URL('/dashboard', request.url)); // Default fallback
    }

    if (pathname.startsWith('/dashboard/branch') && !['SUPERADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER', 'BRANCH_CO_ADMIN'].includes(role)) {
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
