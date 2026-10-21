'use client';

/**
 * Scms Approved Managers Directory
 * Displays all approved Club Admins and Branch Managers across mock store and live Supabase.
 * Features airtight manager deduplication, branch/club context awareness, and unified contact cards.
 */

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, UserCheck, Search, Building2, GitBranch, Mail, Phone, Filter } from 'lucide-react';

interface ApprovedManagersProps {
  clubId?: string;
  branchId?: string;
}

interface ManagerRecord {
  id: string;
  role: string;
  participant_status: string;
  club_id: string;
  club_name: string;
  branch_ids: string[];
  branches: string[];
  branch_name: string;
  profiles: {
    full_name: string;
    email: string;
    phone?: string;
  };
}

export default function ApprovedManagers({ clubId, branchId }: ApprovedManagersProps = {}) {
  const { activeClub, activeBranch, activeRole } = useAuth();
  const currentClubId = clubId || activeClub?.id;
  const currentBranchId = branchId !== undefined ? branchId : activeBranch?.id;

  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState<'CONTEXT' | 'ALL'>('ALL');
  const supabase = createClient();

  useEffect(() => {
    fetchManagers();
  }, [currentClubId, currentBranchId, activeClub, activeRole]);

  // Helper to normalize names for deduplication (removes honorifics, extra spaces, special chars)
  const normalizeName = (name: string): string => {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/^(shihan|sensei|coach|master|guru|sifu|dato'?|datuk|tan sri|puan|encik|mr|mrs|ms|dr)\.?\s+/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const normalizeEmail = (email: string): string => {
    if (!email) return '';
    return email.toLowerCase().trim();
  };

  const isGenericVenueEmail = (email: string): boolean => {
    return /^(puchong|usj|cyber|bangsar|admin|info|sa|arena|brickfields)@/i.test(email);
  };

  const fetchManagers = async () => {
    setLoading(true);
    const unifiedManagers: ManagerRecord[] = [];

    const upsertManager = (record: {
      id: string;
      role: string;
      participant_status: string;
      club_id: string;
      club_name: string;
      branch_id?: string;
      branch_name?: string;
      profiles: {
        full_name: string;
        email: string;
        phone?: string;
      };
    }) => {
      const incomingName = record.profiles?.full_name?.trim() || '';
      const incomingEmail = normalizeEmail(record.profiles?.email || '');
      const incomingNormName = normalizeName(incomingName);

      // Find if this person is already recorded
      const existing = unifiedManagers.find(m => {
        const mEmail = normalizeEmail(m.profiles.email);
        const mNormName = normalizeName(m.profiles.full_name);

        // 1. Direct email match
        if (incomingEmail && mEmail && incomingEmail === mEmail) return true;

        // 2. Direct ID match
        if (m.id === record.id) return true;

        // 3. Name match (after removing titles like Shihan, Sensei, Coach)
        if (incomingNormName.length >= 3 && mNormName.length >= 3) {
          if (incomingNormName === mNormName) return true;
          if (incomingNormName.startsWith(mNormName) || mNormName.startsWith(incomingNormName)) return true;
        }

        return false;
      });

      if (existing) {
        // Upgrade role to CLUB_ADMIN if applicable
        if (record.role === 'CLUB_ADMIN' && existing.role !== 'CLUB_ADMIN') {
          existing.role = 'CLUB_ADMIN';
        }

        // Upgrade email from venue alias to personal email
        if (isGenericVenueEmail(existing.profiles.email) && !isGenericVenueEmail(incomingEmail) && incomingEmail) {
          existing.profiles.email = incomingEmail;
        }

        // Prefer longer/fuller official display name
        if (incomingName.length > existing.profiles.full_name.length) {
          existing.profiles.full_name = incomingName;
        }

        // Merge phone number
        if (record.profiles?.phone && (!existing.profiles.phone || existing.profiles.phone === '—')) {
          existing.profiles.phone = record.profiles.phone;
        }

        // Merge branches
        if (record.branch_id && !existing.branch_ids.includes(record.branch_id)) {
          existing.branch_ids.push(record.branch_id);
        }
        if (record.branch_name && !existing.branches.includes(record.branch_name)) {
          existing.branches.push(record.branch_name);
          existing.branch_name = existing.branches.join(' • ');
        }
      } else {
        unifiedManagers.push({
          id: record.id,
          role: record.role,
          participant_status: record.participant_status || 'ACTIVE',
          club_id: record.club_id,
          club_name: record.club_name,
          branch_ids: record.branch_id ? [record.branch_id] : [],
          branches: record.branch_name ? [record.branch_name] : [],
          branch_name: record.branch_name || '',
          profiles: {
            full_name: incomingName || 'Club Official',
            email: incomingEmail || '—',
            phone: record.profiles?.phone || '—'
          }
        });
      }
    };

    // 1. Fetch from Supabase user_roles with joined clubs and profiles
    try {
      let query = supabase
        .from('user_roles')
        .select(`
          id,
          role,
          club_id,
          branch_id,
          participant_status,
          clubs (
            id,
            name,
            display_name
          ),
          club_branches (
            id,
            name
          ),
          profiles (
            id,
            full_name,
            email,
            phone
          )
        `)
        .in('role', ['BRANCH_MANAGER', 'CLUB_ADMIN', 'CLUB_CO_ADMIN']);

      const { data: dbData } = await query;
      if (dbData && dbData.length > 0) {
        dbData.forEach((r: any) => {
          upsertManager({
            id: r.id,
            role: r.role,
            participant_status: r.participant_status || 'ACTIVE',
            club_id: r.club_id,
            club_name: r.clubs?.display_name || r.clubs?.name || 'Senshi Goju-Ryu',
            branch_id: r.branch_id,
            branch_name: r.club_branches?.name,
            profiles: {
              full_name: r.profiles?.full_name || 'System Administrator',
              email: r.profiles?.email || '—',
              phone: r.profiles?.phone || '—'
            }
          });
        });
      }
    } catch (e) {
      console.warn('Error fetching Supabase managers:', e);
    }

    // 2. Fetch from In-Memory / LocalStorage Store (Users, Clubs, Branches)
    try {
      const { store } = await import('@/lib/store');

      // A. From store.users
      store.users.forEach((u: any) => {
        const mgrRole = u.roles?.find((r: any) =>
          ['CLUB_ADMIN', 'BRANCH_MANAGER', 'CLUB_CO_ADMIN'].includes(r.role)
        );
        if (mgrRole) {
          const parentClub = store.getClubById(mgrRole.clubId);
          const branch = mgrRole.branchId ? store.branches.find(b => b.id === mgrRole.branchId) : null;
          upsertManager({
            id: u.id,
            role: mgrRole.role,
            participant_status: 'ACTIVE',
            club_id: mgrRole.clubId,
            club_name: parentClub?.displayName || parentClub?.name || 'Senshi Goju-Ryu',
            branch_id: mgrRole.branchId,
            branch_name: branch?.name,
            profiles: {
              full_name: u.fullName,
              email: u.email,
              phone: u.phone
            }
          });
        }
      });

      // B. From store.branches (Dojo Branch Managers)
      store.branches.forEach((b: any) => {
        if (b.managerName) {
          const parentClub = store.getClubById(b.clubId);
          upsertManager({
            id: `branch-mgr-${b.id}`,
            role: 'BRANCH_MANAGER',
            participant_status: 'ACTIVE',
            club_id: b.clubId,
            club_name: parentClub?.displayName || parentClub?.name || 'Senshi Goju-Ryu',
            branch_id: b.id,
            branch_name: b.name,
            profiles: {
              full_name: b.managerName,
              email: b.email || `${b.managerName.toLowerCase().replace(/\s+/g, '.')}@senshikarate.org`,
              phone: b.phone
            }
          });
        }
      });

      // C. From store.clubs (Primary Club Admins)
      store.getClubs().forEach((c: any) => {
        if (c.primaryAdminName) {
          upsertManager({
            id: `club-adm-${c.id}`,
            role: 'CLUB_ADMIN',
            participant_status: 'ACTIVE',
            club_id: c.id,
            club_name: c.displayName || c.name,
            profiles: {
              full_name: c.primaryAdminName,
              email: c.primaryAdminEmail || c.email || 'admin@senshikarate.org',
              phone: c.primaryAdminPhone || c.phone
            }
          });
        }
      });
    } catch (e) {
      console.warn('Error loading mock managers:', e);
    }

    setManagers(unifiedManagers);
    setLoading(false);
  };

  // Filter managers by search term, role, and context scope
  const filteredManagers = managers.filter(m => {
    // 1. Context scope filter
    if (scopeFilter === 'CONTEXT' && currentClubId) {
      // Must match active club
      if (m.club_id !== currentClubId) return false;

      // If a specific branch is selected (and not all), match branch or allow club admins
      if (currentBranchId && currentBranchId !== '__ALL__') {
        const matchesBranch = m.branch_ids.includes(currentBranchId);
        const isClubWideAdmin = m.role === 'CLUB_ADMIN';
        if (!matchesBranch && !isClubWideAdmin) return false;
      }
    }

    // 2. Search term
    const term = searchTerm.toLowerCase();
    const nameMatch = (m.profiles?.full_name || '').toLowerCase().includes(term);
    const emailMatch = (m.profiles?.email || '').toLowerCase().includes(term);
    const clubMatch = (m.club_name || '').toLowerCase().includes(term);
    const branchMatch = (m.branch_name || '').toLowerCase().includes(term);
    const matchesSearch = !term || nameMatch || emailMatch || clubMatch || branchMatch;

    // 3. Role filter
    const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
            <ShieldCheck size={14} />
            <span>Governance & Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Approved Managers
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Directory of officially approved Club Admins and Branch Managers with zero duplicated records.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-100 text-[#0284C7] text-xs font-bold">
            Total Approved: {filteredManagers.length}
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, club, or dojo..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Scope Selector */}
          {activeClub && (
            <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
              <button
                onClick={() => setScopeFilter('ALL')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  scopeFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All Clubs
              </button>
              <button
                onClick={() => setScopeFilter('CONTEXT')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  scopeFilter === 'CONTEXT'
                    ? 'bg-[#0284C7] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {activeClub.displayName || activeClub.name}
              </button>
            </div>
          )}

          {/* Role Filter Pills */}
          <div className="flex items-center space-x-1">
            {['ALL', 'CLUB_ADMIN', 'BRANCH_MANAGER'].map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  roleFilter === r
                    ? 'bg-[#0284C7] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="text-sm text-slate-500 p-12 text-center animate-pulse font-medium">
          Loading approved managers directory...
        </div>
      ) : filteredManagers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-xs text-slate-500">
          No approved managers matching your search or filters found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredManagers.map((manager, idx) => (
            <div
              key={`${manager.id}-${idx}`}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col items-center text-center space-y-3 relative overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="absolute top-0 w-full h-2 bg-emerald-500"></div>
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-1 border border-emerald-100">
                <UserCheck size={28} />
              </div>

              <div className="w-full space-y-1">
                <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                  {manager.profiles?.full_name}
                </h3>
                <p className="text-xs text-slate-500 font-medium truncate">
                  {manager.profiles?.email}
                </p>

                <div className="pt-2">
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black bg-[#0284C7]/10 text-[#0284C7] border border-[#0284C7]/20 uppercase tracking-wider">
                    {manager.role.replace('_', ' ')}
                  </span>
                </div>

                {manager.club_name && (
                  <div className="pt-2 text-xs text-slate-600 font-semibold flex items-center justify-center space-x-1.5">
                    <Building2 size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{manager.club_name}</span>
                  </div>
                )}

                {manager.branch_name && (
                  <div className="text-[11px] text-slate-500 flex items-center justify-center space-x-1.5">
                    <GitBranch size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">{manager.branch_name}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 w-full border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono text-[10px]">
                  ID: {String(manager.id).substring(0, 12)}...
                </span>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>ACTIVE</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
