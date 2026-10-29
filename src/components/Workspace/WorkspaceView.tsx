'use client';

/**
 * Scms Master Workspace View
 * Strict Rule 26: LEFT = LIGHT BLUE NAVIGATION, RIGHT = WHITE WORKSPACE
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Navigation/Sidebar';
import TopHeader from '@/components/Navigation/TopHeader';
import MobileDrawer from '@/components/Navigation/MobileDrawer';
import DashboardOverview from '@/components/Dashboard/DashboardOverview';
import MembersDirectory from '@/components/Member/MembersDirectory';
import DataManagementCenter from '@/components/Member/DataManagementCenter';
import VolunteerSystem from '@/components/Volunteer/VolunteerSystem';
import VolunteerManagementPortal from '@/components/Volunteer/VolunteerManagementPortal';
import CoachConsole from '@/components/Coach/CoachConsole';
import ParentPortal from '@/components/Parent/ParentPortal';
import ClubManagement from '@/components/Club/ClubManagement';
import AllClubsManagement from '@/components/Club/AllClubsManagement';
import KarateTechIntegration from '@/components/Tournaments/KarateTechIntegration';
import ApprovalCentre from '@/components/Operations/ApprovalCentre';
import ApprovedManagers from '@/components/Operations/ApprovedManagers';
import TaskManagement from '@/components/Operations/TaskManagement';
import FinanceModule from '@/components/Finance/FinanceModule';
import OperationalReports from '@/components/Reports/OperationalReports';
import Link from 'next/link';

interface WorkspaceViewProps {
  initialModule?: string;
  onReturnToLanding?: () => void;
  serverRole?: string;
  clubId?: string;
  branchId?: string;
}

export default function WorkspaceView({
  initialModule = 'dashboard',
  onReturnToLanding,
  serverRole,
  clubId,
  branchId,
}: WorkspaceViewProps) {
  const { currentUser, updateProfile, activeRole, activeClub, activeBranch, switchClub, switchBranch } = useAuth();
  const canManageApprovals = ['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN'].includes(activeRole);
  const [currentModule, setCurrentModule] = useState<string>(initialModule);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const closeMobileDrawer = useCallback(() => setIsMobileDrawerOpen(false), []);

  // Synchronize clubId and branchId from route context with AuthContext
  useEffect(() => {
    if (clubId && (!activeClub || activeClub.id !== clubId)) {
      switchClub(clubId);
    }
  }, [clubId, activeClub?.id, switchClub]);

  useEffect(() => {
    if (branchId && (!activeBranch || activeBranch.id !== branchId)) {
      switchBranch(branchId);
    }
  }, [branchId, activeBranch?.id, switchBranch]);

  return (
    <div className="flex h-dvh overflow-hidden bg-white text-slate-900 font-sans">
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
        onClose={closeMobileDrawer}
        currentModule={currentModule}
        onSelectModule={mod => setCurrentModule(mod)}
      />

      {/* 3. RIGHT = WHITE WORKSPACE */}
      <div inert={isMobileDrawerOpen} className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        <TopHeader
          onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
          mobileDrawerOpen={isMobileDrawerOpen}
          currentModule={currentModule}
          onSelectModule={mod => setCurrentModule(mod)}
        />

        <main className="flex-1 overflow-auto overscroll-contain px-3 sm:px-8 py-4 sm:py-6 bg-white">
          <div className="max-w-7xl mx-auto">
            {/* Context Navigation Ribbon */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pb-2 border-b border-slate-100">
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
              currentModule === 'add-member' ||
              currentModule === 'athletes' ||
              currentModule === 'guardians' ||
              currentModule === 'data-management') && (
              <MembersDirectory
                key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                clubId={activeClub?.id || clubId}
                branchId={activeBranch?.id || branchId}
                initialTab={
                  currentModule === 'athletes'
                    ? 'athletes'
                    : currentModule === 'guardians'
                    ? 'guardians'
                    : currentModule === 'data-management'
                    ? 'data-management'
                    : 'all'
                }
                autoOpenAddModal={currentModule === 'add-member'}
              />
            )}

            {(currentModule === 'volunteers' ||
              currentModule === 'all-volunteers' ||
              currentModule === 'assignments' ||
              currentModule === 'volunteer-checkin' ||
              currentModule === 'volunteer-hours') && (
              ['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER'].includes(activeRole) 
                ? (
                  <VolunteerManagementPortal
                    key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                    clubId={activeClub?.id || clubId}
                    branchId={activeBranch?.id || branchId}
                  />
                ) : (
                  <VolunteerSystem
                    key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                    clubId={activeClub?.id || clubId}
                    branchId={activeBranch?.id || branchId}
                  />
                )
            )}

            {(currentModule === 'coach-console' ||
              currentModule === 'attendance' ||
              currentModule === 'take-attendance' ||
              currentModule === 'sessions' ||
              currentModule === 'attendance-reports') && (
              <CoachConsole
                key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                clubId={activeClub?.id || clubId}
                branchId={activeBranch?.id || branchId}
              />
            )}

            {currentModule === 'parent-portal' && (
              <ParentPortal
                key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                clubId={activeClub?.id || clubId}
                branchId={activeBranch?.id || branchId}
              />
            )}

            {currentModule === 'all-clubs' && (
              <AllClubsManagement />
            )}

            {(currentModule === 'club' ||
              currentModule === 'club-profile' ||
              currentModule === 'branch-profile' ||
              currentModule === 'branches' ||
              currentModule === 'officials' ||
              currentModule === 'onboarding') && (
              ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole) && !clubId && currentModule === 'club' ? (
                <AllClubsManagement initialSelectedClubId={activeClub?.id} />
              ) : (
                <ClubManagement
                  key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                  clubId={activeClub?.id || clubId}
                  branchId={activeBranch?.id || branchId}
                  initialTab={
                    currentModule === 'branches' || currentModule === 'branch-profile'
                      ? 'branches'
                      : currentModule === 'officials'
                      ? 'officials'
                      : currentModule === 'onboarding'
                      ? 'onboarding'
                      : 'profile'
                  }
                />
              )
            )}

            {(currentModule === 'tournaments' ||
              currentModule === 'kt-tournaments' ||
              currentModule === 'kt-drafts' ||
              currentModule === 'kt-monitor') && (
              <KarateTechIntegration
                key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                clubId={activeClub?.id || clubId}
                branchId={activeBranch?.id || branchId}
              />
            )}

            {canManageApprovals && currentModule === 'approvals' && <ApprovalCentre />}
            {canManageApprovals && currentModule === 'approved-managers' && (
              <ApprovedManagers
                key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                clubId={activeClub?.id || clubId}
                branchId={activeBranch?.id || branchId}
              />
            )}

            {currentModule === 'tasks' && <TaskManagement />}

            {(currentModule === 'membership-finance' ||
              currentModule === 'invoices' ||
              currentModule === 'receipts' ||
              currentModule === 'membership-plans') && (
              <FinanceModule
                key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                clubId={activeClub?.id || clubId}
                branchId={activeBranch?.id || branchId}
              />
            )}

            {['training', 'training-groups', 'schedule'].includes(currentModule) && (
              <CoachConsole
                key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                clubId={activeClub?.id || clubId}
                branchId={activeBranch?.id || branchId}
              />
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

            {currentModule === 'documents' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-black">Document Hub</h2>
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl text-slate-500 text-sm">
                  Document management features will be available in the next release.
                </div>
              </div>
            )}

            {currentModule === 'activity' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-black">Activity Centre</h2>
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl text-slate-500 text-sm">
                  System activity logs and audit trails will be available here.
                </div>
              </div>
            )}

            {currentModule === 'reports' && (
              <OperationalReports
                key={`${activeClub?.id || clubId}-${activeBranch?.id || branchId || 'all'}`}
                clubId={activeClub?.id || clubId}
                branchId={activeBranch?.id || branchId}
              />
            )}

            {currentModule === 'settings' && (
              <div className="space-y-6 max-w-2xl">
                <h2 className="text-2xl font-black">My Profile & Security</h2>
                
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">Personal Information</h3>
                    <p className="text-xs text-slate-500 mt-1">Update your account details and how we can reach you.</p>
                  </div>
                  
                  <form className="space-y-4" onSubmit={async (e) => { 
                    e.preventDefault(); 
                    const formData = new FormData(e.currentTarget);
                    const btn = e.currentTarget.querySelector('button');
                    if (btn) btn.textContent = 'Saving...';
                    
                    const success = await updateProfile(
                      formData.get('fullName') as string,
                      formData.get('phone') as string
                    );
                    
                    if (btn) btn.textContent = 'Save Changes';
                    if (success) alert('Profile updated successfully!');
                    else alert('Failed to update profile. Please try again.');
                  }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Full Name</label>
                        <input 
                          name="fullName"
                          type="text" 
                          defaultValue={currentUser?.fullName || ''}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white transition-all" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Email Address</label>
                        <input 
                          type="email" 
                          defaultValue={currentUser?.email || ''}
                          disabled
                          className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed" 
                        />
                        <p className="text-[10px] text-slate-400">Email cannot be changed.</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Phone Number</label>
                        <input 
                          name="phone"
                          type="tel" 
                          placeholder="+60123456789"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white transition-all" 
                        />
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button type="submit" className="px-6 py-2.5 bg-[#0284C7] text-white text-sm font-bold rounded-xl hover:bg-[#0369A1] transition-colors shadow-xs">
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
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
