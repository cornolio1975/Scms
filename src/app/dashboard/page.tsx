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

      // 1. Primary: Use authoritative server route dispatcher for real Supabase users
      try {
        const res = await fetch('/api/auth/route-dispatch', {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const body = await res.json();
          if (body?.destination) {
            window.location.assign(body.destination);
            return;
          }
        }
      } catch (e) {
        console.error('Server route dispatch failed, falling back:', e);
      }

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
