'use client';

/**
 * Scms Dedicated Volunteer System & Mobile Volunteer Dashboard
 * Sections 13, 14 & 38: Strict Member-Level role, duty assignment workflow, hours tracker, mobile Check-In / Check-Out
 */

import React, { useState } from 'react';
import { store } from '@/lib/store';
import { useAuth } from '@/context/AuthContext';
import { VolunteerDuty, VolunteerAssignment } from '@/types';
import {
  HeartHandshake,
  CalendarCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Search,
  Filter,
  User,
  ShieldAlert,
  ArrowRight,
  MapPin,
  Trophy,
} from 'lucide-react';

interface VolunteerSystemProps {
  clubId?: string;
  branchId?: string;
}

export default function VolunteerSystem({ clubId, branchId }: VolunteerSystemProps = {}) {
  const { currentUser, activeClub, activeBranch, activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'assignments' | 'registry' | 'duty-dispatch'>('assignments');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const effectiveClubId = clubId || activeClub?.id || 'Scms-CLUB-000001';
  const effectiveBranchId = branchId !== '__ALL__' ? (branchId || activeBranch?.id) : undefined;

  let volunteers = store.getVolunteers(effectiveClubId);
  if (effectiveBranchId) {
    volunteers = volunteers.filter(v => v.branchId === effectiveBranchId);
  }
  let assignments = store.volunteerAssignments.filter(a => a.clubId === effectiveClubId);
  if (effectiveBranchId) {
    assignments = assignments.filter(a => !a.branchId || a.branchId === effectiveBranchId);
  }

  // Handler for volunteer check-in
  const handleCheckIn = (assignmentId: string) => {
    store.volunteerCheckIn(assignmentId, currentUser?.fullName || 'Volunteer');
    // Force re-render
    setActiveTab(prev => (prev === 'assignments' ? 'assignments' : 'assignments'));
  };

  // Handler for volunteer check-out
  const handleCheckOut = (assignmentId: string) => {
    store.volunteerCheckOut(assignmentId, currentUser?.fullName || 'Volunteer');
    setActiveTab(prev => (prev === 'assignments' ? 'assignments' : 'assignments'));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
            <HeartHandshake size={14} />
            <span>Member-Level Operational Module</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Volunteer Management & Service Desk
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Coordinate club volunteers, track duty assignments, and log verified community service hours.
          </p>
        </div>

        {/* Safeguard Notice Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start space-x-2.5 max-w-sm text-xs text-amber-900">
          <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-snug text-[11px]">
            <strong>Role Boundary:</strong> Volunteers do not receive administrative privileges or automatic KarateTech official credentials.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'assignments'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <CalendarCheck2 size={15} />
          <span>My Duty Assignments & Check-In</span>
        </button>

        <button
          onClick={() => setActiveTab('registry')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'registry'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <User size={15} />
          <span>Volunteer Registry ({volunteers.length})</span>
        </button>
      </div>

      {/* 1. ASSIGNMENTS & LIVE CHECK-IN VIEW (Mobile First) */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignments.map(a => {
              const isCheckedIn = a.status === 'Checked In';
              const isCompleted = a.status === 'Completed';

              return (
                <div
                  key={a.id}
                  className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 ${
                    isCheckedIn ? 'border-sky-400 bg-sky-50/20 ring-2 ring-sky-200' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {a.dutyType}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700'
                            : isCheckedIn
                            ? 'bg-sky-100 text-[#0284C7] animate-pulse'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-base text-slate-900 leading-snug">
                        {a.eventName || 'Club Operational Support'}
                      </h4>
                      <span className="text-xs font-medium text-slate-500 block mt-0.5">
                        Assigned to: <strong className="text-slate-800">{a.volunteerName}</strong>
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <div className="flex items-center space-x-1.5">
                        <Clock size={13} className="text-slate-400 shrink-0" />
                        <span>Scheduled: {new Date(a.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(a.scheduledEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        <span>Supervisor: {a.supervisorName || 'Club Admin'}</span>
                      </div>
                      {a.instructions && (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg mt-1">
                          "{a.instructions}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mobile Touch Action Buttons (Section 38) */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    {!isCheckedIn && !isCompleted && (
                      <button
                        onClick={() => handleCheckIn(a.id)}
                        className="flex-1 py-2.5 px-4 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs touch-target flex items-center justify-center space-x-1.5"
                      >
                        <CheckCircle2 size={16} />
                        <span>CHECK IN</span>
                      </button>
                    )}

                    {isCheckedIn && (
                      <button
                        onClick={() => handleCheckOut(a.id)}
                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs touch-target flex items-center justify-center space-x-1.5"
                      >
                        <CheckCircle2 size={16} />
                        <span>CHECK OUT (LOG HOURS)</span>
                      </button>
                    )}

                    {isCompleted && (
                      <div className="w-full text-center py-2 bg-emerald-50 rounded-xl text-emerald-800 text-xs font-bold">
                        ✓ Completed ({a.actualHours || 4} hours logged)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. VOLUNTEER REGISTRY TAB */}
      {activeTab === 'registry' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-extrabold text-base text-slate-900">Enrolled Club Volunteers</h3>
            <span className="text-xs text-slate-500">Total active volunteers: {volunteers.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Volunteer ID</th>
                  <th className="py-3 px-3">Member Name</th>
                  <th className="py-3 px-3">Skills & Certifications</th>
                  <th className="py-3 px-3">Preferred Duties</th>
                  <th className="py-3 px-3">Total Hours</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {volunteers.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-mono font-bold text-[#0284C7]">{v.id}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {v.member?.fullName || 'Volunteer Member'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {v.skills.map((s, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {v.preferredDuties.map((d, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium">
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-black text-slate-900 text-sm">
                      {v.totalHours} hrs
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
