'use client';

/**
 * Scms Coach Console Component
 * Section 16 & 39: Dedicated Coach Console, mobile-first attendance taking, athlete progression, and squad management
 */

import React, { useState } from 'react';
import { store } from '@/lib/store';
import { useAuth } from '@/context/AuthContext';
import { Member, AttendanceStatus } from '@/types';
import {
  Award,
  CalendarCheck2,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Save,
  MessageSquare,
  Trophy,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface CoachConsoleProps {
  clubId?: string;
  branchId?: string;
}

export default function CoachConsole({ clubId, branchId }: CoachConsoleProps = {}) {
  const { currentUser, activeClub, activeBranch } = useAuth();
  const effectiveClubId = clubId || activeClub?.id || 'Scms-CLUB-000001';
  const effectiveBranchId = branchId !== '__ALL__' ? (branchId || activeBranch?.id) : undefined;

  let clubSessions = store.sessions.filter(s => s.clubId === effectiveClubId);
  if (effectiveBranchId) {
    clubSessions = clubSessions.filter(s => !s.branchId || s.branchId === effectiveBranchId);
  }
  const defaultSessionId = clubSessions[0]?.id || 'sess-01';

  const [selectedSessionId, setSelectedSessionId] = useState<string>(defaultSessionId);
  const [rosterStatus, setRosterStatus] = useState<Record<string, AttendanceStatus>>({
    'Scms-MEM-000001': 'Present',
    'Scms-MEM-000002': 'Present',
    'Scms-MEM-000004': 'Late',
  });
  const [rosterRemarks, setRosterRemarks] = useState<Record<string, string>>({
    'Scms-MEM-000001': 'Sharp kata timing and focus',
    'Scms-MEM-000004': 'Puchong traffic delay',
  });
  const [isSaved, setIsSaved] = useState(false);

  let trainingGroups = store.trainingGroups.filter(
    tg => tg.clubId === effectiveClubId
  );
  if (effectiveBranchId) {
    trainingGroups = trainingGroups.filter(tg => !tg.branchId || tg.branchId === effectiveBranchId);
  }

  const athletes = store.getMembers(effectiveClubId, effectiveBranchId).filter(m => m.isAthlete);
  const activeSession = clubSessions.find(s => s.id === selectedSessionId) || clubSessions[0] || store.sessions[0];

  const handleStatusChange = (memberId: string, status: AttendanceStatus) => {
    setRosterStatus(prev => ({ ...prev, [memberId]: status }));
    setIsSaved(false);
  };

  const handleSaveAttendance = () => {
    if (!activeSession) return;
    const records = Object.entries(rosterStatus).map(([memberId, status]) => ({
      memberId,
      status,
      remarks: rosterRemarks[memberId],
    }));

    store.recordAttendance(activeSession.id, records, currentUser?.fullName || 'Coach');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
            <Award size={14} />
            <span>Operational Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Coach Console & Roster
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Conduct daily training roll calls, log technical notes, and oversee athlete championship preparation.
          </p>
        </div>

        {isSaved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Attendance Saved Successfully!</span>
          </div>
        )}
      </div>

      {/* Grid: Left = Take Attendance Session (Mobile First), Right = Squad Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ATTENDANCE ROLL CALL (2 Columns on Large Screens) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#0284C7] tracking-wider block">
                  Today's Active Class
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 leading-snug">
                  {activeSession?.groupName || 'Elite Kumite Squad'}
                </h3>
                <span className="text-xs text-slate-500">
                  {activeSession?.venue} • {activeSession?.startTime} - {activeSession?.endTime}
                </span>
              </div>

              <button
                onClick={handleSaveAttendance}
                className="py-2.5 px-5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-xs transition-all touch-target"
              >
                <Save size={16} />
                <span>Save Attendance</span>
              </button>
            </div>

            {/* Roster Cards (Touch Optimized for Mobile Coaches) */}
            <div className="space-y-3">
              {athletes.slice(0, 5).map(ath => {
                const currentStatus = rosterStatus[ath.id] || 'Present';

                return (
                  <div
                    key={ath.id}
                    className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                        {ath.fullName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-extrabold text-sm text-slate-900 block leading-tight">
                          {ath.fullName}
                        </span>
                        <span className="text-xs text-slate-500">
                          {ath.id} • {ath.sportData?.beltRank || 'Karateka'} • {ath.sportData?.weightKg || 0}kg
                        </span>
                      </div>
                    </div>

                    {/* Touch Friendly Attendance Selector */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['Present', 'Absent', 'Late', 'Excused'] as AttendanceStatus[]).map(st => {
                        const isSelected = currentStatus === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleStatusChange(ath.id, st)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all touch-target ${
                              isSelected
                                ? st === 'Present'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : st === 'Absent'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : st === 'Late'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'bg-slate-600 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Training Groups & Tournament Preparation */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">Assigned Training Groups</h3>

            <div className="space-y-3">
              {trainingGroups.map(tg => (
                <div key={tg.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{tg.name}</span>
                    <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                      Cap: {tg.capacity}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 block">{tg.scheduleDescription}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tournament Qualified Athletes */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md space-y-3">
            <div className="flex items-center space-x-2 text-sky-300 font-extrabold text-xs uppercase tracking-wider">
              <Trophy size={14} />
              <span>Championship Squad</span>
            </div>
            <h4 className="font-black text-lg">Upcoming KarateTech Tournament</h4>
            <p className="text-xs text-slate-300">
              Kelab Senshi Open 2026. 2 athletes registered in draft roster with weigh-in qualifications verified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
