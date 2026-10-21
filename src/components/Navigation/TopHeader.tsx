'use client';

/**
 * Scms Top Header Navigation Component
 * Section 28: Sidebar toggle, Breadcrumbs, Global Search, Club/Branch Switcher, Notifications, User Menu
 */

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { store } from '@/lib/store';
import {
  Menu,
  Search,
  Bell,
  CheckSquare,
  ShieldCheck,
  Building2,
  GitBranch,
  ChevronDown,
  User,
  LogOut,
  RefreshCw,
  X,
  HelpCircle,
} from 'lucide-react';
import { SystemRole } from '@/types';

interface TopHeaderProps {
  onToggleMobileDrawer: () => void;
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
}

export default function TopHeader({
  onToggleMobileDrawer,
  currentModule,
  onSelectModule,
}: TopHeaderProps) {
  const {
    currentUser,
    activeRole,
    activeClub,
    activeBranch,
    authorizedClubs,
    authorizedBranches,
    switchClub,
    switchBranch,
    switchRole,
    logout,
  } = useAuth();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  const isPlatformAdmin = ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole);

  // Global cross-club search is a platform-admin capability only.
  // Other roles are filtered to the currently authorized club/branch.
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return null;
    const q = searchQuery.toLowerCase();
    const memberScope = store.getMembers().filter(m =>
      isPlatformAdmin ||
      (m.clubId === activeClub?.id &&
        (activeRole !== 'BRANCH_MANAGER' || m.branchId === activeBranch?.id))
    );

    const members = memberScope.filter(
      m =>
        m.id.toLowerCase().includes(q) ||
        m.fullName.toLowerCase().includes(q) ||
        m.icPassport.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
    );

    const clubs = (isPlatformAdmin
      ? store.getClubs()
      : store.getClubs().filter(c => c.id === activeClub?.id)
    ).filter(
      c =>
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.registrationNo.toLowerCase().includes(q)
    );

    const branches = store.getBranches(activeClub?.id)
      .filter(b => isPlatformAdmin || activeRole !== 'BRANCH_MANAGER' || b.id === activeBranch?.id)
      .filter(
      b =>
        b.id.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q)
    );

    const volunteers = store.getVolunteers().filter(
      v =>
        v.id.toLowerCase().includes(q) ||
        v.member?.fullName.toLowerCase().includes(q)
    );

    const invoices = store.invoices.filter(
      i =>
        i.id.toLowerCase().includes(q) ||
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.memberName.toLowerCase().includes(q)
    );

    const tasks = store.tasks.filter(
      t =>
        t.id.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q)
    );

    return {
      members: members.slice(0, 4),
      clubs: clubs.slice(0, 3),
      branches: branches.slice(0, 3),
      volunteers: volunteers.slice(0, 3),
      invoices: invoices.slice(0, 3),
      tasks: tasks.slice(0, 3),
      totalCount:
        members.length +
        clubs.length +
        branches.length +
        volunteers.length +
        invoices.length +
        tasks.length,
    };
  }, [searchQuery, isPlatformAdmin, activeClub?.id, activeBranch?.id, activeRole]);

  const pendingApprovalsCount = store.approvals.filter(a => a.status === 'Pending').length;
  const openTasksCount = store.tasks.filter(t => t.status === 'Open').length;

  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-[#E2E8F0] px-4 flex items-center justify-between shadow-xs">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileDrawer}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 touch-target flex items-center justify-center"
          aria-label="Open Navigation"
        >
          <Menu size={22} />
        </button>

        <div className="hidden sm:flex items-center space-x-2 text-sm">
          <span className="font-semibold text-slate-500">Scms</span>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-slate-900 capitalize">
            {currentModule.replace(/-/g, ' ')}
          </span>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-md mx-4 relative hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search Member ID, Club, Branch, Invoice..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearchOpen && searchResults && (
          <div className="absolute top-11 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in max-h-96 overflow-y-auto">
            <div className="p-2 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>{searchResults.totalCount} results found</span>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="text-xs text-[#0284C7] hover:underline"
              >
                Close
              </button>
            </div>

            {/* Members Section */}
            {searchResults.members.length > 0 && (
              <div className="p-2 border-b border-slate-50">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Members & Athletes
                </div>
                {searchResults.members.map(m => (
                  <div
                    key={m.id}
                    onClick={() => {
                      onSelectModule('all-members');
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 block">{m.fullName}</span>
                      <span className="text-[10px] text-slate-500">{m.id} • {m.gender} • {m.sportData?.beltRank || 'Athlete'}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Clubs Section */}
            {searchResults.clubs.length > 0 && (
              <div className="p-2 border-b border-slate-50">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Clubs
                </div>
                {searchResults.clubs.map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      switchClub(c.id);
                      onSelectModule('club-profile');
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 block">{c.name}</span>
                      <span className="text-[10px] text-slate-500">{c.id} • {c.sport}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-700">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Invoices Section */}
            {searchResults.invoices.length > 0 && (
              <div className="p-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Invoices
                </div>
                {searchResults.invoices.map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      onSelectModule('invoices');
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 block">{inv.invoiceNumber} — {inv.memberName}</span>
                      <span className="text-[10px] text-slate-500">MYR {inv.total.toFixed(2)}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Club/Branch Switcher, Notifications, User Menu */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Mobile Search Icon */}
        <button
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg touch-target flex items-center justify-center"
        >
          <Search size={18} />
        </button>

        {/* Club Switcher (Only Authorized Clubs) */}
        {authorizedClubs.length > 1 && (
          <div className="relative hidden sm:block">
            <div className="flex items-center bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1 text-xs">
              <Building2 size={13} className="text-[#0284C7] mr-1.5 shrink-0" />
              <select
                value={activeClub?.id || ''}
                onChange={e => switchClub(e.target.value)}
                className="bg-transparent font-semibold text-slate-900 focus:outline-hidden cursor-pointer max-w-[130px] truncate"
              >
                {authorizedClubs.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.shortName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Branch Switcher (Only Authorized Branches) */}
        {authorizedBranches.length > 1 && (
          <div className="relative hidden md:block">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <GitBranch size={13} className="text-slate-500 mr-1.5 shrink-0" />
              <select
                value={activeBranch?.id || ''}
                onChange={e => switchBranch(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer max-w-[140px] truncate"
              >
                {authorizedBranches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tasks Quick Access */}
        <button
          onClick={() => onSelectModule('tasks')}
          className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Tasks"
        >
          <CheckSquare size={18} />
          {openTasksCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-sky-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
              {openTasksCount}
            </span>
          )}
        </button>

        {/* Approvals Quick Access */}
        {['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER'].includes(activeRole) && (
          <button
            onClick={() => onSelectModule('approvals')}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Approvals"
          >
            <ShieldCheck size={18} />
            {pendingApprovalsCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        )}

        {/* User Profile & Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all touch-target"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {currentUser?.fullName.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden lg:block">
              <span className="block text-xs font-bold text-slate-900 leading-tight">
                {currentUser?.fullName || 'Guest'}
              </span>
              <span className="inline-block text-[10px] font-semibold text-[#0284C7] bg-[#E0F2FE] px-1.5 rounded">
                {activeRole.replace('_', ' ')}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden lg:block" />
          </button>

          {/* User Menu Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 animate-fade-in">
              <div className="px-4 py-2 border-b border-slate-100">
                <span className="block font-bold text-xs text-slate-900">{currentUser?.fullName}</span>
                <span className="block text-[11px] text-slate-500 truncate">{currentUser?.email}</span>
                <div className="mt-1 flex items-center space-x-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0284C7] text-white">
                    {activeRole}
                  </span>
                </div>
              </div>

              {/* Role Switcher Button */}
              {currentUser && currentUser.roles.length > 1 && (
                <div className="p-2 border-b border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
                    Multi-Role Switcher
                  </div>
                  <div className="space-y-1">
                    {currentUser.roles.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          switchRole(r.role, r.clubId, r.branchId);
                          setIsUserMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                          activeRole === r.role ? 'bg-sky-50 text-[#0284C7] font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>{r.role.replace('_', ' ')}</span>
                        {activeRole === r.role && <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Menu Options */}
              <div className="p-1">
                <button
                  onClick={() => {
                    onSelectModule('settings');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                >
                  <User size={14} />
                  <span>My Profile & Security</span>
                </button>
                <button
                  onClick={() => {
                    logout();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 font-medium"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
