'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function performRouting() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign('/login');
        return;
      }

      // 1. Try mock store
      try {
        const { resolveMockRole, mockRoleRoute } = await import('@/lib/mockRole');
        const mockRole = resolveMockRole(user.email, user.user_metadata?.full_name);

        if (mockRole) {
          window.location.assign(mockRoleRoute(mockRole));
          return;
        }
      } catch (e) {
        console.error('Mock routing failed', e);
      }

      // 2. Fallback to server route dispatcher for real Supabase users
      window.location.assign('/api/auth/route-dispatch');
    }

    performRouting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-pulse text-slate-500 font-bold">Routing to your workspace...</div>
    </div>
  );
}
