'use client';

/**
 * Scms All Clubs Management — Superadmin Platform Control Center
 * Real-time database backed KPIs, searchable/filterable multi-club directory, CSV export,
 * and seamless deep-dive into the 6-tab Club Details Workspace.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getPlatformKpisAction,
  getClubsListAction,
  exportClubsCsvAction,
  deleteClubAction
} from '@/app/actions/multi-club';
import ClubDetailsWorkspace from './ClubDetailsWorkspace';
import {
  Building2,
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  Users,
  Trophy,
  Search,
  Filter,
  Download,
  Plus,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Trash2
} from 'lucide-react';

interface AllClubsManagementProps {
  initialSelectedClubId?: string;
}

export default function AllClubsManagement({ initialSelectedClubId }: AllClubsManagementProps) {
  const { activeRole, currentUser } = useAuth();
  const isSuperAdmin = ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole);

  const [selectedClubId, setSelectedClubId] = useState<string | null>(initialSelectedClubId || null);

  // Live KPIs
  const [kpis, setKpis] = useState<any>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);

  // Clubs Table State
  const [clubs, setClubs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [approvalFilter, setApprovalFilter] = useState('ALL');
  const [isExporting, setIsExporting] = useState(false);

  // Quick Register Modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Load KPIs
  const loadKpis = async () => {
    setLoadingKpis(true);
    try {
      const res = await getPlatformKpisAction();
      if (res.success && res.kpis) {
        setKpis(res.kpis);
      }
    } catch (e) {
      console.warn('Failed to load KPIs:', e);
    } finally {
      setLoadingKpis(false);
    }
  };

  // Load Clubs List
  const loadClubs = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await getClubsListAction({
        search: searchTerm,
        status: statusFilter,
        state: stateFilter,
        approvalStatus: approvalFilter,
        page,
        limit: 10
      });
      if (res.success) {
        setClubs(res.clubs);
        setTotalCount(res.total);
        setTotalPages(res.totalPages || 1);
      }
    } catch (e) {
      console.error('Failed to load clubs:', e);
    } finally {
      setLoadingList(false);
    }
  }, [searchTerm, statusFilter, stateFilter, approvalFilter, page]);

  useEffect(() => {
    loadKpis();
  }, []);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await exportClubsCsvAction({
        search: searchTerm,
        status: statusFilter,
        state: stateFilter,
        approvalStatus: approvalFilter
      });

      if (res.success && res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `scms_clubs_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('Export failed: ' + (res.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteClub = async (clubId: string, clubName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${clubName}"? This will delete all branches, members, and data associated with this club. This action cannot be undone.`)) {
      return;
    }

    // Optimistically remove from state
    setClubs(prev => prev.filter(c => c.id !== clubId));
    setTotalCount(prev => Math.max(0, prev - 1));

    try {
      // 1. Delete from local store if in-memory
      const { store } = await import('@/lib/store');
      store.deleteClub(clubId, currentUser?.fullName || 'SuperAdmin');

      // 2. Server action deletion
      await deleteClubAction(clubId, currentUser?.fullName || 'SuperAdmin');

      await Promise.all([loadKpis(), loadClubs()]);
    } catch (err: any) {
      console.error('Failed to delete club:', err);
      alert('Failed to delete club: ' + err.message);
      loadClubs();
    }
  };

  // If a club is selected, display the 6-tab Club Details Workspace
  if (selectedClubId) {
    return (
      <ClubDetailsWorkspace
        clubId={selectedClubId}
        onBack={() => {
          setSelectedClubId(null);
          loadClubs();
          loadKpis();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* 1. TOP HEADER BANNER */}
      <div className="bg-gradient-to-r from-sky-700 via-[#0284C7] to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
            <Building2 size={12} />
            <span>PLATFORM SUPERADMIN OVERSIGHT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            All Clubs & Branch Governance
          </h1>
          <p className="text-xs sm:text-sm text-sky-100 max-w-xl">
            Live database-backed monitoring of all sports clubs, dojos, approvals, and KarateTech 3.0 synchronization.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl bg-white text-[#0284C7] font-bold text-xs hover:bg-sky-50 shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Download size={14} />
            <span>{isExporting ? 'Exporting...' : 'Export Clubs CSV'}</span>
          </button>
          <a
            href="/register-club"
            className="px-4 py-2 rounded-xl bg-sky-950/40 border border-white/20 text-white font-bold text-xs hover:bg-sky-950/60 shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Plus size={14} />
            <span>Register New Club</span>
          </a>
        </div>
      </div>

      {/* 2. LIVE DATABASE KPIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Registered Clubs</span>
            <Building2 size={18} className="text-[#0284C7]" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 block">
            {loadingKpis ? '—' : kpis?.totalClubs ?? 0}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold block">
            {kpis?.activeClubs ?? 0} Active • {kpis?.suspendedClubs ?? 0} Suspended
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Approvals</span>
            <ShieldCheck size={18} className="text-amber-500" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-amber-600 block">
            {loadingKpis ? '—' : kpis?.pendingApprovalClubs ?? 0}
          </span>
          <span className="text-[11px] text-slate-500 font-medium block">
            {kpis?.pendingApprovals ?? 0} Total pending workflow requests
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Branches / Dojos</span>
            <GitBranch size={18} className="text-indigo-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 block">
            {loadingKpis ? '—' : kpis?.totalBranches ?? 0}
          </span>
          <span className="text-[11px] text-indigo-600 font-semibold block">
            Across registered clubs
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">KarateTech Synced</span>
            <Trophy size={18} className="text-emerald-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-emerald-700 block">
            {loadingKpis ? '—' : kpis?.totalSyncedParticipants ?? 0}
          </span>
          <span className="text-[11px] text-slate-500 font-medium block">
            {kpis?.totalConflicts ?? 0} Conflicts • {kpis?.totalSyncErrors ?? 0} Errors
          </span>
        </div>
      </div>

      {/* 3. SEARCH & FILTER CONTROLS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by club name, display name, reg no, district, or city..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0284C7] bg-white text-slate-700"
            >
              <option value="ALL">Status: All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Suspended">Suspended</option>
              <option value="Draft">Draft</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* State Filter */}
          <div>
            <select
              value={stateFilter}
              onChange={e => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0284C7] bg-white text-slate-700"
            >
              <option value="ALL">State: All States</option>
              <option value="Selangor">Selangor</option>
              <option value="Kuala Lumpur">Kuala Lumpur</option>
              <option value="Johor">Johor</option>
              <option value="Penang">Penang</option>
              <option value="Perak">Perak</option>
              <option value="Kedah">Kedah</option>
              <option value="Melaka">Melaka</option>
              <option value="Negeri Sembilan">Negeri Sembilan</option>
              <option value="Pahang">Pahang</option>
              <option value="Kelantan">Kelantan</option>
              <option value="Terengganu">Terengganu</option>
              <option value="Sabah">Sabah</option>
              <option value="Sarawak">Sarawak</option>
            </select>
          </div>
        </div>

        {/* Approval Filter Chips */}
        <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span className="font-bold text-slate-600">Approval Status:</span>
          {['ALL', 'APPROVED', 'PENDING', 'REJECTED'].map(appr => (
            <button
              key={appr}
              onClick={() => {
                setApprovalFilter(appr);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                approvalFilter === appr
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {appr}
            </button>
          ))}
          <span className="ml-auto text-slate-400 font-medium">
            Found {totalCount} registered club{totalCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* 4. CLUBS DIRECTORY TABLE */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        {loadingList ? (
          <div className="p-12 text-center text-slate-400 animate-pulse font-medium text-xs">
            Querying clubs database...
          </div>
        ) : clubs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No clubs matching your filter criteria were found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Official Club Name</th>
                  <th className="py-3 px-4">KT 3.0 Display Name</th>
                  <th className="py-3 px-4">Reg No</th>
                  <th className="py-3 px-4">State / District</th>
                  <th className="py-3 px-4 text-center">Branches</th>
                  <th className="py-3 px-4 text-center">Members</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Approval</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clubs.map(c => {
                  const isAppr = c.approval_status === 'APPROVED';
                  const isAct = c.status === 'Active' || c.status === 'ACTIVE';
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {c.name}
                        <span className="block text-[11px] text-slate-400 font-normal font-mono">
                          ID: {c.id.substring(0, 16)}...
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-lg bg-sky-50 border border-sky-100 font-bold text-sky-800 text-[11px]">
                          {c.display_name || c.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{c.registration_no || '—'}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {[c.district, c.city, c.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {c.branchCount}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {c.memberCount}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isAct ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isAppr ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.approval_status || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setSelectedClubId(c.id)}
                            className="px-3 py-1.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold text-[11px] transition-colors inline-flex items-center space-x-1"
                            title="Manage Club"
                          >
                            <span>Manage</span>
                            <ArrowRight size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteClub(c.id, c.display_name || c.name)}
                            className="p-1.5 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 hover:border-rose-300 transition-colors"
                            title="Delete Club"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. PAGINATION */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <span>
            Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} clubs)
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
