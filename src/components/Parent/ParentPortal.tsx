'use client';

/**
 * Scms Family & Guardian Portal
 * Sections 15 & 40: Multi-child management, parent/guardian database,
 * class attendance tracking, belt syllabus promotions, and fee payment receipts.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { store } from '@/lib/store';
import { useAuth } from '@/context/AuthContext';
import { Member, ParentContact, AthleteGuardianRelationship, Invoice } from '@/types';
import {
  UserCheck,
  Users,
  CalendarCheck2,
  CreditCard,
  Award,
  Trophy,
  CheckCircle2,
  FileText,
  Clock,
  ChevronRight,
  Shield,
  QrCode,
  Search,
  Filter,
  Plus,
  Phone,
  Mail,
  Heart,
  AlertCircle,
  X,
  Download,
  ExternalLink,
  Calendar,
  MapPin,
  Sparkles,
  Activity,
  HeartHandshake,
  Check,
  ArrowRight,
  Receipt,
  UserPlus,
  Pencil,
  Trash2,
} from 'lucide-react';

interface ParentPortalProps {
  clubId?: string;
  branchId?: string;
}

export default function ParentPortal({ clubId, branchId }: ParentPortalProps = {}) {
  const { currentUser, activeClub, activeBranch, activeRole } = useAuth();
  const effectiveClubId = clubId || activeClub?.id || 'Scms-CLUB-000001';
  const effectiveBranchId = branchId !== '__ALL__' ? (branchId || activeBranch?.id) : undefined;
  const isStaffOrAdmin = ['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER', 'COACH'].includes(activeRole);

  // Core Data State
  const [parentContacts, setParentContacts] = useState<ParentContact[]>([]);
  const [guardianRelationships, setGuardianRelationships] = useState<AthleteGuardianRelationship[]>([]);
  const [clubMembers, setClubMembers] = useState<Member[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  // UI View Modes & Tabs
  const [viewMode, setViewMode] = useState<'family-hub' | 'database-roster'>('family-hub');
  const [activeChildTab, setActiveChildTab] = useState<'overview' | 'attendance' | 'syllabus' | 'fees'>('overview');

  // Search & Filter for Database view
  const [searchQuery, setSearchQuery] = useState('');
  const [volunteerFilter, setVolunteerFilter] = useState<'All' | 'Volunteer' | 'Non-Volunteer'>('All');

  // Interactive Modals
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<Invoice | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveSubmittedMsg, setLeaveSubmittedMsg] = useState(false);
  const [isAddParentModalOpen, setIsAddParentModalOpen] = useState(false);
  const [isEditParentModalOpen, setIsEditParentModalOpen] = useState(false);
  const [editingParentContact, setEditingParentContact] = useState<ParentContact | null>(null);
  const [editingParentRels, setEditingParentRels] = useState<any[]>([]);
  const [athleteToLink, setAthleteToLink] = useState('');
  const [athleteRelationToLink, setAthleteRelationToLink] = useState('Child');

  const openEditParentModal = (parent: ParentContact) => {
    setEditingParentContact(parent);
    const rels = guardianRelationships.filter(r => r.guardianContactId === parent.id);
    const linkedList = rels.map(r => {
      const ath = clubMembers.find(m => m.id === r.athleteId);
      return {
        id: r.id,
        athleteId: r.athleteId,
        athleteName: ath ? ath.fullName : r.athleteId,
        relationship: r.relationship,
        isEmergencyContact: r.isEmergencyContact ?? true,
        isPrimaryContact: r.isPrimaryContact ?? true,
      };
    });
    setEditingParentRels(linkedList);
    setAthleteToLink('');
    setAthleteRelationToLink('Child');
    setIsEditParentModalOpen(true);
  };

  const handleSaveParent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingParentContact) return;
    const fd = new FormData(e.currentTarget);
    const fullName = fd.get('fullName') as string;
    const contactNumber = fd.get('contactNumber') as string;
    const email = fd.get('email') as string;
    const isVolunteer = fd.get('isVolunteerEligible') === 'on';

    store.updateParentContact(editingParentContact.id, {
      fullName,
      contactNumber,
      email: email || undefined,
      isVolunteerEligible: isVolunteer,
    }, currentUser?.fullName || 'SuperAdmin');

    // Sync relationships
    const existing = store.athleteGuardianRelationships.filter(r => r.guardianContactId === editingParentContact.id);
    existing.forEach(r => store.unlinkAthleteGuardian(r.athleteId, editingParentContact.id));

    editingParentRels.forEach(rel => {
      if (rel.athleteId) {
        store.linkAthleteGuardian(rel.athleteId, editingParentContact.id, {
          relationship: rel.relationship,
          isEmergencyContact: rel.isEmergencyContact,
          isPrimaryContact: rel.isPrimaryContact,
        });
        const ath = store.getMemberById(rel.athleteId);
        if (ath) {
          store.updateMember(rel.athleteId, {
            guardianId: editingParentContact.id,
            guardianName: fullName,
            emergencyContactName: rel.isEmergencyContact ? fullName : ath.emergencyContactName,
            emergencyContactPhone: rel.isEmergencyContact ? contactNumber : ath.emergencyContactPhone,
            emergencyContactRelation: rel.relationship,
          }, currentUser?.fullName || 'SuperAdmin');
        }
      }
    });

    refreshData();
    setIsEditParentModalOpen(false);
  };

  const handleDeleteParent = (parent: ParentContact) => {
    if (!confirm(`Are you sure you want to delete ${parent.fullName}? This will unlink all enrolled children.`)) {
      return;
    }
    store.deleteParentContact(parent.id, currentUser?.fullName || 'SuperAdmin');
    refreshData();
    if (selectedParentId === parent.id) {
      const remaining = parentContacts.filter(p => p.id !== parent.id);
      setSelectedParentId(remaining[0]?.id || '');
    }
  };

  // Load and refresh data from Store
  const refreshData = () => {
    const contacts = store.getParentContacts(effectiveClubId);
    const rels = store.athleteGuardianRelationships;
    const members = store.getMembers(effectiveClubId, effectiveBranchId);
    const clubInvoices = store.invoices.filter(i => i.clubId === effectiveClubId);

    setParentContacts(contacts);
    setGuardianRelationships(rels);
    setClubMembers(members);
    setInvoices(clubInvoices);

    // Initial parent selection logic:
    // If logged-in user is a parent, pick them. Otherwise pick first parent contact.
    if (!selectedParentId && contacts.length > 0) {
      const matched = contacts.find(
        c => (c.email && currentUser?.email && c.email.toLowerCase() === currentUser.email.toLowerCase()) ||
             (c.contactNumber && currentUser?.phone && c.contactNumber === currentUser.phone)
      );
      setSelectedParentId(matched ? matched.id : contacts[0].id);
    }
  };

  useEffect(() => {
    refreshData();
  }, [effectiveClubId, effectiveBranchId]);

  // Selected Parent Contact
  const activeParent = useMemo(() => {
    return parentContacts.find(p => p.id === selectedParentId) || parentContacts[0] || null;
  }, [parentContacts, selectedParentId]);

  // Find all genuine enrolled children for a given parent
  const getChildrenForParent = (parentId: string): Member[] => {
    const parent = parentContacts.find(p => p.id === parentId);
    if (!parent) return [];

    // 1. Matched by formal AthleteGuardianRelationship
    const rels = guardianRelationships.filter(r => r.guardianContactId === parentId);
    const relAthleteIds = new Set(rels.map(r => r.athleteId));

    // 2. Also find members explicitly assigned with guardianId, guardianName, or emergencyContactPhone
    const directMatches = clubMembers.filter(m => {
      if (relAthleteIds.has(m.id)) return true;
      if (m.guardianId === parentId || m.guardianId === parent.id) return true;
      if (m.guardianName && parent.fullName && m.guardianName.toLowerCase().trim() === parent.fullName.toLowerCase().trim()) return true;
      if (parent.contactNumber && m.emergencyContactPhone === parent.contactNumber) return true;
      return false;
    });

    // Deduplicate
    const map = new Map<string, Member>();
    directMatches.forEach(m => map.set(m.id, m));
    return Array.from(map.values());
  };

  // Children for the currently selected parent
  const activeChildren = useMemo(() => {
    if (!activeParent) return [];
    return getChildrenForParent(activeParent.id);
  }, [activeParent, clubMembers, guardianRelationships, parentContacts]);

  // Ensure active child is selected when parent changes
  useEffect(() => {
    if (activeChildren.length > 0) {
      if (!activeChildren.some(c => c.id === selectedChildId)) {
        setSelectedChildId(activeChildren[0].id);
      }
    } else {
      setSelectedChildId('');
    }
  }, [activeChildren, selectedParentId]);

  // The active child object
  const activeChild = useMemo(() => {
    return activeChildren.find(c => c.id === selectedChildId) || activeChildren[0] || null;
  }, [activeChildren, selectedChildId]);

  // Invoices for active child
  const childInvoices = useMemo(() => {
    if (!activeChild) return [];
    return invoices.filter(i => i.memberId === activeChild.id);
  }, [invoices, activeChild]);

  // Attendance for active child
  const childAttendance = useMemo(() => {
    if (!activeChild) return [];
    return store.attendance.filter(a => a.memberId === activeChild.id);
  }, [activeChild, store.attendance]);

  // Relationship description for active child & parent
  const currentChildRelation = useMemo(() => {
    if (!activeChild || !activeParent) return 'Child';
    const rel = guardianRelationships.find(
      r => r.athleteId === activeChild.id && r.guardianContactId === activeParent.id
    );
    if (rel) return rel.relationship;
    if (activeChild.emergencyContactRelation) return activeChild.emergencyContactRelation;
    return 'Dependent / Ward';
  }, [activeChild, activeParent, guardianRelationships]);

  // Quick age calculation from DOB string
  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const birth = new Date(dobString);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Handle Pay Invoice
  const handleConfirmPayment = () => {
    if (!selectedInvoiceToPay) return;
    store.recordPayment(selectedInvoiceToPay.id, selectedInvoiceToPay.total, 'DuitNow QR', 'Parent Portal Online');
    refreshData();
    setIsPaymentModalOpen(false);
    setSelectedInvoiceToPay(null);
  };

  // Handle Enroll New Child
  const handleEnrollChild = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeParent) return;

    const fd = new FormData(e.currentTarget);
    const fullName = fd.get('fullName') as string;
    const preferredName = fd.get('preferredName') as string;
    const gender = fd.get('gender') as any;
    const dob = fd.get('dob') as string;
    const icPassport = fd.get('icPassport') as string;
    const relationship = (fd.get('relationship') as any) || 'Son';
    const beltRank = (fd.get('beltRank') as string) || 'White Belt / Novice';
    const assignedCoachName = (fd.get('assignedCoachName') as string) || 'Sensei Mohan';
    const branchId = (fd.get('branchId') as string) || effectiveBranchId || 'Scms-CLUB-000001-B001';
    const medicalNotes = (fd.get('medicalNotes') as string) || 'Cleared for training';

    // Generate new member
    const newMemberId = `Scms-MEM-${Date.now().toString().slice(-6)}`;
    const newMember: Member = {
      id: newMemberId,
      clubId: effectiveClubId,
      branchId,
      fullName,
      preferredName: preferredName || fullName.split(' ')[0],
      gender,
      dob,
      icPassport,
      nationality: 'Malaysian',
      emergencyContactName: activeParent.fullName,
      emergencyContactPhone: activeParent.contactNumber,
      emergencyContactRelation: relationship,
      guardianId: activeParent.id,
      guardianName: activeParent.fullName,
      status: 'Active',
      isAthlete: true,
      isVolunteer: false,
      roles: ['ATHLETE', 'MEMBER'],
      assignedCoachName,
      trainingGroupId: 'tg-02',
      sportData: {
        beltRank,
        preferredDiscipline: 'Both (Kata & Kumite)',
        competitionCategory: 'Junior Development Division',
        competitionEvents: ['Kata', 'Kumite'],
      },
      medicalNotes,
      bloodType: 'O+',
      joinedDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to store
    store.addMember(newMember, currentUser?.fullName || 'Parent Portal');

    // Link relationship
    store.linkAthleteGuardian(newMemberId, activeParent.id, {
      relationship: relationship as any,
      isPrimaryContact: true,
      isEmergencyContact: true,
    });

    // Create inaugural tuition invoice
    const newInvoice: Invoice = {
      id: `Scms-INV-${Date.now()}`,
      invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      clubId: effectiveClubId,
      branchId,
      memberId: newMemberId,
      memberName: fullName,
      items: [
        { id: 'i1', description: 'Junior Cadet Monthly Tuition - Enrolment', quantity: 1, unitPrice: 120, amount: 120 },
        { id: 'i2', description: 'Club Registration & Badge Fee', quantity: 1, unitPrice: 30, amount: 30 },
      ],
      subtotal: 150,
      discount: 0,
      total: 150,
      amountPaid: 0,
      balanceDue: 150,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      issueDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    store.invoices.push(newInvoice);

    refreshData();
    setSelectedChildId(newMemberId);
    setIsEnrollModalOpen(false);
  };

  // Handle Add Parent Contact
  const handleAddParent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fullName = fd.get('fullName') as string;
    const contactNumber = fd.get('contactNumber') as string;
    const email = fd.get('email') as string;
    const isVolunteer = fd.get('isVolunteerEligible') === 'on';

    const newContact = store.addParentContact({
      clubId: effectiveClubId,
      fullName,
      contactNumber,
      email,
      isVolunteerEligible: isVolunteer,
      volunteerCommunicationConsent: isVolunteer,
      volunteerInterests: isVolunteer ? ['Event Marshall', 'Refreshments'] : [],
      availabilityNotes: 'Registered via Parent Portal',
      isActive: true,
      createdBy: currentUser?.fullName || 'SuperAdmin',
    }, currentUser?.fullName || 'SuperAdmin');

    refreshData();
    setSelectedParentId(newContact.id);
    setIsAddParentModalOpen(false);
  };

  // Filtered Parents for Database Roster View
  const filteredParents = useMemo(() => {
    return parentContacts.filter(p => {
      const q = searchQuery.toLowerCase();
      const pChildren = getChildrenForParent(p.id);
      const childNames = pChildren.map(c => c.fullName).join(' ').toLowerCase();

      const matchesSearch =
        p.fullName.toLowerCase().includes(q) ||
        (p.contactNumber || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        childNames.includes(q);

      const matchesVol =
        volunteerFilter === 'All'
          ? true
          : volunteerFilter === 'Volunteer'
          ? p.isVolunteerEligible
          : !p.isVolunteerEligible;

      return matchesSearch && matchesVol;
    });
  }, [parentContacts, searchQuery, volunteerFilter, clubMembers, guardianRelationships]);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* =================================================================== */}
      {/* 1. TOP HEADER & NAVIGATION                                         */}
      {/* =================================================================== */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sky-50 text-[#0284C7] rounded-full text-xs font-black uppercase tracking-wider mb-2 border border-sky-100">
              <UserCheck size={14} />
              <span>Family & Guardian Portal</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600 font-semibold">{activeClub?.displayName || 'Senshi Goju-Ryu'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Parent & Guardian Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Multi-child enrollment, class attendance records, belt grading syllabus tracking, and direct online payment of monthly dojo fees.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                onClick={() => setViewMode('family-hub')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  viewMode === 'family-hub'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Users size={14} className={viewMode === 'family-hub' ? 'text-[#0284C7]' : ''} />
                <span>Family Dashboard</span>
              </button>
              <button
                onClick={() => setViewMode('database-roster')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  viewMode === 'database-roster'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileText size={14} className={viewMode === 'database-roster' ? 'text-[#0284C7]' : ''} />
                <span>Family Database ({parentContacts.length})</span>
              </button>
            </div>

            <button
              onClick={() => setIsEnrollModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <UserPlus size={14} />
              <span>Enroll Child / Ward</span>
            </button>

            {isStaffOrAdmin && (
              <button
                onClick={() => setIsAddParentModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                <Plus size={14} />
                <span>Add Guardian</span>
              </button>
            )}
          </div>
        </div>

        {/* Family Selector Switcher Bar */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active Family Account:
            </span>
            <select
              value={selectedParentId}
              onChange={e => setSelectedParentId(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#0284C7] focus:bg-white"
            >
              {parentContacts.map(p => {
                const count = getChildrenForParent(p.id).length;
                return (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({count} {count === 1 ? 'Child' : 'Children'} Enrolled)
                  </option>
                );
              })}
            </select>
          </div>

          {activeParent && (
            <div className="flex items-center space-x-3 text-xs text-slate-500">
              <span className="flex items-center space-x-1">
                <Phone size={13} className="text-slate-400" />
                <span className="font-semibold text-slate-700">{activeParent.contactNumber}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Mail size={13} className="text-slate-400" />
                <span className="font-semibold text-slate-700">{activeParent.email || 'No email registered'}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. MAIN BODY: EITHER FAMILY DASHBOARD OR DATABASE ROSTER           */}
      {/* =================================================================== */}
      {viewMode === 'family-hub' ? (
        <div className="space-y-6">
          {/* Guardian Profile Summary Banner */}
          {activeParent && (
            <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-500/20 via-transparent to-transparent pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl font-black text-sky-300">
                    {activeParent.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl sm:text-2xl font-black text-white">{activeParent.fullName}</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/30 text-sky-200 border border-sky-400/30">
                        Verified Parent / Guardian
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-300">
                      <span className="font-mono text-sky-300">ID: {activeParent.id}</span>
                      <span>•</span>
                      <span>{activeChildren.length} {activeChildren.length === 1 ? 'Registered Child' : 'Registered Children'}</span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <MapPin size={12} className="text-sky-400" />
                        <span>{activeBranch?.name || 'Dojo Saujana Puchong (HQ)'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeParent.isVolunteerEligible ? (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center space-x-1.5">
                      <HeartHandshake size={14} />
                      <span>Volunteer Program: Active</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 text-slate-300 border border-white/10 flex items-center space-x-1.5">
                      <Shield size={14} />
                      <span>Emergency Guardian</span>
                    </span>
                  )}
                  <a
                    href={`https://wa.me/${activeParent.contactNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors flex items-center space-x-1.5"
                  >
                    <Phone size={13} />
                    <span>Contact via WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Children Tabs Strip */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Users size={14} className="text-[#0284C7]" />
                <span>Enrolled Children in this Dojo ({activeChildren.length})</span>
              </span>
              <button
                onClick={() => setIsEnrollModalOpen(true)}
                className="text-xs font-bold text-[#0284C7] hover:underline flex items-center space-x-1"
              >
                <Plus size={13} />
                <span>+ Enroll Another Child</span>
              </button>
            </div>

            {activeChildren.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#0284C7] flex items-center justify-center mx-auto">
                  <UserPlus size={24} />
                </div>
                <h4 className="font-black text-slate-900 text-base">No Children Enrolled Under this Guardian</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {activeParent?.fullName} does not have any junior athletes registered yet. Click below to enroll their first child.
                </p>
                <button
                  onClick={() => setIsEnrollModalOpen(true)}
                  className="px-4 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  Enroll Child Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {activeChildren.map(child => {
                  const isSelected = child.id === selectedChildId;
                  const age = calculateAge(child.dob);
                  return (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChildId(child.id)}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${
                        isSelected
                          ? 'bg-sky-50/90 border-[#0284C7] shadow-sm ring-2 ring-[#0284C7]/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center">
                          {child.fullName.charAt(0)}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          child.sportData?.beltRank?.includes('Black')
                            ? 'bg-slate-900 text-amber-300'
                            : child.sportData?.beltRank?.includes('Brown')
                            ? 'bg-amber-100 text-amber-900'
                            : child.sportData?.beltRank?.includes('Green')
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-yellow-100 text-yellow-900'
                        }`}>
                          {child.sportData?.beltRank?.split('(')[0] || 'Junior'}
                        </span>
                      </div>

                      <div className="mt-3">
                        <h4 className="font-extrabold text-xs text-slate-900 truncate">{child.fullName}</h4>
                        <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span>{child.gender}</span>
                          {age !== null && (
                            <>
                              <span>•</span>
                              <span>{age} yrs old</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-mono text-[#0284C7]">{child.id}</span>
                        <span className="font-bold text-slate-700">{child.status}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Child 360 Workspace */}
          {activeChild && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              {/* Child Header Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#0284C7] uppercase tracking-wider">
                      Junior Martial Arts Roster
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-semibold text-slate-500">
                      Relationship: <strong className="text-slate-800">{currentChildRelation}</strong>
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-950">{activeChild.fullName}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="font-mono text-slate-600">ID: {activeChild.id}</span>
                    <span>•</span>
                    <span>MyKad/IC: <strong className="text-slate-800">{activeChild.icPassport || '—'}</strong></span>
                    <span>•</span>
                    <span>DOB: <strong className="text-slate-800">{activeChild.dob || '—'}</strong> ({calculateAge(activeChild.dob) || '—'} years)</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1.5">
                    <CheckCircle2 size={14} />
                    <span>Enrolled & Ready (KT 3.0 Synced)</span>
                  </span>
                </div>
              </div>

              {/* 4 Quick Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 bg-sky-50/70 border border-sky-100 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-sky-700 tracking-wider block">
                    Current Belt Rank
                  </span>
                  <span className="text-sm sm:text-base font-black text-slate-900 block truncate">
                    {activeChild.sportData?.beltRank || 'Green Belt (7th Kyu)'}
                  </span>
                  <span className="text-[11px] text-sky-800 block">
                    Graded: {activeChild.sportData?.lastGradingDate || 'Recent'}
                  </span>
                </div>

                <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
                    Assigned Sensei
                  </span>
                  <span className="text-sm sm:text-base font-black text-slate-900 block truncate">
                    {activeChild.assignedCoachName || 'Sensei Mohan'}
                  </span>
                  <span className="text-[11px] text-amber-900 block">
                    {activeBranch?.name || 'Saujana Puchong HQ'}
                  </span>
                </div>

                <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">
                    Attendance Rate
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-800 block">
                    {childAttendance.length > 0 ? '95% On-Time' : '100% Active'}
                  </span>
                  <span className="text-[11px] text-emerald-700 block">
                    {childAttendance.length} classes recorded
                  </span>
                </div>

                <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider block">
                    Monthly Dues Status
                  </span>
                  {childInvoices.some(i => i.status === 'Pending') ? (
                    <>
                      <span className="text-sm sm:text-base font-black text-amber-600 block">
                        MYR {childInvoices.find(i => i.status === 'Pending')?.total.toFixed(2)} Due
                      </span>
                      <span className="text-[11px] text-amber-700 block font-bold">March 2026 Tuition</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm sm:text-base font-black text-emerald-700 block">
                        All Dues Settle
                      </span>
                      <span className="text-[11px] text-emerald-600 block">Next cycle: April 1</span>
                    </>
                  )}
                </div>
              </div>

              {/* Child Deep Dive Tabs */}
              <div className="border-b border-slate-200">
                <div className="flex space-x-6">
                  {[
                    { id: 'overview', label: 'Athlete Bio & Details', icon: UserCheck },
                    { id: 'attendance', label: 'Class Attendance Log', icon: CalendarCheck2 },
                    { id: 'syllabus', label: 'Belt Promotion & Syllabus', icon: Award },
                    { id: 'fees', label: 'Club Dues & Receipts', icon: CreditCard },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeChildTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveChildTab(tab.id as any)}
                        className={`flex items-center space-x-2 py-3 text-xs font-bold border-b-2 transition-all ${
                          isActive
                            ? 'border-[#0284C7] text-[#0284C7]'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Icon size={15} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab 1: Overview & Athlete Bio */}
              {activeChildTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">
                      Martial Arts & Training Profile
                    </h4>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-medium">Discipline / Focus:</span>
                        <span className="font-bold text-slate-800">
                          {activeChild.sportData?.preferredDiscipline || 'Both (Kata & Kumite)'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-medium">Competition Division:</span>
                        <span className="font-bold text-[#0284C7]">
                          {activeChild.sportData?.competitionCategory || 'Junior Cadet Kata & Kumite'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-medium">Weigh-in & Height:</span>
                        <span className="font-bold text-slate-800">
                          {activeChild.sportData?.weightKg || '42'} kg • {activeChild.sportData?.heightCm || '148'} cm
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-medium">Dojo Training Group:</span>
                        <span className="font-bold text-slate-800">Junior Development Cadet (tg-02)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500 font-medium">Enrolled Since:</span>
                        <span className="font-bold text-slate-800">{activeChild.joinedDate || '2024-06-01'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">
                      Medical & Emergency Clearance
                    </h4>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-medium">Emergency Guardian:</span>
                        <span className="font-bold text-slate-800">{activeParent.fullName} ({currentChildRelation})</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-medium">Emergency Phone:</span>
                        <span className="font-bold text-slate-800">{activeParent.contactNumber}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-medium">Blood Group:</span>
                        <span className="font-bold text-slate-800">{activeChild.bloodType || 'O+'}</span>
                      </div>
                      <div className="py-1">
                        <span className="text-slate-500 font-medium block mb-1">Health Notes / Allergies:</span>
                        <p className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-700 italic">
                          {activeChild.medicalNotes || 'No known allergies or physical restrictions. Fully cleared for contact karate.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Class Attendance Log */}
              {activeChildTab === 'attendance' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sky-50/60 p-4 rounded-2xl border border-sky-100">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">Training Session Attendance</h4>
                      <p className="text-xs text-slate-500">Official log recorded by dojo senseis & digital QR check-in.</p>
                    </div>
                    <button
                      onClick={() => setIsLeaveModalOpen(true)}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-xs"
                    >
                      Notify Absence / Medical Leave
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Session Date & Time</th>
                          <th className="py-3 px-4">Training Class</th>
                          <th className="py-3 px-4">Sensei in Charge</th>
                          <th className="py-3 px-4">Remarks / Focus</th>
                          <th className="py-3 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {childAttendance.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              <CalendarCheck2 size={24} className="mx-auto mb-2 opacity-40" />
                              <p className="font-bold text-xs">No attendance sessions logged yet for this month</p>
                            </td>
                          </tr>
                        ) : (
                          childAttendance.map((rec, idx) => (
                            <tr key={rec.id || idx} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4 font-semibold text-slate-800">
                                {rec.updatedAt ? rec.updatedAt.split('T')[0] : '2026-03-03'} • {rec.checkInTime || '17:00'}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900">
                                Junior Cadet Kata & Kumite
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {rec.recordedBy || 'Sensei Mohan'}
                              </td>
                              <td className="py-3 px-4 text-slate-500 italic">
                                {rec.remarks || 'Standard technical syllabus drills'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  rec.status === 'Present'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {rec.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Belt Promotion & Syllabus */}
              {activeChildTab === 'syllabus' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 rounded-2xl border border-amber-200 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Award size={18} className="text-amber-700" />
                      <h4 className="font-black text-sm text-amber-950 uppercase">
                        Promotion Target: Next Belt Grade
                      </h4>
                    </div>
                    <p className="text-xs text-amber-900">
                      Currently holding <strong className="text-slate-900">{activeChild.sportData?.beltRank || 'Green Belt (7th Kyu)'}</strong>.
                      Eligible for testing in the upcoming April 2026 Senshi Club Grading Exam upon completing the required curriculum.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                        1. Kihon & Fundamentals
                      </span>
                      <ul className="space-y-1.5 text-slate-600">
                        <li className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                          <Check size={13} />
                          <span>Zenkutsu-dachi & Oi-zuki</span>
                        </li>
                        <li className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                          <Check size={13} />
                          <span>Age-uke / Gyaku-zuki combo</span>
                        </li>
                        <li className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                          <Check size={13} />
                          <span>Mae-geri & Mawashi-geri kicks</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                        2. Kata Precision
                      </span>
                      <ul className="space-y-1.5 text-slate-600">
                        <li className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                          <Check size={13} />
                          <span>Heian Sandan (Mastered)</span>
                        </li>
                        <li className="flex items-center space-x-1.5 text-sky-700 font-semibold">
                          <Clock size={13} />
                          <span>Heian Yondan (In Progress)</span>
                        </li>
                        <li className="flex items-center space-x-1.5 text-slate-400">
                          <span className="w-3 h-3 rounded-full border border-slate-300 inline-block" />
                          <span>Bunkai application test</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                        3. Kumite Sparring Readiness
                      </span>
                      <ul className="space-y-1.5 text-slate-600">
                        <li className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                          <Check size={13} />
                          <span>Sanbon Kumite defense drills</span>
                        </li>
                        <li className="flex items-center space-x-1.5 text-sky-700 font-semibold">
                          <Clock size={13} />
                          <span>Touch-sparring distance control</span>
                        </li>
                        <li className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                          <Check size={13} />
                          <span>Safety gear & mouthguard fitted</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Club Dues & Invoices */}
              {activeChildTab === 'fees' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">Enrolment Dues & Monthly Tuition</h4>
                      <p className="text-xs text-slate-500">Official club invoices with instant DuitNow QR digital settlement.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {childInvoices.length === 0 ? (
                      <div className="bg-slate-50 p-8 rounded-2xl text-center text-slate-400">
                        <CreditCard size={24} className="mx-auto mb-2 opacity-40" />
                        <p className="font-bold text-xs">No invoices generated for this athlete yet</p>
                      </div>
                    ) : (
                      childInvoices.map(inv => (
                        <div
                          key={inv.id}
                          className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-[#0284C7]">{inv.invoiceNumber}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.status === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {inv.status === 'Paid' ? 'Paid in Full' : 'Payment Due'}
                              </span>
                            </div>
                            <h5 className="font-bold text-xs text-slate-900">
                              {inv.items.map(it => it.description).join(', ')}
                            </h5>
                            <span className="text-[11px] text-slate-500 block">
                              Issued: {inv.issueDate} • Due Date: {inv.dueDate}
                            </span>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                              <span className="text-base font-black text-slate-900">MYR {inv.total.toFixed(2)}</span>
                            </div>

                            {inv.status === 'Pending' ? (
                              <button
                                onClick={() => {
                                  setSelectedInvoiceToPay(inv);
                                  setIsPaymentModalOpen(true);
                                }}
                                className="px-4 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                              >
                                <QrCode size={14} />
                                <span>Pay via DuitNow QR</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => alert(`Official Receipt for ${inv.invoiceNumber}\nAmount: MYR ${inv.total.toFixed(2)}\nPaid on: ${inv.createdAt}\nPayment Method: DuitNow / FPX`)}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center space-x-1.5"
                              >
                                <Receipt size={14} />
                                <span>View Receipt</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* =================================================================== */
        /* 3. DATABASE ROSTER VIEW (ALL ENROLLED FAMILIES)                     */
        /* =================================================================== */
        <div className="space-y-4 animate-fade-in">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search guardian name, child name, phone, or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-[#0284C7] focus:bg-white"
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500">Volunteers:</span>
              <select
                value={volunteerFilter}
                onChange={e => setVolunteerFilter(e.target.value as any)}
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:border-[#0284C7]"
              >
                <option value="All">All Guardians</option>
                <option value="Volunteer">Volunteer Eligible</option>
                <option value="Non-Volunteer">Non-Volunteers</option>
              </select>
            </div>
          </div>

          {/* Families Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Parent / Guardian</th>
                    <th className="py-3.5 px-4">Contact Phone & Email</th>
                    <th className="py-3.5 px-4">Enrolled Children & Belt Ranks</th>
                    <th className="py-3.5 px-4">Volunteer Engagement</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-bold text-sm">No families found matching your criteria</p>
                      </td>
                    </tr>
                  ) : (
                    filteredParents.map(parent => {
                      const children = getChildrenForParent(parent.id);
                      return (
                        <tr key={parent.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {parent.fullName.charAt(0)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">{parent.fullName}</span>
                                <span className="text-[10px] font-mono text-[#0284C7]">{parent.id}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 block">{parent.contactNumber}</span>
                            <span className="text-[11px] text-slate-500 block">{parent.email || '—'}</span>
                          </td>

                          <td className="py-3.5 px-4">
                            {children.length === 0 ? (
                              <span className="text-slate-400 italic">No enrolled children</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {children.map(ch => (
                                  <span
                                    key={ch.id}
                                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200"
                                  >
                                    <span>{ch.fullName}</span>
                                    <span className="text-sky-400">•</span>
                                    <span className="text-[#0284C7]">{ch.sportData?.beltRank?.split('(')[0] || 'Junior'}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {parent.isVolunteerEligible ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Volunteer Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                Standard Guardian
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => {
                                  setSelectedParentId(parent.id);
                                  setViewMode('family-hub');
                                }}
                                className="px-3 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white text-[11px] font-bold rounded-xl transition-colors shadow-xs"
                              >
                                Manage Hub
                              </button>
                              <button
                                onClick={() => openEditParentModal(parent)}
                                className="p-1.5 text-slate-400 hover:text-[#0284C7] hover:bg-sky-50 rounded-lg transition-colors"
                                title="Edit Guardian & Athletes"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteParent(parent)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Guardian"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. MODALS                                                          */}
      {/* =================================================================== */}

      {/* ENROLL CHILD MODAL */}
      {isEnrollModalOpen && activeParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Enroll Child / Ward</h3>
                <p className="text-xs text-slate-500">
                  Register a junior athlete under guardian <strong className="text-slate-800">{activeParent.fullName}</strong>.
                </p>
              </div>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEnrollChild} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Child Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  required
                  placeholder="e.g. Nur Hana binti Ahmad"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Preferred Name</label>
                  <input
                    type="text"
                    name="preferredName"
                    placeholder="e.g. Hana"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Relationship to Parent *</label>
                  <select
                    name="relationship"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-semibold"
                  >
                    <option value="Daughter">Daughter</option>
                    <option value="Son">Son</option>
                    <option value="Ward">Legal Ward</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Gender *</label>
                  <select
                    name="gender"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    name="dob"
                    required
                    defaultValue="2016-08-12"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">MyKad / Birth Cert No.</label>
                  <input
                    type="text"
                    name="icPassport"
                    placeholder="160812-14-5544"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Starting Belt Rank</label>
                  <select
                    name="beltRank"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  >
                    <option value="White Belt / Novice">White Belt / Novice</option>
                    <option value="Yellow Belt (8th Kyu)">Yellow Belt (8th Kyu)</option>
                    <option value="Green Belt (7th Kyu)">Green Belt (7th Kyu)</option>
                    <option value="Blue Belt (6th Kyu)">Blue Belt (6th Kyu)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Assigned Coach / Sensei</label>
                  <select
                    name="assignedCoachName"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  >
                    <option value="Sensei Mohan">Sensei Mohan (Senior Coach)</option>
                    <option value="Shihan Kannan">Shihan Kannan (Chief Instructor)</option>
                    <option value="Sensei Bala">Sensei Bala</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Training Dojo Branch</label>
                  <select
                    name="branchId"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  >
                    <option value="Scms-CLUB-000001-B001">Dojo Saujana Puchong (HQ)</option>
                    <option value="Scms-CLUB-000001-B002">Dojo USJ Taipan</option>
                    <option value="Scms-CLUB-000001-B003">Dojo Cyberjaya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Medical Clearance / Allergies</label>
                <input
                  type="text"
                  name="medicalNotes"
                  placeholder="e.g. Cleared for contact sport. No known allergies."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Complete Enrollment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DUITNOW QR PAYMENT MODAL */}
      {isPaymentModalOpen && selectedInvoiceToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-[#0284C7] uppercase tracking-wider">
                Digital Payment Gateway
              </span>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-900">DuitNow QR Instant Pay</h4>
              <p className="text-xs text-slate-500">Scan with any Malaysian banking or eWallet app</p>
            </div>

            {/* DuitNow QR Mock Box */}
            <div className="p-4 bg-pink-50 border-2 border-pink-500 rounded-2xl inline-block mx-auto">
              <div className="w-48 h-48 bg-white p-2 rounded-xl border border-pink-200 flex flex-col items-center justify-center space-y-2">
                <QrCode size={130} className="text-pink-600" />
                <span className="text-[10px] font-black text-pink-700 tracking-wider">DUITNOW QR NATIONAL</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-mono font-bold text-slate-900">{selectedInvoiceToPay.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Beneficiary:</span>
                <span className="font-bold text-slate-900">Senshi Goju-Ryu Karate-Do</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-700">Amount to Pay:</span>
                <span className="font-black text-[#0284C7] text-sm">MYR {selectedInvoiceToPay.total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleConfirmPayment}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5"
            >
              <CheckCircle2 size={15} />
              <span>Confirm Payment & Settle Invoice</span>
            </button>
          </div>
        </div>
      )}

      {/* NOTIFY ABSENCE / MEDICAL LEAVE MODAL */}
      {isLeaveModalOpen && activeChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Notify Dojo Absence</h3>
                <p className="text-xs text-slate-500">Submit an excused absence note for {activeChild.fullName}</p>
              </div>
              <button
                onClick={() => {
                  setIsLeaveModalOpen(false);
                  setLeaveSubmittedMsg(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {leaveSubmittedMsg ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check size={24} />
                </div>
                <h4 className="font-black text-slate-900">Absence Submitted Successfully</h4>
                <p className="text-xs text-slate-500">
                  {activeChild.assignedCoachName || 'Sensei Mohan'} has been notified of the excused absence.
                </p>
                <button
                  onClick={() => {
                    setIsLeaveModalOpen(false);
                    setLeaveSubmittedMsg(false);
                  }}
                  className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
                >
                  Close
                </button>
              </div>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  setLeaveSubmittedMsg(true);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Absence Date *</label>
                  <input
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Reason for Absence *</label>
                  <select className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-semibold">
                    <option value="Medical / Illness">Medical / Illness (Flu, Fever, etc.)</option>
                    <option value="School Examination">School Examination / Academic Event</option>
                    <option value="Family Commitment">Family Travel / Emergency</option>
                    <option value="Injury Recovery">Injury Recovery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Additional Note to Sensei</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Has mild fever, doctor advised 2 days rest."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsLeaveModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl shadow-xs"
                  >
                    Submit Absence Notice
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ADD PARENT CONTACT MODAL (STAFF) */}
      {isAddParentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Add Parent / Guardian Profile</h3>
                <p className="text-xs text-slate-500">Register a new guardian for dojo enrollment</p>
              </div>
              <button
                onClick={() => setIsAddParentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddParent} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  required
                  placeholder="e.g. Dr. Ramesh Kumar"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Contact Phone (WhatsApp) *</label>
                <input
                  type="tel"
                  name="contactNumber"
                  required
                  placeholder="+6012-3344556"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="ramesh.kumar@example.com"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                />
              </div>

              <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isVolunteerEligible"
                    defaultChecked
                    className="rounded text-[#0284C7] focus:ring-[#0284C7]"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Opt-in to Club Volunteer & Tournament Marshalling Program
                  </span>
                </label>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddParentModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Register Guardian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PARENT CONTACT MODAL */}
      {isEditParentModalOpen && editingParentContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Edit Parent / Guardian Profile</h3>
                <p className="text-xs text-slate-500 font-mono text-[#0284C7]">{editingParentContact.id}</p>
              </div>
              <button
                onClick={() => setIsEditParentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveParent} className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Guardian Information</span>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    defaultValue={editingParentContact.fullName}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Contact Phone (WhatsApp) *</label>
                    <input
                      type="tel"
                      name="contactNumber"
                      required
                      defaultValue={editingParentContact.contactNumber}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={editingParentContact.email || ''}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isVolunteerEligible"
                      defaultChecked={editingParentContact.isVolunteerEligible}
                      className="rounded text-[#0284C7] focus:ring-[#0284C7]"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Volunteer Program Participant
                    </span>
                  </label>
                </div>
              </div>

              {/* Connected Children & Relationships */}
              <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0284C7] uppercase tracking-wider flex items-center space-x-1.5">
                    <Trophy size={14} />
                    <span>Connected Athletes & Wards ({editingParentRels.length})</span>
                  </span>
                </div>

                {editingParentRels.length === 0 ? (
                  <div className="p-3 bg-white rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    No athletes connected yet. Use selector below to link an athlete.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editingParentRels.map((rel, rIdx) => (
                      <div
                        key={rIdx}
                        className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{rel.athleteName}</span>
                          <span className="text-[10px] font-mono text-slate-400">({rel.athleteId})</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <select
                            value={rel.relationship}
                            onChange={e => {
                              const newRel = e.target.value;
                              setEditingParentRels(prev =>
                                prev.map((item, idx) => idx === rIdx ? { ...item, relationship: newRel } : item)
                              );
                            }}
                            className="px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                          >
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Guardian">Guardian</option>
                            <option value="Spouse">Spouse</option>
                            <option value="Other">Other</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingParentRels(prev => prev.filter((_, idx) => idx !== rIdx));
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Unlink"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Link another athlete selector */}
                <div className="pt-2 border-t border-sky-100 flex items-center gap-2">
                  <select
                    value={athleteToLink}
                    onChange={e => setAthleteToLink(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="">-- Connect an Athlete --</option>
                    {clubMembers
                      .filter(m => !editingParentRels.some(r => r.athleteId === m.id))
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.fullName}
                        </option>
                      ))}
                  </select>

                  <select
                    value={athleteRelationToLink}
                    onChange={e => setAthleteRelationToLink(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Other">Other</option>
                  </select>

                  <button
                    type="button"
                    disabled={!athleteToLink}
                    onClick={() => {
                      if (!athleteToLink) return;
                      const selectedAth = clubMembers.find(m => m.id === athleteToLink);
                      if (selectedAth) {
                        setEditingParentRels(prev => [
                          ...prev,
                          {
                            id: `new-${Date.now()}`,
                            athleteId: selectedAth.id,
                            athleteName: selectedAth.fullName,
                            relationship: athleteRelationToLink,
                            isEmergencyContact: true,
                            isPrimaryContact: true,
                          },
                        ]);
                        setAthleteToLink('');
                      }
                    }}
                    className="px-3 py-1.5 bg-[#0284C7] disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    Connect
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditParentModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
