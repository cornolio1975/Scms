'use client';

/**
 * Scms Dynamic Multi-Role Dashboard Overview & Club Health Metrics
 * Sections 24 & 29: Dynamic dashboards for SuperAdmin, Club Admin, Branch Manager, Coach, Volunteer, and Parent
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { store } from '@/lib/store';
import {
  KarateTechIntegrationService,
  KarateTechTournament
} from '@/lib/integrations/karateTech';
import type { PlatformKpis } from '@/lib/platform-kpis';
import { getPlatformKpisAction } from '@/app/actions/multi-club';
import {
  Building2,
  Users,
  HeartHandshake,
  CalendarCheck2,
  CreditCard,
  Trophy,
  ShieldCheck,
  CheckSquare,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Award,
  RefreshCw,
  GitBranch,
  Edit2,
  Cloud,
} from 'lucide-react';

interface DashboardOverviewProps {
  onSelectModule: (moduleId: string) => void;
}

export default function DashboardOverview({ onSelectModule }: DashboardOverviewProps) {
  const { activeRole, activeClub, activeBranch, currentUser, refreshSession } = useAuth();
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncFeedback, setCloudSyncFeedback] = useState<string>('');
  const [liveTournaments, setLiveTournaments] = useState<KarateTechTournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [dbKpis, setDbKpis] = useState<PlatformKpis | null>(null);
  const [metricsError, setMetricsError] = useState('');
  const [metricsUpdatedAt, setMetricsUpdatedAt] = useState('');
  const isSuperAdmin = ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole);
  const [metricsRefresh, setMetricsRefresh] = useState(0);


  const [storeRevision, setStoreRevision] = useState(0);

  useEffect(() => {
    const handleSync = () => {
      setStoreRevision(v => v + 1);
    };
    window.addEventListener('scms:cloud-synced', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('scms:cloud-synced', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleSyncCloud = async () => {
    setIsCloudSyncing(true);
    setCloudSyncFeedback('');
    try {
      // 1. Authoritatively sync all clubs, branches, members, and approvals from Supabase
      const syncResult = await store.syncFromCloud();

      // 2. Refresh AuthContext session and permissions
      if (refreshSession) {
        await refreshSession();
      }

      // 3. Re-read platform KPI totals from database
      setMetricsRefresh(v => v + 1);

      // 4. Force component re-render with fresh store numbers
      setStoreRevision(v => v + 1);

      // 5. Sync KarateTech tournaments
      await syncTournaments();

      setCloudSyncFeedback(
        'Cloud sync complete: ' + syncResult.clubs + ' clubs, ' + syncResult.branches + ' branches, and ' + syncResult.members + ' members updated'
      );
      setTimeout(() => setCloudSyncFeedback(''), 5000);
    } catch (err) {
      console.error('Cloud sync error:', err);
      setCloudSyncFeedback('Cloud sync failed. Please check connection and retry.');
      setTimeout(() => setCloudSyncFeedback(''), 5000);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const syncTournaments = async () => {
    setIsSyncing(true);
    try {
      const data = await KarateTechIntegrationService.getUpcomingTournaments();
      setLiveTournaments(data);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.warn('Failed to auto-sync KarateTech tournaments:', e);
    } finally {
      setLoadingTournaments(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncTournaments();
    const interval = setInterval(syncTournaments, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setDbKpis(null);
    setMetricsError('');
    setMetricsUpdatedAt('');
    if (!isSuperAdmin) return;
    let cancelled = false;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await getPlatformKpisAction();
        if (cancelled) return;
        if (!result.success || !result.kpis) throw new Error(result.error || 'Unable to refresh database totals.');
        setDbKpis(result.kpis);
        setMetricsError('');
        setMetricsUpdatedAt(new Date().toLocaleTimeString());
      } catch {
        if (!cancelled) {
          setDbKpis(null);
          setMetricsError('Database totals could not be refreshed. Please retry.');
        }
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const interval = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isSuperAdmin, currentUser?.id, metricsRefresh]);

  const isClubAdmin = ['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(activeRole);

  const branches = React.useMemo(() => store.getBranches(activeClub?.id), [activeClub?.id, storeRevision]);
  const members = React.useMemo(() => store.getMembers(activeClub?.id, activeBranch?.id), [activeClub?.id, activeBranch?.id, storeRevision]);
  const athletes = React.useMemo(() => members.filter(m => m.isAthlete), [members]);
  const volunteers = React.useMemo(() => store.getVolunteers(activeClub?.id), [activeClub?.id, storeRevision]);
  const invoices = React.useMemo(() => store.invoices.filter(i => (activeClub ? i.clubId === activeClub.id : true)), [activeClub?.id, storeRevision]);
  const totalOutstanding = React.useMemo(() => invoices.reduce((acc, i) => acc + i.balanceDue, 0), [invoices]);
  const openTasks = React.useMemo(() => store.tasks.filter(t => t.status === 'Open'), [storeRevision]);
  const metric = (key: keyof PlatformKpis) => dbKpis?.[key] ?? (metricsError ? 'Unavailable' : '—');

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. WELCOME BANNER */}
      <div className="bg-gradient-to-r from-sky-600 via-[#0284C7] to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
            <Sparkles size={12} />
            <span>{activeRole.replace('_', ' ')} PORTAL</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Welcome back, {currentUser?.fullName}
          </h1>
          <p className="text-xs sm:text-sm text-sky-100 max-w-xl">
            {isSuperAdmin
              ? 'Platform wide multi-tenant oversight and KarateTech 3.0 bridge synchronization.'
              : activeBranch
              ? `Managing ${activeBranch.name} (${activeClub?.displayName || activeClub?.shortName || activeClub?.name || 'Senshi Karate'}) operational rosters, sessions, and tournament entries.`
              : `Managing ${activeClub?.displayName || activeClub?.shortName || activeClub?.name || 'Club'} operational rosters, sessions, and tournament entries.`}
          </p>
        </div>

        {/* Quick Shortcut Buttons */}
        <div className="flex flex-wrap gap-2">
          {isSuperAdmin && (
            <button
              onClick={() => onSelectModule('approvals')}
              className="px-4 py-2 rounded-xl bg-white text-[#0284C7] font-bold text-xs hover:bg-sky-50 shadow-xs transition-colors flex items-center space-x-1.5 touch-target"
            >
              <ShieldCheck size={14} />
              <span>Pending Approvals ({metric('pendingApprovals')})</span>
            </button>
          )}

          {activeRole === 'BRANCH_MANAGER' && (
            <button
              onClick={() => onSelectModule('branch-profile')}
              className="px-4 py-2 rounded-xl bg-white text-[#0284C7] font-bold text-xs hover:bg-sky-50 shadow-xs transition-colors flex items-center space-x-1.5 touch-target"
            >
              <Edit2 size={14} />
              <span>Edit Branch Profile</span>
            </button>
          )}

          {['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(activeRole) && (
            <button
              onClick={() => onSelectModule('branches')}
              className="px-4 py-2 rounded-xl bg-white text-[#0284C7] font-bold text-xs hover:bg-sky-50 shadow-xs transition-colors flex items-center space-x-1.5 touch-target"
            >
              <GitBranch size={14} />
              <span>Manage Branches ({branches.length})</span>
            </button>
          )}

          {!isSuperAdmin && (
            <button
              onClick={() => onSelectModule('take-attendance')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 touch-target"
            >
              <CalendarCheck2 size={14} />
              <span>Take Attendance</span>
            </button>
          )}

          <button
            onClick={handleSyncCloud}
            disabled={isCloudSyncing}
            className="px-4 py-2 rounded-xl bg-sky-950/40 border border-white/20 text-white font-bold text-xs hover:bg-sky-950/60 shadow-xs transition-colors flex items-center space-x-1.5 touch-target disabled:opacity-60"
            title="Sync live database and cloud state across devices"
          >
            <Cloud size={14} className={isCloudSyncing ? "text-sky-300 animate-pulse" : "text-sky-300"} />
            <RefreshCw size={12} className={isCloudSyncing ? "animate-spin" : ""} />
            <span>{isCloudSyncing ? "Syncing..." : "Sync Cloud"}</span>
          </button>
          <button
            onClick={() => onSelectModule('kt-tournaments')}
            className="px-4 py-2 rounded-xl bg-sky-950/40 border border-white/20 text-white font-bold text-xs hover:bg-sky-950/60 shadow-xs transition-colors flex items-center space-x-1.5 touch-target"
          >
            <Trophy size={14} />
            <span>KarateTech Bridge</span>
          </button>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs" role="status">
          <span className={metricsError ? 'text-rose-600' : 'text-slate-500'}>
            {metricsError || (metricsUpdatedAt ? `Database totals updated at ${metricsUpdatedAt}` : 'Loading database totals…')}
          </span>
          <button onClick={() => setMetricsRefresh(value => value + 1)} className="text-sky-700 font-semibold touch-target">
            Refresh totals
          </button>
        </div>
      )}

      {cloudSyncFeedback && (
        <div
          role="status"
          className={`text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 font-medium transition-all ${
            cloudSyncFeedback.includes('failed')
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          <Cloud size={14} className={cloudSyncFeedback.includes('failed') ? 'text-rose-500' : 'text-emerald-500'} />
          <span>{cloudSyncFeedback}</span>
        </div>
      )}

      {/* 2. OPERATIONAL KPI METRIC CARDS (Sections 24, 29 & 32) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isSuperAdmin ? (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Clubs</span>
                <Building2 size={18} className="text-[#0284C7]" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">{metric('totalClubs')}</span>
              <span className="text-[11px] text-emerald-600 font-semibold block">
                {metric('activeClubs')} Active • {metric('pendingApprovalClubs')} Pending
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Branches</span>
                <Building2 size={18} className="text-indigo-600" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">{metric('totalBranches')}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Across all states</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">KarateTech Bridge</span>
                <Trophy size={18} className="text-amber-500" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">Connected</span>
              <span className="text-[11px] text-emerald-600 font-semibold block">2 Sanctioned Meets</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Approvals Queue</span>
                <ShieldCheck size={18} className="text-rose-500" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">
                {metric('pendingApprovals')}
              </span>
              <span className="text-[11px] text-amber-600 font-semibold block">Requires Review</span>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Active Members</span>
                <Users size={18} className="text-[#0284C7]" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">{members.length}</span>
              <span className="text-[11px] text-emerald-600 font-semibold block">
                {athletes.length} Registered Athletes
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Attendance Rate</span>
                <CalendarCheck2 size={18} className="text-emerald-600" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">94.2%</span>
              <span className="text-[11px] text-slate-500 font-medium block">Last 30 Days</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Outstanding Dues</span>
                <CreditCard size={18} className="text-amber-500" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">
                MYR {totalOutstanding.toFixed(0)}
              </span>
              <span className="text-[11px] text-amber-600 font-semibold block">Auto-reminders active</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Active Volunteers</span>
                <HeartHandshake size={18} className="text-indigo-600" />
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">{volunteers.length}</span>
              <span className="text-[11px] text-indigo-600 font-semibold block">70.5 Total Hours</span>
            </div>
          </>
        )}
      </div>

      {/* 3. MIDDLE SECTION: CLUB HEALTH & RECENT ACTIVITIES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Operational Highlights */}
        <div className="lg:col-span-2 space-y-6">
          {/* KarateTech 3.0 Connected Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Trophy size={18} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-base text-slate-900 leading-snug">
                      KarateTech 3.0 Live Tournaments
                    </h3>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Live Synced</span>
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">Official Sanctioned Championships</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={syncTournaments}
                  disabled={isSyncing}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
                  title="Auto-sync latest tournaments from KarateTech 3.0"
                >
                  <RefreshCw size={12} className={isSyncing ? 'animate-spin text-[#0284C7]' : ''} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
                <button
                  onClick={() => onSelectModule('kt-tournaments')}
                  className="text-xs font-bold text-[#0284C7] hover:underline flex items-center space-x-1"
                >
                  <span>View All</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {loadingTournaments ? (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center space-x-2 text-xs text-slate-500">
                <RefreshCw size={14} className="animate-spin text-[#0284C7]" />
                <span>Auto-syncing latest tournaments from KarateTech 3.0...</span>
              </div>
            ) : liveTournaments.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-1">
                <span className="text-xs font-bold text-slate-700 block">No Published Tournaments</span>
                <span className="text-[11px] text-slate-400 block">There are no upcoming published tournaments currently in KarateTech 3.0.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {liveTournaments.slice(0, 3).map(t => (
                  <div
                    key={t.tournamentId}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-sky-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-slate-900 block">
                          {t.tournamentName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {t.status || 'Published'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-slate-700">{t.tournamentDate}</span>
                        <span>•</span>
                        <span>{t.venue}, {t.state}</span>
                        {t.organizer && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400 font-medium">Org: {t.organizer}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectModule('kt-tournaments')}
                      className="py-1.5 px-3.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center space-x-1.5 self-start sm:self-center cursor-pointer"
                    >
                      <span>Draft Roster</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Training Schedule */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Today's Class Rosters</h3>
              <button
                onClick={() => onSelectModule('coach-console')}
                className="text-xs font-bold text-[#0284C7] hover:underline"
              >
                Open Coach Console
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Elite Kumite Squad (16+)</span>
                  <span className="text-slate-500">Honbu Dojo Tatami Arena • 19:30 - 21:30</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  18 Present
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Activity Feed (Section 25) */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Activity Stream</h3>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Audit Feed</span>
            </div>

            <div className="space-y-3">
              {store.activityLogs.slice(0, 5).map(act => (
                <div key={act.id} className="text-xs space-y-0.5 pb-2.5 border-b border-slate-100 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{act.action}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">{act.details}</p>
                  <span className="text-[10px] font-medium text-slate-400">by {act.userName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
