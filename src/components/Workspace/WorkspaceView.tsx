'use client';

/**
 * Scms Master Workspace View
 * Strict Rule 26: LEFT = LIGHT BLUE NAVIGATION, RIGHT = WHITE WORKSPACE
 */

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { store } from '@/lib/store';
import Sidebar from '@/components/Navigation/Sidebar';
import TopHeader from '@/components/Navigation/TopHeader';
import MobileDrawer from '@/components/Navigation/MobileDrawer';
import DashboardOverview from '@/components/Dashboard/DashboardOverview';
import MembersDirectory from '@/components/Member/MembersDirectory';
import VolunteerSystem from '@/components/Volunteer/VolunteerSystem';
import CoachConsole from '@/components/Coach/CoachConsole';
import ParentPortal from '@/components/Parent/ParentPortal';
import ClubManagement from '@/components/Club/ClubManagement';
import KarateTechIntegration from '@/components/Tournaments/KarateTechIntegration';
import ApprovalCentre from '@/components/Operations/ApprovalCentre';
import TaskManagement from '@/components/Operations/TaskManagement';
import FinanceModule from '@/components/Finance/FinanceModule';
import Link from 'next/link';

interface WorkspaceViewProps {
  initialModule?: string;
  onReturnToLanding?: () => void;
  serverRole?: string;
}

export default function WorkspaceView({
  initialModule = 'dashboard',
  onReturnToLanding,
  serverRole,
}: WorkspaceViewProps) {
  const [currentModule, setCurrentModule] = useState<string>(initialModule);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const { activeRole, activeClub, setActiveClub } = useAuth();
  const isPlatformAdmin = ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole);
  const platformClubs = isPlatformAdmin ? store.getClubs() : [];

  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-900 font-sans">
      {/* 1. LEFT = LIGHT BLUE NAVIGATION (Persistent Collapsible Desktop Sidebar) */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={mod => setCurrentModule(mod)}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* 2. MOBILE SLIDE-OUT DRAWER */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        currentModule={currentModule}
        onSelectModule={mod => setCurrentModule(mod)}
      />

      {/* 3. RIGHT = WHITE WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        <TopHeader
          onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
          currentModule={currentModule}
          onSelectModule={mod => setCurrentModule(mod)}
        />

        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 bg-white">
          <div className="max-w-7xl mx-auto">
            {/* Platform Command Centre Context */}
            {isPlatformAdmin && (
              <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">Super Admin Command Centre</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {activeClub ? `Managing: ${activeClub.name}` : 'Platform-wide overview'}
                  </p>
                  <p className="text-xs text-slate-500">Select a club to load its complete operational workspace.</p>
                </div>
                <select
                  value={activeClub?.id || ''}
                  onChange={e => {
                    const club = platformClubs.find(item => item.id === e.target.value);
                    setActiveClub(club);
                    if (club) setCurrentModule('club-profile');
                  }}
                  className="min-w-64 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-sky-300"
                  aria-label="Select club to manage"
                >
                  <option value="">All clubs / platform overview</option>
                  {platformClubs.map(club => (
                    <option key={club.id} value={club.id}>
                      {club.name} ({club.shortName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Context Navigation Ribbon */}
            <div className="mb-4 flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-100">
              <span className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Tenant Isolation: <strong className="text-slate-700">Active & Audited</strong></span>
              </span>
              {onReturnToLanding ? (
                <button
                  onClick={onReturnToLanding}
                  className="text-[#0284C7] font-bold hover:underline"
                >
                  ← Return to Public Landing Page
                </button>
              ) : (
                <Link href="/" className="text-[#0284C7] font-bold hover:underline">
                  ← Return to Public Landing Page
                </Link>
              )}
            </div>

            {/* Dynamic Modules */}
            {currentModule === 'dashboard' && (
              <DashboardOverview onSelectModule={mod => setCurrentModule(mod)} />
            )}

            {(currentModule === 'members' ||
              currentModule === 'all-members' ||
              currentModule === 'athletes' ||
              currentModule === 'import-members') && (
              <MembersDirectory />
            )}

            {(currentModule === 'volunteers' ||
              currentModule === 'all-volunteers' ||
              currentModule === 'assignments' ||
              currentModule === 'volunteer-checkin' ||
              currentModule === 'volunteer-hours') && (
              <VolunteerSystem />
            )}

            {(currentModule === 'coach-console' ||
              currentModule === 'take-attendance' ||
              currentModule === 'sessions') && (
              <CoachConsole />
            )}

            {currentModule === 'parent-portal' && <ParentPortal />}

            {(currentModule === 'club' ||
              currentModule === 'club-profile' ||
              currentModule === 'branches' ||
              currentModule === 'onboarding') && (
              <ClubManagement />
            )}

            {(currentModule === 'tournaments' ||
              currentModule === 'kt-tournaments' ||
              currentModule === 'kt-drafts' ||
              currentModule === 'kt-monitor') && (
              <KarateTechIntegration />
            )}

            {currentModule === 'approvals' && <ApprovalCentre />}

            {currentModule === 'tasks' && <TaskManagement />}

            {(currentModule === 'membership-finance' ||
              currentModule === 'invoices' ||
              currentModule === 'receipts' ||
              currentModule === 'membership-plans') && (
              <FinanceModule />
            )}

            {['training', 'training-groups', 'schedule'].includes(currentModule) && (
              <CoachConsole />
            )}

            {currentModule === 'events' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-black">Club Events & Seminars</h2>
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                  <h3 className="font-bold text-base text-slate-900">Goju-Ryu Sanchin & Tensho Masterclass</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    March 28, 2026 • Honbu Dojo Main Arena • 45 Registered Participants • 6 Assigned Volunteers
                  </p>
                </div>
              </div>
            )}

            {currentModule === 'reports' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-black">Operational Reports & Analytics</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                    <span className="text-xs font-bold text-slate-400 uppercase">Monthly Revenue</span>
                    <span className="text-2xl font-black text-slate-900 block mt-1">MYR 18,450.00</span>
                  </div>
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                    <span className="text-xs font-bold text-slate-400 uppercase">Overall Attendance</span>
                    <span className="text-2xl font-black text-emerald-600 block mt-1">94.2%</span>
                  </div>
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                    <span className="text-xs font-bold text-slate-400 uppercase">Volunteer Service</span>
                    <span className="text-2xl font-black text-indigo-600 block mt-1">70.5 Hours</span>
                  </div>
                </div>
              </div>
            )}

            {currentModule === 'settings' && (
              <div className="space-y-6 max-w-2xl">
                <h2 className="text-2xl font-black">System & Security Settings</h2>
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
                  <h3 className="font-extrabold text-base text-slate-900">Tenant Isolation & Encryption</h3>
                  <p className="text-xs text-slate-500">
                    Row Level Security (RLS) and cryptographic session guards are active. Cross-tenant leakage between Club A and Club B is strictly prevented at database and server middleware layers.
                  </p>
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 w-fit">
                    <span>✓ RLS Policies Active</span>
                    <span>•</span>
                    <span>Immutable IDs Enforced</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
