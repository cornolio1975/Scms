'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import WorkspaceView from '@/components/Workspace/WorkspaceView';

/**
 * Branch Manager workspace.
 * Uses the same WorkspaceView shell (left sidebar + top header) as the other
 * role dashboards, scoped to the club/branch passed in the URL.
 */
function BranchWorkspace() {
  const searchParams = useSearchParams();
  const clubId = searchParams.get('club_id') || undefined;
  const branchId = searchParams.get('branch_id') || undefined;

  return (
    <WorkspaceView
      initialModule="dashboard"
      serverRole="BRANCH_MANAGER"
      clubId={clubId}
      branchId={branchId}
    />
  );
}

export default function BranchDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="animate-pulse text-slate-500 font-bold">Loading branch workspace...</div>
        </div>
      }
    >
      <BranchWorkspace />
    </Suspense>
  );
}
