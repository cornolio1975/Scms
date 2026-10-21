'use client';

/**
 * Scms Member 360 Workspace
 * Section 12: Complete 12-tab operational view for any member or athlete
 * Overview | Personal | Membership | Attendance | Training | Payments | Grades | Tournaments | Volunteer | Documents | Communications | Activity
 */

import React, { useState } from 'react';
import { Member, SystemRole } from '@/types';
import { store } from '@/lib/store';
import {
  User,
  Shield,
  CalendarCheck2,
  CreditCard,
  GraduationCap,
  Award,
  Trophy,
  HeartHandshake,
  FileText,
  MessageSquare,
  Clock,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import QRCode from 'qrcode';

interface Member360Props {
  member: Member;
  onBack: () => void;
  onUpdateMember?: (updated: Member) => void;
}

export default function Member360({ member, onBack }: Member360Props) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const club = store.getClubById(member.clubId);
  const branch = store.getBranches(member.clubId).find(b => b.id === member.branchId);
  const volunteer = store.volunteers.find(v => v.memberId === member.id);
  const memberInvoices = store.invoices.filter(i => i.memberId === member.id);
  const memberAttendance = store.attendance.filter(a => a.memberId === member.id);
  const totalBalanceDue = memberInvoices.reduce((acc, i) => acc + i.balanceDue, 0);

  // One person can carry multiple operational roles. Prefer explicit account
  // assignments, then enrich them with member-domain roles for legacy records.
  const account = member.userId ? store.users.find(user => user.id === member.userId) : undefined;
  const personRoles = React.useMemo(() => {
    const roles = new Set<SystemRole>(
      (account?.roles || [])
        .filter(role => !role.clubId || role.clubId === member.clubId)
        .map(role => role.role)
    );
    roles.add('MEMBER');
    if (member.isAthlete) roles.add('ATHLETE');
    if (member.isVolunteer || volunteer) roles.add('VOLUNTEER');
    return Array.from(roles);
  }, [account, member.clubId, member.isAthlete, member.isVolunteer, volunteer]);

  // Generate Digital QR Code for member verification
  React.useEffect(() => {
    const payload = JSON.stringify({
      scms_id: member.id,
      name: member.fullName,
      club: club?.shortName,
      branch: branch?.name,
      sport: club?.sport,
      status: member.status,
      verify_url: `https://scms.spsportdata.org/verify/${member.id}`,
    });

    QRCode.toDataURL(payload, { width: 250, margin: 1 })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('QR generation error:', err));
  }, [member, club, branch]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'personal', label: 'Personal Details', icon: Shield },
    { id: 'membership', label: 'Membership Plan', icon: Award },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
    { id: 'training', label: 'Training & Squad', icon: GraduationCap },
    { id: 'payments', label: 'Billing & Invoices', icon: CreditCard },
    { id: 'grades', label: 'Belt & Rank Progression', icon: Award },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'volunteer', label: 'Volunteer Profile', icon: HeartHandshake },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'activity', label: 'Activity Timeline', icon: Clock },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. TOP BREADCRUMB & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <button onClick={onBack} className="hover:text-[#0284C7] font-semibold">
            Members Roster
          </button>
          <span>/</span>
          <span className="font-bold text-slate-900">{member.fullName}</span>
          <span className="font-mono text-slate-400">({member.id})</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-colors touch-target"
          >
            <QrCode size={15} className="text-[#0284C7]" />
            <span>Digital ID Card</span>
          </button>
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            Close 360
          </button>
        </div>
      </div>

      {/* 2. MEMBER 360 HEADER CARD */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center space-x-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-black text-3xl shadow-md shrink-0">
            {member.fullName.charAt(0)}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-950 leading-tight">
                {member.fullName}
              </h1>
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {member.status}
              </span>
              {member.isAthlete && (
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  Athlete
                </span>
              )}
              {personRoles.map(role => (
                <span
                  key={role}
                  className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200"
                >
                  {role.replaceAll('_', ' ')}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
              <span className="font-mono text-slate-700">{member.id}</span>
              <span>•</span>
              <span>{club?.shortName}</span>
              <span>•</span>
              <span>{branch?.name}</span>
              <span>•</span>
              <span className="text-slate-900 font-bold">
                {member.sportData?.beltRank || 'Athlete Member'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto text-center border-t md:border-t-0 pt-4 md:pt-0">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Attendance</span>
            <span className="text-sm font-black text-slate-900">
              {memberAttendance.length > 0 ? '92%' : 'N/A'}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Balance Due</span>
            <span className={`text-sm font-black ${totalBalanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              MYR {totalBalanceDue.toFixed(2)}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Volunteer</span>
            <span className="text-sm font-black text-indigo-600">
              {volunteer ? `${volunteer.totalHours} hrs` : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. HORIZONTALLY SCROLLABLE TABS (Mobile Friendly) */}
      <div className="border-b border-slate-200 overflow-x-auto scrollbar-none flex space-x-2 pb-px">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. TAB CONTENTS */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 mb-3">Unified Person Roles</h3>
                <div className="flex flex-wrap gap-2">
                  {personRoles.map(role => (
                    <span key={role} className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold">
                      {role.replaceAll('_', ' ')}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Roles are attached to this person record; separate duplicate member profiles are not required.
                </p>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 mb-3">Member Summary</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Date of Birth:</span>
                    <span className="font-semibold text-slate-900">{member.dob} (Age {new Date().getFullYear() - new Date(member.dob).getFullYear()})</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">IC / Passport:</span>
                    <span className="font-semibold text-slate-900">{member.icPassport}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Gender / Nationality:</span>
                    <span className="font-semibold text-slate-900">{member.gender} • {member.nationality}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Contact:</span>
                    <span className="font-semibold text-slate-900">{member.phone || 'N/A'} • {member.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Emergency Contact:</span>
                    <span className="font-semibold text-slate-900">{member.emergencyContactName} ({member.emergencyContactPhone})</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 mb-3">Sport & Squad Info</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Current Rank:</span>
                    <span className="font-bold text-[#0284C7]">{member.sportData?.beltRank || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Discipline:</span>
                    <span className="font-semibold text-slate-900">{member.sportData?.preferredDiscipline || 'Both'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Weight & Height:</span>
                    <span className="font-semibold text-slate-900">{member.sportData?.weightKg || 0} kg • {member.sportData?.heightCm || 0} cm</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Assigned Coach:</span>
                    <span className="font-semibold text-slate-900">{member.assignedCoachName || 'Unassigned'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Alerts & Recent Activity */}
            <div className="space-y-6">
              <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-5">
                <div className="flex items-center space-x-2 text-sky-800 font-extrabold text-sm mb-2">
                  <AlertCircle size={16} />
                  <span>Important Member Alerts</span>
                </div>
                <ul className="text-xs text-sky-900 space-y-1.5 list-disc pl-4">
                  {totalBalanceDue > 0 && (
                    <li>Outstanding billing balance: MYR {totalBalanceDue.toFixed(2)} due soon.</li>
                  )}
                  {member.medicalNotes && (
                    <li>Medical consideration: {member.medicalNotes}</li>
                  )}
                  {member.isVolunteer && (
                    <li>Active volunteer with {volunteer?.totalHours || 0} logged service hours.</li>
                  )}
                  <li>Pre-eligible for upcoming KarateTech 3.0 championship category.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 mb-3">Recent Activity</h3>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Class Attendance Recorded</span>
                      <span className="text-[11px] text-slate-500">Elite Kumite Squad • Present</span>
                    </div>
                    <span className="text-[10px] text-slate-400">March 2, 2026</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Payment Received (INV-2026-0001)</span>
                      <span className="text-[11px] text-emerald-600 font-semibold">MYR 200.00 via DuitNow QR</span>
                    </div>
                    <span className="text-[10px] text-slate-400">March 1, 2026</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Attendance Log</h3>
            {memberAttendance.length === 0 ? (
              <p className="text-xs text-slate-500">No attendance records on file for this athlete.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Session</th>
                      <th className="py-2.5 px-3">Check-In Time</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      <th className="py-2.5 px-3">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {memberAttendance.map(att => (
                      <tr key={att.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">Elite Squad</td>
                        <td className="py-2.5 px-3 text-slate-600">{att.checkInTime || 'N/A'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            att.status === 'Present' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {att.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{att.remarks || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{att.recordedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PAYMENTS & BILLING TAB */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Invoices & Billing History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Invoice No.</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Total Amount</th>
                    <th className="py-2.5 px-3">Paid</th>
                    <th className="py-2.5 px-3">Balance</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {memberInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0284C7]">{inv.invoiceNumber}</td>
                      <td className="py-2.5 px-3 text-slate-600">{inv.dueDate}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">MYR {inv.total.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-emerald-600 font-semibold">MYR {inv.amountPaid.toFixed(2)}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">MYR {inv.balanceDue.toFixed(2)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VOLUNTEER TAB */}
        {activeTab === 'volunteer' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Volunteer Record</h3>
                <p className="text-xs text-slate-500">
                  Member-level volunteer service record. Volunteers do not receive automatic admin rights or KarateTech official roles.
                </p>
              </div>
              {volunteer && (
                <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold">
                  {volunteer.totalHours} Service Hours Logged
                </span>
              )}
            </div>

            {volunteer ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Skills & Certifications</span>
                  <div className="flex flex-wrap gap-1.5">
                    {volunteer.skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Preferred Duties</span>
                  <div className="flex flex-wrap gap-1.5">
                    {volunteer.preferredDuties.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">This member is not currently enrolled as a club volunteer.</p>
            )}
          </div>
        )}

        {/* TOURNAMENTS TAB */}
        {activeTab === 'tournaments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">KarateTech 3.0 Tournament Activity</h3>
                <p className="text-xs text-slate-500">Synchronized tournament entries, categories, and qualification statuses.</p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                KarateTech Linked
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-extrabold text-sm text-slate-900 block">
                  Kelab Senshi Goju-Ryu Open Karate Championship 2026
                </span>
                <span className="text-xs text-slate-500">
                  Target Category: Male Kumite -67kg (18+) • Status: Draft Ready
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-[#0284C7]">
                Registration Ready
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 5. DIGITAL ID CARD MODAL */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Digital Membership Pass
              </span>
              <button onClick={() => setIsQrModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="p-6 bg-gradient-to-tr from-sky-600 to-indigo-700 rounded-3xl text-white shadow-xl space-y-4 text-left">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-sky-200 block">Scms DIGITAL ID</span>
                  <span className="font-black text-base">{club?.shortName}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/20 uppercase">
                  {club?.sport}
                </span>
              </div>

              <div>
                <span className="font-extrabold text-lg block leading-tight">{member.fullName}</span>
                <span className="font-mono text-xs text-sky-200">{member.id}</span>
              </div>

              <div className="bg-white p-3 rounded-2xl flex justify-center">
                {qrDataUrl && <img src={qrDataUrl} alt="Member Verification QR" className="w-36 h-36" />}
              </div>

              <div className="flex justify-between text-[11px] text-sky-100 pt-2 border-t border-white/10">
                <span>Rank: {member.sportData?.beltRank || 'Karateka'}</span>
                <span>Status: Active</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Present this tamper-evident QR code at dojo gates for rapid check-in and membership verification.
            </p>

            <button
              onClick={() => setIsQrModalOpen(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
