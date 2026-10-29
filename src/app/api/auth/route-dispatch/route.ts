import { NextRequest, NextResponse } from 'next/server';
import { getDashboardRouteForUser } from '@/utils/auth-routing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { route, onboardingRequired } = await getDashboardRouteForUser();
    const acceptsJson = request.headers.get('accept')?.includes('application/json');

    if (acceptsJson) {
      return NextResponse.json({
        success: true,
        destination: route,
        onboardingRequired,
      });
    }

    const redirectUrl = new URL(route, request.url);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Route dispatch error:', error);
    const fallbackUrl = new URL('/login?error=dispatch_failed', request.url);
    return NextResponse.redirect(fallbackUrl);
  }
}
