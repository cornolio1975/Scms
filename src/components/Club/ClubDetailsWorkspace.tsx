'use client';

/**
 * Scms Club Details Workspace (6 Tabs)
 * Production-ready Superadmin & Club Admin multi-tab control center.
 * Tabs: Profile | Branches/Dojos | Administration | Approvals & Status | KarateTech Integration | Audit History
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getClubDetailsAction,
  updateClubStatusAction,
  updateClubInternalNotesAction,
  assignClubAdminAction,
  assignBranchManagerAction
} from '@/app/actions/multi-club';
import { updateClubProfileAction } from '@/app/actions/club-profile';
import { createBranchAndAssignManager } from '@/app/actions/branches';
import { validateDisplayName } from '@/lib/validation/club';
import { testKarateTechConnection } from '@/app/actions/karatetech';
import {
  Building2,
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  Users,
  Trophy,
  History,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Edit2,
  ArrowLeft,
  UserCheck,
  MapPin,
  Clock,
  ExternalLink,
  Info,
  Search
} from 'lucide-react';

interface ClubDetailsWorkspaceProps {
  clubId: string;
  onBack?: () => void;
  initialTab?: 'profile' | 'branches' | 'admin' | 'approvals' | 'karatetech' | 'audit';
}

export default function ClubDetailsWorkspace({
  clubId,
  onBack,
  initialTab = 'profile'
}: ClubDetailsWorkspaceProps) {
  const { activeRole, currentUser } = useAuth();
  const isSuperAdmin = ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole);
  const [activeTab, setActiveTab] = useState(initialTab);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Profile inputs
  const [clubName, setClubName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Modals
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isAssignAdminOpen, setIsAssignAdminOpen] = useState(false);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [assigningAdmin, setAssigningAdmin] = useState(false);

  const [assignBranchModal, setAssignBranchModal] = useState<{ isOpen: boolean; branch: any | null }>({
    isOpen: false,
    branch: null
  });
  const [branchManagerSearchTerm, setBranchManagerSearchTerm] = useState('');
  const [assigningBranchManager, setAssigningBranchManager] = useState(false);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // KarateTech connection
  const [ktHealthy, setKtHealthy] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadDetails = async (preserveFeedback: boolean = false) => {
    setLoading(true);
    if (!preserveFeedback) setFeedback(null);
    try {
      const res = await getClubDetailsAction(clubId);
      if (res.success && res.club) {
        // If members list is empty and this is a mock club, load members from client store
        if (clubId.startsWith('Scms-') && (!res.members || res.members.length === 0)) {
          const { store } = await import('@/lib/store');
          const mockM = store.getMembers(clubId);
          res.members = mockM.map((m: any) => ({
            id: m.id,
            fullName: m.fullName,
            email: m.email,
            phone: m.phone,
            status: m.status,
            roles: m.roles || (m.isAthlete ? ['ATHLETE'] : ['MEMBER']),
            branchId: m.branchId
          }));
        }
        setData(res);
        setClubName(res.club.name || '');
        const rawDisp = res.club.displayName || res.club.display_name || res.club.shortName || '';
        const initialDisp = (rawDisp && rawDisp.length <= 30)
          ? rawDisp
          : (res.club.shortName && res.club.shortName.length <= 30
              ? res.club.shortName
              : (res.club.name.length <= 30 ? res.club.name : res.club.name.substring(0, 30).trim()));
        setDisplayName(initialDisp);
        setInternalNotes(res.club.internalNotes || res.club.internal_notes || '');
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to load club' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Error loading club details' });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignClubAdmin = async (member: any) => {
    if (!confirm(`Are you sure you want to assign ${member.fullName} (${member.email || member.id}) as the Primary Club Administrator?`)) return;
    setAssigningAdmin(true);
    try {
      if (clubId.startsWith('Scms-')) {
        const { store } = await import('@/lib/store');
        store.assignClubAdmin(clubId, member.id, currentUser?.fullName || 'SuperAdmin');
      }
      const res = await assignClubAdminAction({
        clubId,
        targetUserId: member.id,
        adminName: member.fullName,
        adminEmail: member.email
      });
      if (res.error) {
        setFeedback({ type: 'error', message: res.error });
      } else {
        setFeedback({
          type: 'success',
          message: `Successfully promoted ${member.fullName} to Primary Club Administrator!`
        });
        setIsAssignAdminOpen(false);
        setAdminSearchTerm('');
        loadDetails();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to assign admin' });
    } finally {
      setAssigningAdmin(false);
    }
  };

  const handleAssignBranchManager = async (member: any) => {
    if (!assignBranchModal.branch) return;
    const branch = assignBranchModal.branch;
    if (!confirm(`Assign ${member.fullName} as Branch Manager for "${branch.name}"?`)) return;
    setAssigningBranchManager(true);
    try {
      if (clubId.startsWith('Scms-')) {
        const { store } = await import('@/lib/store');
        store.assignBranchManager(clubId, branch.id, member.id, currentUser?.fullName || 'SuperAdmin');
      }
      const res = await assignBranchManagerAction({
        clubId,
        branchId: branch.id,
        targetUserId: member.id,
        managerName: member.fullName,
        managerEmail: member.email
      });
      if (res.error) {
        setFeedback({ type: 'error', message: res.error });
      } else {
        setFeedback({
          type: 'success',
          message: `Successfully assigned ${member.fullName} as Manager for ${branch.name}!`
        });
        setAssignBranchModal({ isOpen: false, branch: null });
        setBranchManagerSearchTerm('');
        loadDetails();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to assign branch manager' });
    } finally {
      setAssigningBranchManager(false);
    }
  };

  useEffect(() => {
    loadDetails();
    // Check KarateTech Health
    testKarateTechConnection()
      .then(res => setKtHealthy(Boolean(res.success && res.isHealthy)))
      .catch(() => setKtHealthy(false));
  }, [clubId]);

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = validateDisplayName(displayName);
    if (!val.valid) {
      setFeedback({ type: 'error', message: val.error || 'Invalid Display Name' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const fd = new FormData(e.currentTarget);
    fd.set('clubId', clubId);
    fd.set('name', clubName);
    fd.set('displayName', displayName);

    if (clubId.startsWith('Scms-')) {
      try {
        const { store } = await import('@/lib/store');
        store.updateClub(
          clubId,
          {
            name: clubName,
            displayName,
            registrationNo: (fd.get('registrationNo') as string)?.trim() || undefined,
            establishedYear: fd.get('establishedYear') ? parseInt(fd.get('establishedYear') as string, 10) : undefined,
            address: (fd.get('address') as string)?.trim() || '',
            district: (fd.get('district') as string)?.trim() || '',
            city: (fd.get('city') as string)?.trim() || '',
            state: (fd.get('state') as string)?.trim() || '',
            postcode: (fd.get('postcode') as string)?.trim() || '',
            email: (fd.get('email') as string)?.trim() || '',
            phone: (fd.get('phone') as string)?.trim() || '',
            internalNotes
          },
          currentUser?.fullName || 'SuperAdmin'
        );
      } catch (err) {
        console.error('Client store update error:', err);
      }
    }

    const res = await updateClubProfileAction(fd);

    // Save internal notes if superadmin
    if (isSuperAdmin) {
      await updateClubInternalNotesAction(clubId, internalNotes);
    }

    setSaving(false);
    if (res.error) {
      setFeedback({ type: 'error', message: res.error });
    } else {
      setFeedback({
        type: 'success',
        message: 'Club Profile & Display Name successfully updated! KarateTech 3.0 will receive this Display Name.'
      });
      loadDetails(true);
    }
  };

  const handleStatusChange = async (
    newStatus: 'Active' | 'Suspended' | 'Pending Approval' | 'Rejected',
    newApproval?: 'APPROVED' | 'PENDING' | 'REJECTED',
    reason?: string
  ) => {
    if (!reason && !confirm(`Are you sure you want to change this club's status to "${newStatus}"?`)) return;
    setSaving(true);
    const res = await updateClubStatusAction({
      clubId,
      status: newStatus,
      approvalStatus: newApproval,
      reason
    });
    setSaving(false);
    if (res.success) {
      if (data && data.club) {
        setData({
          ...data,
          club: {
            ...data.club,
            status: newStatus,
            approval_status: res.approvalStatus || newApproval || (newStatus === 'Active' ? 'APPROVED' : 'PENDING')
          }
        });
      }
      setFeedback({ type: 'success', message: `Club status successfully updated to ${newStatus}.` });
      setIsRejectModalOpen(false);
      setRejectReason('');
      loadDetails(true);
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to update status' });
    }
  };

  const handleCreateBranch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.set('clubId', clubId);

    const res = await createBranchAndAssignManager(fd);
    setSaving(false);
    if (res.error) {
      alert(res.error);
    } else {
      alert('Branch successfully added!');
      setIsAddBranchOpen(false);
      loadDetails();
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 animate-pulse font-medium">
        Loading club workspace...
      </div>
    );
  }

  if (!data?.club) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-red-700">
        <p className="font-bold">Club not found.</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 text-xs font-bold text-[#0284C7] underline">
            ← Return to All Clubs
          </button>
        )}
      </div>
    );
  }

  const { club, branches, officials, approvals, karateTech, auditLogs } = data;
  const allClubMembers: any[] = data.members || [];

  const filteredAdminMembers = allClubMembers.filter((m: any) => {
    if (!adminSearchTerm.trim()) return true;
    const q = adminSearchTerm.toLowerCase();
    return (
      m.fullName?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.phone?.toLowerCase().includes(q) ||
      m.id?.toLowerCase().includes(q) ||
      (Array.isArray(m.roles) && m.roles.some((r: string) => r.toLowerCase().includes(q)))
    );
  });

  const filteredBranchMembers = allClubMembers.filter((m: any) => {
    if (!branchManagerSearchTerm.trim()) return true;
    const q = branchManagerSearchTerm.toLowerCase();
    return (
      m.fullName?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.phone?.toLowerCase().includes(q) ||
      m.id?.toLowerCase().includes(q) ||
      (Array.isArray(m.roles) && m.roles.some((r: string) => r.toLowerCase().includes(q)))
    );
  });

  const isApproved = club.approval_status === 'APPROVED';
  const isActive = club.status === 'Active' || club.status === 'ACTIVE';

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* 1. TOP HEADER & BACK NAVIGATION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Return to All Clubs"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{club.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {club.status}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isApproved ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {club.approval_status || 'PENDING'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              KT Display Name:{' '}
              <strong className="text-sky-700">{club.display_name || club.name}</strong> • State:{' '}
              {club.state || 'N/A'} • Reg No: {club.registration_no || 'N/A'}
            </p>
          </div>
        </div>

        {/* Superadmin Quick Actions */}
        {isSuperAdmin && (
          <div className="flex items-center space-x-2">
            {!isApproved && (
              <button
                onClick={() => handleStatusChange('Active', 'APPROVED')}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Approve Club</span>
              </button>
            )}
            {isActive ? (
              <button
                onClick={() => handleStatusChange('Suspended')}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <ShieldAlert size={14} />
                <span>Suspend Club</span>
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange('Active')}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <ShieldCheck size={14} />
                <span>Reactivate</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* 2. 6-TAB NAVIGATION BAR */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 no-scrollbar">
        {[
          { id: 'profile', label: 'Tab A: Profile', icon: Building2 },
          { id: 'branches', label: `Tab B: Branches (${branches.length})`, icon: GitBranch },
          { id: 'admin', label: `Tab C: Administration (${officials.length})`, icon: Users },
          { id: 'approvals', label: `Tab D: Approvals & Status`, icon: ShieldCheck },
          { id: 'karatetech', label: 'Tab E: KarateTech Integration', icon: Trophy },
          { id: 'audit', label: `Tab F: Audit History (${auditLogs.length})`, icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                isSelected
                  ? 'border-[#0284C7] text-[#0284C7]'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. TAB CONTENT WORKSPACE */}

      {/* TAB A: PROFILE */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
              <Building2 size={18} className="text-[#0284C7]" />
              <span>Official Organization Identity</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Official Legal Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={clubName}
                  onChange={e => setClubName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  placeholder="e.g. Senshi Goju-Ryu Karate-Do Academy"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    KarateTech 3.0 Display Name *
                  </label>
                  <span
                    className={`text-[11px] font-bold ${
                      displayName.trim().length > 30 ? 'text-red-500' : 'text-slate-400'
                    }`}
                  >
                    {displayName.trim().length} / 30 chars
                  </span>
                </div>
                <input
                  type="text"
                  name="displayName"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  maxLength={30}
                  required
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 ${
                    displayName.trim().length > 30
                      ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                      : 'border-slate-200 focus:ring-[#0284C7]'
                  }`}
                  placeholder="e.g. Senshi Goju-Ryu"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Transmitted verbatim to KarateTech 3.0 tournament software.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Registration Number
                </label>
                <input
                  type="text"
                  name="registrationNo"
                  defaultValue={club.registration_no || club.registrationNo || ''}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  placeholder="e.g. PPM-012-10-1234567"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Established Year
                </label>
                <input
                  type="number"
                  name="establishedYear"
                  defaultValue={club.established_year || club.establishedYear || ''}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  placeholder="e.g. 2012"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  defaultValue={club.address || ''}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  placeholder="No. 123, Jalan Dojo 1/1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  District
                </label>
                <input
                  type="text"
                  name="district"
                  defaultValue={club.district || ''}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  placeholder="e.g. Petaling"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  defaultValue={club.city || ''}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  placeholder="e.g. Puchong"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  defaultValue={club.state || ''}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  placeholder="e.g. Selangor"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Postcode
                </label>
                <input
                  type="text"
                  name="postcode"
                  defaultValue={club.postcode || ''}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  placeholder="e.g. 47100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Official Email
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={club.email || ''}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  placeholder="admin@senshikarate.org"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Official Phone
                </label>
                <input
                  type="text"
                  name="phone"
                  defaultValue={club.phone || ''}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  placeholder="+6012-3456789"
                />
              </div>

              {/* Superadmin Internal Notes */}
              {isSuperAdmin && (
                <div className="md:col-span-2 p-5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
                    <ShieldAlert size={14} />
                    <span>Superadmin Internal Operational Notes (Private)</span>
                  </div>
                  <textarea
                    value={internalNotes}
                    onChange={e => setInternalNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Private platform administrator notes regarding verification, KYC compliance, special permits, or sanctions..."
                  />
                </div>
              )}
            </div>

            {feedback && (
              <div
                className={`p-3.5 rounded-2xl text-xs flex items-center justify-between border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span className="font-semibold">{feedback.message}</span>
                </div>
                <button type="button" onClick={() => setFeedback(null)} className="font-bold hover:underline">
                  ✕
                </button>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-2"
              >
                <Save size={16} />
                <span>{saving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB B: BRANCHES / DOJOS */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Branch & Dojo Locations</h2>
            <button
              onClick={() => setIsAddBranchOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Plus size={14} />
              <span>Add Branch / Dojo</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            {branches.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No branches registered for this club yet. Click "Add Branch / Dojo" above.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Branch Name</th>
                    <th className="py-3 px-4">Venue</th>
                    <th className="py-3 px-4">District / City</th>
                    <th className="py-3 px-4">Manager</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {branches.map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {b.name}
                        {b.display_name && (
                          <span className="block text-[11px] text-slate-400 font-normal">
                            Display: {b.display_name}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{b.venue_name || b.venueName || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {[b.district, b.city, b.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {b.manager_name || b.managerName || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            b.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignBranchModal({ isOpen: true, branch: b });
                            setBranchManagerSearchTerm('');
                          }}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-[#0284C7] hover:bg-sky-100 font-bold text-xs transition-colors cursor-pointer"
                        >
                          <UserCheck size={13} />
                          <span>{b.manager_name || b.managerName ? 'Change Manager' : 'Assign Manager'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB C: ADMINISTRATION */}
      {activeTab === 'admin' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Primary Club Administrator</h2>
                <p className="text-xs text-slate-500">
                  Authorized manager with operational and registration rights over this club.
                </p>
              </div>
              {isSuperAdmin && (
                <button
                  onClick={() => setIsAssignAdminOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  <UserCheck size={14} />
                  <span>Assign / Change Admin</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Admin Name
                </span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">
                  {club.primary_admin_name || club.primaryAdminName || 'Not Assigned'}
                </span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Email
                </span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">
                  {club.primary_admin_email || club.primaryAdminEmail || club.email || '—'}
                </span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Phone
                </span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">
                  {club.primary_admin_phone || club.primaryAdminPhone || club.phone || '—'}
                </span>
              </div>
            </div>

            {/* Registered Officials & Branch Managers */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Registered Roles & Officials ({officials.length})</h3>
              {officials.length === 0 ? (
                <p className="text-xs text-slate-400">No additional officials assigned.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                  {officials.map((o: any) => (
                    <div key={o.id} className="p-3.5 flex items-center justify-between text-xs bg-white">
                      <div>
                        <span className="font-bold text-slate-900">{o.profiles?.full_name || 'System User'}</span>
                        <span className="text-slate-400 block text-[11px]">{o.profiles?.email}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                        {o.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB D: APPROVALS & STATUS */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Governance & Approval Status</h2>
                <p className="text-xs text-slate-500">
                  Platform compliance, approval requests, and operational status controls.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Approval Status
                </span>
                <span className="text-lg font-black text-slate-900 mt-1 block">
                  {club.approval_status || 'PENDING'}
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Operational Status
                </span>
                <span className="text-lg font-black text-slate-900 mt-1 block">{club.status}</span>
              </div>
            </div>

            {/* Approval Action Controls */}
            {isSuperAdmin && (
              <div className="p-5 bg-sky-50/50 border border-sky-100 rounded-2xl space-y-3">
                <h3 className="text-xs font-bold text-sky-900 uppercase tracking-wider">Superadmin Governance Actions</h3>
                <div className="flex flex-wrap gap-2.5">
                  {(!isApproved || club.status !== 'Active') && (
                    <button
                      onClick={() => handleStatusChange('Active', 'APPROVED')}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <CheckCircle2 size={15} />
                      <span>Approve & Activate Club</span>
                    </button>
                  )}
                  {club.status === 'Active' && (
                    <button
                      onClick={() => handleStatusChange('Suspended')}
                      className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <ShieldAlert size={15} />
                      <span>Suspend Operational Access</span>
                    </button>
                  )}
                  {club.status === 'Suspended' && (
                    <button
                      onClick={() => handleStatusChange('Active', 'APPROVED')}
                      className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <ShieldCheck size={15} />
                      <span>Reactivate Operational Access</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsRejectModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <AlertCircle size={15} />
                    <span>Reject with Reason</span>
                  </button>
                </div>
              </div>
            )}

            {/* Approval History */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Approval Request History ({approvals.length})
              </h3>
              {approvals.length === 0 ? (
                <p className="text-xs text-slate-400">No formal approval requests on record.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                  {approvals.map((a: any) => (
                    <div key={a.id} className="p-3.5 flex items-center justify-between bg-white">
                      <div>
                        <span className="font-bold text-slate-900">{a.request_type || 'Club Registration'}</span>
                        <span className="text-slate-400 block text-[11px]">
                          Submitted: {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-700">
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB E: KARATETECH INTEGRATION */}
      {activeTab === 'karatetech' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">KarateTech 3.0 Platform Bridge</h2>
                <p className="text-xs text-slate-500">
                  Real-time participant data sync, club display name transmission, and conflict resolution.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    ktHealthy ? 'bg-emerald-500' : ktHealthy === false ? 'bg-red-500' : 'bg-slate-300'
                  }`}
                />
                <span className="text-xs font-bold text-slate-600">
                  {ktHealthy ? 'Bridge Connected' : ktHealthy === false ? 'API Offline' : 'Checking...'}
                </span>
              </div>
            </div>

            {/* Sync Metric Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Club Display Name
                </span>
                <span className="text-sm font-black text-sky-700 mt-1 block truncate">
                  {club.display_name || club.name}
                </span>
              </div>
              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Synced Athletes
                </span>
                <span className="text-2xl font-black text-emerald-800 mt-1 block">
                  {karateTech.totalSynced}
                </span>
              </div>
              <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Conflicts
                </span>
                <span className="text-2xl font-black text-amber-800 mt-1 block">
                  {karateTech.totalConflicts}
                </span>
              </div>
              <div className="p-4 bg-red-50/60 border border-red-100 rounded-2xl">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">
                  Errors
                </span>
                <span className="text-2xl font-black text-red-800 mt-1 block">
                  {karateTech.totalFailed}
                </span>
              </div>
            </div>

            {/* Recent Sync History */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recent Synchronization Events
              </h3>
              {karateTech.history.length === 0 ? (
                <p className="text-xs text-slate-400">No synchronization events recorded for this club.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                  {karateTech.history.map((h: any) => (
                    <div key={h.id} className="p-3 flex items-center justify-between bg-white">
                      <div>
                        <span className="font-bold text-slate-900">{h.operation}</span>
                        <span className="text-slate-400 block text-[11px]">
                          {new Date(h.created_at).toLocaleString()} • Req: {h.request_id || 'Direct'}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          h.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB F: AUDIT HISTORY */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">Immutable Audit Trail</h2>
            <p className="text-xs text-slate-500">
              Chronological log of administrative actions, profile revisions, and status modifications.
            </p>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No audit logs recorded for this club.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-xs">{log.action}</span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.changes && (
                      <pre className="text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-600 overflow-x-auto mt-2">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD BRANCH */}
      {isAddBranchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Add New Branch / Dojo</h3>
              <button onClick={() => setIsAddBranchOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Branch Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Dojo USJ Subang"
                  className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Venue / Facility</label>
                <input
                  type="text"
                  name="venueName"
                  placeholder="e.g. Kompleks Sukan USJ 7"
                  className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">District</label>
                  <input
                    type="text"
                    name="district"
                    placeholder="e.g. Petaling"
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    placeholder="e.g. Subang Jaya"
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddBranchOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white font-bold text-xs"
                >
                  {saving ? 'Creating...' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT REASON */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-base text-slate-900">Reject Club Registration</h3>
            <p className="text-xs text-slate-500">
              Provide a clear, mandatory reason for rejection that will be recorded in the audit log.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              required
              className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="e.g. Incomplete registration documents or unverified sports affiliation."
            />
            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('Rejected', 'REJECTED', rejectReason)}
                disabled={!rejectReason.trim() || saving}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN PRIMARY CLUB ADMIN FROM CLUB MEMBERS */}
      {isAssignAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2 text-[#0284C7] text-xs font-bold uppercase tracking-wider">
                  <UserCheck size={14} />
                  <span>Club Administration Role Assignment</span>
                </div>
                <h3 className="font-black text-xl text-slate-900 tracking-tight mt-0.5">
                  Assign Primary Club Administrator
                </h3>
                <p className="text-xs text-slate-500">
                  Select an existing member from <strong>{club.display_name || club.name}</strong> ({allClubMembers.length} registered members) to grant full operational and management privileges.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAssignAdminOpen(false);
                  setAdminSearchTerm('');
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={adminSearchTerm}
                onChange={e => setAdminSearchTerm(e.target.value)}
                placeholder="Search club members by name, email, phone, or role..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-[#0284C7] focus:outline-none"
              />
            </div>

            {/* Member List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
              {filteredAdminMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {allClubMembers.length === 0
                    ? 'No members registered under this club yet.'
                    : `No matching club members found for "${adminSearchTerm}".`}
                </div>
              ) : (
                filteredAdminMembers.map((m: any) => {
                  const isCurrentAdmin =
                    (club.primary_admin_id === m.id) ||
                    (club.primary_admin_email === m.email) ||
                    (club.primaryAdminEmail === m.email);

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors gap-3"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#0284C7] flex items-center justify-center font-black text-xs shrink-0">
                          {m.fullName?.charAt(0) || 'M'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs truncate">{m.fullName}</span>
                            {isCurrentAdmin && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase shrink-0">
                                Current Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center space-x-2 truncate">
                            <span>{m.email || 'No email'}</span>
                            {m.phone && <span>• {m.phone}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(m.roles || ['MEMBER']).map((r: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={assigningAdmin || isCurrentAdmin}
                        onClick={() => handleAssignClubAdmin(m)}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all ${
                          isCurrentAdmin
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-xs cursor-pointer'
                        }`}
                      >
                        {isCurrentAdmin ? 'Assigned' : 'Assign as Admin'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsAssignAdminOpen(false);
                  setAdminSearchTerm('');
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN BRANCH MANAGER FROM CLUB MEMBERS */}
      {assignBranchModal.isOpen && assignBranchModal.branch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2 text-[#0284C7] text-xs font-bold uppercase tracking-wider">
                  <GitBranch size={14} />
                  <span>Branch Manager Assignment</span>
                </div>
                <h3 className="font-black text-xl text-slate-900 tracking-tight mt-0.5">
                  Assign Manager: {assignBranchModal.branch.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Assign an active member from <strong>{club.display_name || club.name}</strong> ({allClubMembers.length} available members) to manage this branch location.
                </p>
              </div>
              <button
                onClick={() => {
                  setAssignBranchModal({ isOpen: false, branch: null });
                  setBranchManagerSearchTerm('');
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={branchManagerSearchTerm}
                onChange={e => setBranchManagerSearchTerm(e.target.value)}
                placeholder="Search club members by name, email, phone, or role..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-[#0284C7] focus:outline-none"
              />
            </div>

            {/* Member List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
              {filteredBranchMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {allClubMembers.length === 0
                    ? 'No members registered under this club yet.'
                    : `No matching club members found for "${branchManagerSearchTerm}".`}
                </div>
              ) : (
                filteredBranchMembers.map((m: any) => {
                  const isCurrentBranchMgr =
                    assignBranchModal.branch.manager_id === m.id ||
                    assignBranchModal.branch.managerId === m.id ||
                    assignBranchModal.branch.manager_name === m.fullName ||
                    assignBranchModal.branch.managerName === m.fullName;

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors gap-3"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                          {m.fullName?.charAt(0) || 'M'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs truncate">{m.fullName}</span>
                            {isCurrentBranchMgr && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase shrink-0">
                                Current Manager
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center space-x-2 truncate">
                            <span>{m.email || 'No email'}</span>
                            {m.phone && <span>• {m.phone}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(m.roles || ['MEMBER']).map((r: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={assigningBranchManager || isCurrentBranchMgr}
                        onClick={() => handleAssignBranchManager(m)}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all ${
                          isCurrentBranchMgr
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer'
                        }`}
                      >
                        {isCurrentBranchMgr ? 'Assigned' : 'Assign to Branch'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setAssignBranchModal({ isOpen: false, branch: null });
                  setBranchManagerSearchTerm('');
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REJECT CLUB WITH REASON */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2 text-red-600 text-xs font-bold uppercase tracking-wider">
                  <ShieldAlert size={14} />
                  <span>Club Governance Review</span>
                </div>
                <h3 className="font-black text-xl text-slate-900 tracking-tight mt-0.5">
                  Reject Club Registration
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectReason('');
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Please state the specific compliance or regulatory reason for rejecting <strong>{club.display_name || club.name}</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Rejection Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Incomplete registrar certificate, invalid sports commissioner affiliation, or missing coach credentials..."
                rows={4}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !rejectReason.trim()}
                onClick={() => handleStatusChange('Rejected', 'REJECTED', rejectReason)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {saving ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
