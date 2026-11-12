'use client';
import { useEffect, useState } from 'react';
import { getBranchDashboard } from '@/app/actions/branch-dashboard';
export default function BranchDashboard({ clubId, branchId, onSelectModule }: { clubId?: string; branchId?: string; onSelectModule: (id: string) => void }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof getBranchDashboard>> | null>(null);
  useEffect(() => {
    let disposed = false;
    setResult(null);
    if (clubId && branchId) getBranchDashboard(clubId, branchId).then(data => { if (!disposed) setResult(data); });
    return () => { disposed = true; };
  }, [clubId, branchId]);
  if (!clubId || !branchId) return <p>No branch assigned. Contact your club administrator.</p>;
  if (!result) return <p>Loading your branch dashboard…</p>;
  if (!result.success) return <p role="alert">{result.error}</p>;
  return <section className="space-y-5">
    <h1 className="text-2xl font-bold">{result.branchName}</h1>
    <p>You can manage records for your assigned branch only.</p>
    <div className="p-6 bg-sky-50 rounded-xl"><p>Branch members</p><strong className="text-3xl">{result.memberCount}</strong></div>
    <button className="px-4 py-3 bg-sky-600 text-white rounded-xl" onClick={() => onSelectModule('members')}>Manage Branch Members</button>
  </section>;
}
