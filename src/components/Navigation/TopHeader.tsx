'use client';

/**
 * Scms Top Header Navigation Component
 * Enhanced with:
 * 1. Global / Scoped Server-Backed Search with debouncing, category tabs, keyboard nav, and record deep-linking.
 * 2. Super Admin Searchable All-Club Dropdown Popover (Name, Code, State, Status) + Branch Switcher.
 * 3. Club Admin Branch/Dojo Dropdown Only (with All Branches option).
 * 4. Branch Manager Assigned Branch Dropdown Only.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { store } from '@/lib/store';
import { searchPlatformAction, SearchPlatformResponse, SearchResultItem } from '@/app/actions/global-search';
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
  Check,
  Users,
  Shield,
  HeartHandshake,
  UserCheck,
  CreditCard,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import { SystemRole } from '@/types';

interface TopHeaderProps {
  onToggleMobileDrawer: () => void;
  mobileDrawerOpen?: boolean;
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
}

export default function TopHeader({
  onToggleMobileDrawer,
  mobileDrawerOpen = false,
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

  const isSuperAdmin = ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole);
  const isClubAdmin = ['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(activeRole);
  const isBranchManager = activeRole === 'BRANCH_MANAGER';

  // --- Search State ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchPlatformResponse['results'] | null>(null);
  const [totalResultCount, setTotalResultCount] = useState(0);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Club Selector Popover State (Super Admin) ---
  const [isClubSelectorOpen, setIsClubSelectorOpen] = useState(false);
  const [clubFilterText, setClubFilterText] = useState('');
  const clubSelectorRef = useRef<HTMLDivElement>(null);

  // --- User Menu State ---
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Debounced Server Search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults(null);
      setTotalResultCount(0);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(async () => {
      try {
        const res = await searchPlatformAction({
          query: searchQuery,
          clubId: isSuperAdmin ? undefined : activeClub?.id,
          branchId: isBranchManager ? activeBranch?.id : undefined,
          limit: 6,
        });

        if (res.success && res.results) {
          setSearchResults(res.results);
          setTotalResultCount(res.totalCount);
          setSelectedResultIndex(0);
        } else {
          setSearchResults(null);
          setTotalResultCount(0);
        }
      } catch (err) {
        console.error('Search query failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, isSuperAdmin, isBranchManager, activeClub?.id, activeBranch?.id]);

  // Flatten search results for keyboard navigation
  const flatResults = React.useMemo(() => {
    if (!searchResults) return [];
    return [
      ...searchResults.clubs,
      ...searchResults.branches,
      ...searchResults.members,
      ...searchResults.officials,
      ...searchResults.volunteers,
      ...searchResults.parents,
      ...searchResults.invoices,
    ];
  }, [searchResults]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (clubSelectorRef.current && !clubSelectorRef.current.contains(e.target as Node)) {
        setIsClubSelectorOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation for Search
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!isSearchOpen || flatResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex(prev => (prev > 0 ? prev - 1 : flatResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[selectedResultIndex]) {
        handleSelectResult(flatResults[selectedResultIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    setIsSearchOpen(false);
    setSearchQuery('');

    // Context switch if needed
    if (item.clubId && (!activeClub || activeClub.id !== item.clubId)) {
      switchClub(item.clubId);
    }
    if (item.branchId && (!activeBranch || activeBranch.id !== item.branchId)) {
      switchBranch(item.branchId);
    }

    // Module navigation
    if (item.targetModule) {
      onSelectModule(item.targetModule);
    }
  };

  // Filtered Authorized Clubs for Selector Dropdown
  const filteredAuthorizedClubs = React.useMemo(() => {
    if (!clubFilterText.trim()) return authorizedClubs;
    const q = clubFilterText.toLowerCase();
    return authorizedClubs.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        (c.displayName && c.displayName.toLowerCase().includes(q)) ||
        (c.shortName && c.shortName.toLowerCase().includes(q)) ||
        c.id.toLowerCase().includes(q) ||
        (c.state && c.state.toLowerCase().includes(q))
    );
  }, [authorizedClubs, clubFilterText]);

  const pendingApprovalsCount = store.approvals.filter(a => a.status === 'Pending').length;
  const openTasksCount = store.tasks.filter(t => t.status === 'Open').length;

  return (
    <header className="sticky top-0 z-20 h-16 shrink-0 bg-white border-b border-[#E2E8F0] px-4 flex items-center justify-between shadow-xs">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileDrawer}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 touch-target flex items-center justify-center"
          aria-label="Open Navigation"
          aria-expanded={mobileDrawerOpen}
          aria-controls={mobileDrawerOpen ? "mobile-navigation" : undefined}
        >
          <Menu size={22} />
        </button>

        <div className="flex min-w-0 items-center space-x-2 text-sm">
          <span className="hidden sm:inline font-semibold text-slate-500">Scms</span>
          <span className="hidden sm:inline text-slate-300">/</span>
          <span className="max-w-28 sm:max-w-none truncate font-bold text-slate-900 capitalize">
            {currentModule.replace(/-/g, ' ')}
          </span>
        </div>
      </div>

      {/* Center: Global / Scoped Search Bar */}
      <div ref={searchContainerRef} className="flex-1 max-w-md mx-4 relative hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={
              isSuperAdmin
                ? "Global Search: Club, Branch, Member ID, Athlete, Invoice..."
                : isClubAdmin
                ? `Search ${activeClub?.shortName || 'Club'} Records, Athletes, Coaches...`
                : `Search ${activeBranch?.name || 'Branch'} Members...`
            }
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white transition-all shadow-2xs"
          />
          {isSearching && (
            <div className="absolute right-8 top-2.5">
              <RefreshCw size={13} className="text-[#0284C7] animate-spin" />
            </div>
          )}
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
              }}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown Popover */}
        {isSearchOpen && searchQuery.trim().length >= 2 && (
          <div className="absolute top-11 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in max-h-[460px] overflow-y-auto">
            {/* Header info */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>
                  {isSuperAdmin
                    ? `Global Platform Scope (${totalResultCount} results)`
                    : `${activeClub?.shortName || 'Club'} Scope (${totalResultCount} results)`}
                </span>
              </span>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="text-xs text-[#0284C7] font-semibold hover:underline"
              >
                Close
              </button>
            </div>

            {totalResultCount === 0 && !isSearching && (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Search size={24} className="mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600">No records found</p>
                <p className="mt-1">
                  {isSuperAdmin
                    ? 'No matching clubs, branches, members or invoices across the platform.'
                    : `No matching records found in ${activeClub?.shortName || 'your assigned club'}.`}
                </p>
              </div>
            )}

            {/* Clubs Category */}
            {searchResults && searchResults.clubs.length > 0 && (
              <div className="p-2 border-b border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center space-x-1">
                  <Building2 size={12} className="text-[#0284C7]" />
                  <span>Clubs & Organizations ({searchResults.clubs.length})</span>
                </div>
                {searchResults.clubs.map(c => {
                  const globalIdx = flatResults.findIndex(r => r.id === c.id);
                  const isSelected = globalIdx === selectedResultIndex;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectResult(c)}
                      className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-sky-50 text-[#0284C7]' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-slate-900 block truncate">{c.title}</span>
                        <span className="text-[10px] text-slate-500 block truncate">{c.subtitle}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-[#0284C7] shrink-0 border border-sky-100">
                        {c.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Branches Category */}
            {searchResults && searchResults.branches.length > 0 && (
              <div className="p-2 border-b border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center space-x-1">
                  <GitBranch size={12} className="text-indigo-600" />
                  <span>Branches & Dojos ({searchResults.branches.length})</span>
                </div>
                {searchResults.branches.map(b => {
                  const globalIdx = flatResults.findIndex(r => r.id === b.id);
                  const isSelected = globalIdx === selectedResultIndex;
                  return (
                    <div
                      key={b.id}
                      onClick={() => handleSelectResult(b)}
                      className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-slate-900 block truncate">{b.title}</span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {b.clubName && <span className="font-semibold text-slate-700">{b.clubName} • </span>}
                          {b.subtitle}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 shrink-0 border border-indigo-100">
                        Dojo
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Members & Athletes Category */}
            {searchResults && searchResults.members.length > 0 && (
              <div className="p-2 border-b border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center space-x-1">
                  <Users size={12} className="text-emerald-600" />
                  <span>Athletes & Members ({searchResults.members.length})</span>
                </div>
                {searchResults.members.map(m => {
                  const globalIdx = flatResults.findIndex(r => r.id === m.id);
                  const isSelected = globalIdx === selectedResultIndex;
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleSelectResult(m)}
                      className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-slate-900 block truncate">{m.title}</span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {m.clubName && <span className="font-semibold text-[#0284C7]">{m.clubName} • </span>}
                          {m.subtitle}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 shrink-0 border border-emerald-100">
                        {m.status || 'Active'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Officials & Coaches Category */}
            {searchResults && searchResults.officials.length > 0 && (
              <div className="p-2 border-b border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center space-x-1">
                  <ShieldCheck size={12} className="text-amber-600" />
                  <span>Officials & Coaches ({searchResults.officials.length})</span>
                </div>
                {searchResults.officials.map(off => {
                  const globalIdx = flatResults.findIndex(r => r.id === off.id);
                  const isSelected = globalIdx === selectedResultIndex;
                  return (
                    <div
                      key={off.id}
                      onClick={() => handleSelectResult(off)}
                      className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-amber-50 text-amber-800' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-slate-900 block truncate">{off.title}</span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {off.clubName && <span className="font-semibold text-slate-700">{off.clubName} • </span>}
                          {off.subtitle}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 shrink-0 border border-amber-100">
                        Official
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Volunteers Category */}
            {searchResults && searchResults.volunteers.length > 0 && (
              <div className="p-2 border-b border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center space-x-1">
                  <HeartHandshake size={12} className="text-rose-600" />
                  <span>Volunteers ({searchResults.volunteers.length})</span>
                </div>
                {searchResults.volunteers.map(v => {
                  const globalIdx = flatResults.findIndex(r => r.id === v.id);
                  const isSelected = globalIdx === selectedResultIndex;
                  return (
                    <div
                      key={v.id}
                      onClick={() => handleSelectResult(v)}
                      className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-rose-50 text-rose-800' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-slate-900 block truncate">{v.title}</span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {v.clubName && <span className="font-semibold text-slate-700">{v.clubName} • </span>}
                          {v.subtitle}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 shrink-0 border border-rose-100">
                        Volunteer
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Parents / Guardians Category */}
            {searchResults && searchResults.parents.length > 0 && (
              <div className="p-2 border-b border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center space-x-1">
                  <UserCheck size={12} className="text-sky-600" />
                  <span>Parents & Guardians ({searchResults.parents.length})</span>
                </div>
                {searchResults.parents.map(p => {
                  const globalIdx = flatResults.findIndex(r => r.id === p.id);
                  const isSelected = globalIdx === selectedResultIndex;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectResult(p)}
                      className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-sky-50 text-sky-800' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-slate-900 block truncate">{p.title}</span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {p.clubName && <span className="font-semibold text-slate-700">{p.clubName} • </span>}
                          {p.subtitle}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-[#0284C7] shrink-0 border border-sky-100">
                        Guardian
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Invoices Category */}
            {searchResults && searchResults.invoices.length > 0 && (
              <div className="p-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center space-x-1">
                  <CreditCard size={12} className="text-slate-600" />
                  <span>Invoices & Billing ({searchResults.invoices.length})</span>
                </div>
                {searchResults.invoices.map(inv => {
                  const globalIdx = flatResults.findIndex(r => r.id === inv.id);
                  const isSelected = globalIdx === selectedResultIndex;
                  return (
                    <div
                      key={inv.id}
                      onClick={() => handleSelectResult(inv)}
                      className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        isSelected ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-slate-900 block truncate">{inv.title}</span>
                        <span className="text-[10px] text-slate-500 block truncate">{inv.subtitle}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0">
                        {inv.status || 'Invoice'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Role-Specific Selectors, Tasks, Approvals, Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Mobile Search Icon */}
        <button
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg touch-target flex items-center justify-center"
        >
          <Search size={18} />
        </button>

        {/* 1. SUPER ADMIN: PROMINENT SEARCHABLE GLOBAL CLUB SELECTOR */}
        {isSuperAdmin && (
          <div ref={clubSelectorRef} className="relative hidden sm:block">
            <button
              onClick={() => setIsClubSelectorOpen(!isClubSelectorOpen)}
              className="flex items-center space-x-2 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-300 hover:border-[#0284C7] rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 transition-all shadow-2xs group cursor-pointer"
            >
              <Building2 size={14} className="text-[#0284C7] shrink-0 group-hover:scale-110 transition-transform" />
              <div className="text-left max-w-[170px] truncate">
                <span className="block truncate font-black text-slate-900">
                  {activeClub ? (activeClub.displayName || activeClub.name) : 'All Registered Clubs'}
                </span>
                <span className="block text-[9px] text-[#0284C7] font-semibold tracking-wide">
                  {activeClub ? `${activeClub.state || 'Active'} • ${activeClub.id.substring(0, 14)}` : `${authorizedClubs.length} Clubs Available`}
                </span>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${isClubSelectorOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Searchable Club Dropdown Popover */}
            {isClubSelectorOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <Building2 size={13} className="text-[#0284C7]" />
                    <span>Global Club Selector</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-[#0284C7]">
                    {authorizedClubs.length} Clubs
                  </span>
                </div>

                {/* Search input inside dropdown */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
                  <input
                    type="text"
                    placeholder="Search by name, code or state..."
                    value={clubFilterText}
                    onChange={e => setClubFilterText(e.target.value)}
                    autoFocus
                    className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0284C7] focus:bg-white"
                  />
                </div>

                {/* Clubs List */}
                <div className="max-h-64 overflow-y-auto space-y-1 pt-1">
                  {filteredAuthorizedClubs.map(c => {
                    const isSelected = activeClub?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          switchClub(c.id);
                          setIsClubSelectorOpen(false);
                          setClubFilterText('');
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#0284C7] text-white font-bold shadow-xs'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className={`block truncate ${isSelected ? 'text-white' : 'font-bold text-slate-900'}`}>
                            {c.displayName ? `${c.displayName} (${c.name})` : c.name}
                          </span>
                          <span className={`block text-[10px] truncate ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>
                            {c.id.substring(0, 16)} • {c.state || 'Malaysia'}
                          </span>
                        </div>
                        {isSelected && <Check size={14} className="shrink-0 text-white" />}
                      </button>
                    );
                  })}
                  {filteredAuthorizedClubs.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No matching clubs found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. BRANCH/DOJO SELECTOR (Role-Adaptive) */}
        {/* Superadmin can toggle branches of the active club */}
        {/* Club Admin gets this as their main selector (with All Branches option) */}
        {/* Branch Manager gets this locked to their assigned branch */}
        {(isSuperAdmin || isClubAdmin || isBranchManager) && (
          <div className="relative hidden md:block">
            {authorizedBranches.length > 0 ? (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <GitBranch size={13} className="text-indigo-600 mr-1.5 shrink-0" />
                {authorizedBranches.length > 1 && !isBranchManager ? (
                  <select
                    value={activeBranch?.id || '__ALL__'}
                    onChange={e => {
                      switchBranch(e.target.value);
                    }}
                    className="bg-transparent font-semibold text-slate-800 focus:outline-hidden cursor-pointer max-w-[150px] truncate"
                  >
                    {(isSuperAdmin || isClubAdmin) && (
                      <option value="__ALL__">All Club Dojos</option>
                    )}
                    {authorizedBranches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold text-slate-800 max-w-[150px] truncate" title={activeBranch?.name || authorizedBranches[0]?.name}>
                    {activeBranch?.name || authorizedBranches[0]?.name || 'Honbu Dojo'}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-400">
                <GitBranch size={13} className="mr-1.5 text-slate-300" />
                <span>No Branches</span>
              </div>
            )}
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
        {['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN'].includes(activeRole) && (
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
            className="flex items-center space-x-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all touch-target cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {currentUser?.fullName.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden lg:block">
              <span className="block text-xs font-bold text-slate-900 leading-tight">
                {currentUser?.fullName || 'Guest'}
              </span>
              <span className="inline-block text-[10px] font-semibold text-[#0284C7] bg-[#E0F2FE] px-1.5 rounded">
                {activeRole.replace(/_/g, ' ')}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden lg:block" />
          </button>

          {/* User Menu Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in">
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
                        <span>{r.role.replace(/_/g, ' ')}</span>
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
