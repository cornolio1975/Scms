'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';
import {
  Users,
  Search,
  Filter,
  Plus,
  Pencil,
  Trash2,
  Trophy,
  HeartHandshake,
  Database,
  Shield,
  Phone,
  Mail,
  UserCheck,
  Award,
  Flame,
  ShieldCheck,
  Check,
  X,
  UserPlus,
  Scale,
  Ruler,
  GitBranch,
  Calendar,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import ParentGuardianDetails from './ParentGuardianDetails';
import DataManagementCenter from './DataManagementCenter';
import { ParentContact, GuardianRelationshipType } from '@/types';

export type MemberTab = 'all' | 'athletes' | 'guardians' | 'data-management';

interface MembersDirectoryProps {
  clubId?: string;
  branchId?: string;
  initialTab?: MemberTab;
  autoOpenAddModal?: boolean;
}

export default function MembersDirectory({
  clubId,
  branchId,
  initialTab = 'all',
  autoOpenAddModal = false,
}: MembersDirectoryProps) {
  const { activeRole, activeClub, activeBranch, currentUser } = useAuth();
  
  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<MemberTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Filters for Tab 1: All Members
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');

  // Filters for Tab 2: Athletes
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('All');

  // Filters for Tab 3: Parents & Guardians
  const [guardianSearchQuery, setGuardianSearchQuery] = useState('');
  const [guardianVolunteerFilter, setGuardianVolunteerFilter] = useState('All');

  // Core Data
  const [members, setMembers] = useState<any[]>([]);
  const [parentContacts, setParentContacts] = useState<any[]>([]);
  const [guardianRelationships, setGuardianRelationships] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Guardian Modal state
  const [isAddGuardianModalOpen, setIsAddGuardianModalOpen] = useState(false);
  const [guardianFeedback, setGuardianFeedback] = useState<string | null>(null);

  const supabase = createClient();

  const currentClubId = clubId || activeClub?.id;
  const currentBranchId = branchId !== undefined ? branchId : activeBranch?.id;

  // Roles the current operator is allowed to assign
  const ALL_ROLE_OPTIONS = [
    { val: 'MEMBER', label: 'Member' },
    { val: 'ATHLETE', label: 'Athlete' },
    { val: 'PARENT', label: 'Parent / Guardian' },
    { val: 'COACH', label: 'Coach' },
    { val: 'VOLUNTEER', label: 'Volunteer' },
    { val: 'BRANCH_MANAGER', label: 'Branch Manager' },
    { val: 'CLUB_ADMIN', label: 'Club Admin' },
  ];
  const BRANCH_MANAGER_ASSIGNABLE = ['MEMBER', 'ATHLETE', 'PARENT', 'COACH', 'VOLUNTEER'];
  const isBranchManager = activeRole === 'BRANCH_MANAGER';
  const roleOptions = isBranchManager
    ? ALL_ROLE_OPTIONS.filter(r => BRANCH_MANAGER_ASSIGNABLE.includes(r.val))
    : ALL_ROLE_OPTIONS;
  const assignable = roleOptions.map(r => r.val);
  const operatorBranchId = isBranchManager
    ? (branchId || activeBranch?.id)
    : (currentBranchId === '__ALL__' ? undefined : currentBranchId);

  // Branch Name helper
  const getBranchName = useCallback((bId?: string) => {
    if (!bId || bId === '__ALL__') return 'Main Club / Honbu';
    const match = branches.find(b => b.id === bId);
    return match ? match.name : bId;
  }, [branches]);

  // Load branches
  useEffect(() => {
    const targetClub = currentClubId || activeClub?.id;
    if (targetClub) {
      if (targetClub.startsWith('Scms-')) {
        import('@/lib/store').then(({ store }) => {
          setBranches(store.getBranches(targetClub));
        });
      } else {
        const fetchBranches = async () => {
          const { data } = await supabase.from('club_branches').select('id, name').eq('club_id', targetClub);
          if (data) setBranches(data);
        };
        fetchBranches();
      }
    }
  }, [currentClubId, activeClub, supabase]);

  // Helper to determine accurate discipline
  const getAthleteDiscipline = useCallback((a: any) => {
    if (a?.sportData?.preferredDiscipline) {
      return a.sportData.preferredDiscipline;
    }
    const events = a?.sportData?.competitionEvents || [];
    if (events.length === 0 && a?.sportData?.competitionCategory?.includes('Non-Active')) return 'Non-Active';
    if (events.includes('Kumite') && events.includes('Kata')) return 'Both (Kata & Kumite)';
    if (events.includes('Kumite')) return 'Kumite Only';
    if (events.includes('Kata')) return 'Kata Only';
    return 'Both (Kata & Kumite)';
  }, []);

  // Helper to determine accurate competition category / division
  const getAthleteCategory = useCallback((a: any) => {
    const disc = getAthleteDiscipline(a);
    if (disc === 'Non-Active' || disc?.toLowerCase()?.includes('non-active')) {
      return 'N/A (Non-Active)';
    }

    if (a?.sportData?.competitionCategory && a.sportData.competitionCategory.trim()) {
      return a.sportData.competitionCategory.trim();
    }
    if (a?.sportData?.category && a.sportData.category.trim()) {
      return a.sportData.category.trim();
    }
    if (a?.sportData?.targetCategoryName && a.sportData.targetCategoryName.trim()) {
      return a.sportData.targetCategoryName.trim();
    }

    // Derive realistic and accurate sport category based on gender, age, weight, and discipline
    const gender = a?.gender || 'Male';
    const weight = a?.sportData?.weightKg;
    const isFemale = gender.toLowerCase() === 'female';

    let age = 20;
    if (a?.dob) {
      const birthYear = new Date(a.dob).getFullYear();
      if (!isNaN(birthYear)) {
        age = Math.max(1, new Date().getFullYear() - birthYear);
      }
    }

    const agePrefix = age < 14 ? 'U-14' : age < 16 ? 'Cadet' : age < 18 ? 'Junior' : 'Senior';

    if (disc === 'Kata Only') {
      return `${isFemale ? 'Female' : 'Male'} ${agePrefix} Individual Kata`;
    }

    // Weight class for Kumite
    let weightClass = 'Open Weight';
    if (weight) {
      if (isFemale) {
        if (weight <= 50) weightClass = '-50kg';
        else if (weight <= 55) weightClass = '-55kg';
        else if (weight <= 61) weightClass = '-61kg';
        else if (weight <= 68) weightClass = '-68kg';
        else weightClass = '+68kg';
      } else {
        if (weight <= 60) weightClass = '-60kg';
        else if (weight <= 67) weightClass = '-67kg';
        else if (weight <= 75) weightClass = '-75kg';
        else if (weight <= 84) weightClass = '-84kg';
        else weightClass = '+84kg';
      }
    }

    if (disc === 'Kumite Only') {
      return `${isFemale ? 'Female' : 'Male'} ${agePrefix} Kumite ${weightClass}`;
    }

    return `${isFemale ? 'Female' : 'Male'} ${agePrefix} Kata & Kumite ${weightClass}`;
  }, [getAthleteDiscipline]);

  // Fetch Members
  const fetchMembers = useCallback(async () => {
    if (!currentClubId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const uniqueMembersMap = new Map<string, any>();

    // 1. Fetch from Store
    try {
      const { store } = await import('@/lib/store');
      let mockMembers = store.getMembers(currentClubId);
      if (currentBranchId && currentBranchId !== '__ALL__') {
        mockMembers = mockMembers.filter(m => m.branchId === currentBranchId);
      }
      
      mockMembers.forEach(m => {
        if (m && m.id && !uniqueMembersMap.has(m.id)) {
          const rawRoles = m.roles || (m.isAthlete ? ['ATHLETE'] : ['MEMBER']);
          uniqueMembersMap.set(m.id, {
            ...m,
            id: m.id,
            fullName: m.fullName,
            email: m.email,
            phone: m.phone,
            status: m.status || 'Active',
            branchId: m.branchId,
            assignedCoachName: m.assignedCoachName,
            roles: Array.from(new Set(rawRoles)),
          });
        }
      });

      // 2. Club users with roles in this club (Shihan Kannan, Sensei Mohan, etc.)
      const clubUsers = store.users.filter(u => 
        u.roles.some(r => r.clubId === currentClubId || (!r.clubId && u.activeClubId === currentClubId))
      );
      clubUsers.forEach(u => {
        const matchingRoles = u.roles
          .filter(r => r.clubId === currentClubId || (!r.clubId && u.activeClubId === currentClubId))
          .map(r => r.role);
        const roles = matchingRoles.length > 0 ? matchingRoles : [u.activeRole || 'MEMBER'];
        
        const userBranchId = u.activeBranchId || u.roles.find(r => r.clubId === currentClubId)?.branchId;
        if (currentBranchId && currentBranchId !== '__ALL__' && userBranchId && userBranchId !== currentBranchId) {
          return;
        }

        const existingMember = Array.from(uniqueMembersMap.values()).find(
          m => m.id === u.id || (u.email && m.email && m.email.toLowerCase() === u.email.toLowerCase())
        );

        if (existingMember) {
          if (userBranchId && !existingMember.branchId) existingMember.branchId = userBranchId;
          const mergedRoles = Array.from(new Set([...(existingMember.roles || []), ...roles]));
          existingMember.roles = mergedRoles;
        } else {
          uniqueMembersMap.set(u.id, {
            ...u,
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            phone: u.phone,
            status: u.status || 'Active',
            branchId: userBranchId,
            roles: Array.from(new Set(roles)),
          });
        }
      });

      // 3. Primary admin from club profile
      const currentClub: any = store.getClubById(currentClubId);
      if (currentClub && (currentClub.primaryAdminName || currentClub.primary_admin_name)) {
        const pName = currentClub.primaryAdminName || currentClub.primary_admin_name;
        const pEmail = currentClub.primaryAdminEmail || currentClub.primary_admin_email;
        const pPhone = currentClub.primaryAdminPhone || currentClub.primary_admin_phone;
        const pId = currentClub.primaryAdminId || currentClub.primary_admin_id || 'usr-padmin';
        
        const existing = Array.from(uniqueMembersMap.values()).find(
          m => (pEmail && m.email && m.email.toLowerCase() === pEmail.toLowerCase()) || m.fullName === pName
        );
        if (!existing) {
          uniqueMembersMap.set(pId, {
            id: pId,
            fullName: pName,
            email: pEmail,
            phone: pPhone,
            status: 'Active',
            branchId: undefined,
            roles: ['CLUB_ADMIN'],
          });
        }
      }
    } catch (err) {
      console.error('Error fetching mock members:', err);
    }

    // 4. Supabase integration
    try {
      let query = supabase
        .from('user_roles')
        .select(`
          id,
          role,
          branch_id,
          status: granted_at,
          profiles (
            id,
            email,
            full_name,
            phone,
            status
          )
        `)
        .eq('club_id', currentClubId);

      if (currentBranchId && currentBranchId !== '__ALL__') {
        query = query.eq('branch_id', currentBranchId);
      }

      const { data, error } = await query;
      
      if (!error && data && data.length > 0) {
        data.forEach((r: any) => {
          if (r.profiles) {
            const existing = Array.from(uniqueMembersMap.values()).find(
              m => m.id === r.profiles.id || (r.profiles.email && m.email && m.email.toLowerCase() === r.profiles.email.toLowerCase())
            );
            if (existing) {
              if (!existing.roles.includes(r.role)) {
                existing.roles.push(r.role);
              }
              if (r.branch_id && !existing.branchId) {
                existing.branchId = r.branch_id;
              }
            } else {
              uniqueMembersMap.set(r.profiles.id, {
                id: r.profiles.id,
                fullName: r.profiles.full_name,
                email: r.profiles.email,
                phone: r.profiles.phone,
                status: r.profiles.status || 'Active',
                branchId: r.branch_id,
                roles: [r.role],
              });
            }
          }
        });
      }
    } catch (err) {
      // Non-fatal
    }

    setMembers(Array.from(uniqueMembersMap.values()));
    setLoading(false);
  }, [currentClubId, currentBranchId, supabase]);

  // Fetch Parents & Guardians
  const fetchParentsAndGuardians = useCallback(async () => {
    if (!currentClubId) return;
    try {
      const { store } = await import('@/lib/store');
      let contacts = store.getParentContacts(currentClubId);
      let relationships = store.athleteGuardianRelationships || [];

      // Merge emergency contacts registered directly on athletes if not already a ParentContact
      const clubMembers = store.getMembers(currentClubId);
      clubMembers.forEach(m => {
        if (m.emergencyContactName && m.emergencyContactName !== 'None' && m.emergencyContactName.trim().length > 0) {
          const alreadyExists = contacts.some(
            c => c.fullName.toLowerCase() === m.emergencyContactName?.toLowerCase() ||
                 (c.contactNumber && m.emergencyContactPhone && c.contactNumber === m.emergencyContactPhone)
          );
          if (!alreadyExists) {
            const virtualContact = {
              id: `vir-${m.id}`,
              clubId: currentClubId,
              fullName: m.emergencyContactName,
              contactNumber: m.emergencyContactPhone || '—',
              email: undefined,
              isVolunteerEligible: !!m.isVolunteer,
              volunteerCommunicationConsent: false,
              isActive: true,
              isEmergencyOnly: true,
              relationship: m.emergencyContactRelation || 'Guardian',
              linkedAthleteName: m.fullName,
              linkedAthleteId: m.id,
            };
            contacts.push(virtualContact as any);
          }
        }
      });

      setParentContacts(contacts);
      setGuardianRelationships(relationships);
    } catch (err) {
      console.error('Error fetching parent contacts:', err);
    }
  }, [currentClubId]);

  useEffect(() => {
    fetchMembers();
    fetchParentsAndGuardians();
  }, [fetchMembers, fetchParentsAndGuardians]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedNewRoles, setSelectedNewRoles] = useState<string[]>(['MEMBER']);
  const [guardianLinks, setGuardianLinks] = useState<any[]>([]);

  // Add Member form controlled sports fields
  const [newDiscipline, setNewDiscipline] = useState<string>('Both (Kata & Kumite)');
  const [newCategory, setNewCategory] = useState<string>('');
  const [newBeltRank, setNewBeltRank] = useState<string>('White Belt / Novice');
  const [newCoach, setNewCoach] = useState<string>('Shihan Kannan');
  const [newBranchId, setNewBranchId] = useState<string>('');
  const [newGradingDate, setNewGradingDate] = useState<string>('');

  useEffect(() => {
    if (autoOpenAddModal) {
      setIsAddModalOpen(true);
    }
  }, [autoOpenAddModal]);

  // Edit Member Modal state & controlled fields
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editBranchId, setEditBranchId] = useState<string>('');
  const [editCoach, setEditCoach] = useState<string>('Shihan Kannan');
  const [editBeltRank, setEditBeltRank] = useState<string>('Black Belt (1st Dan+)');
  const [editGradingDate, setEditGradingDate] = useState<string>('');
  const [editDiscipline, setEditDiscipline] = useState<string>('Both (Kata & Kumite)');
  const [editCategory, setEditCategory] = useState<string>('');

  // Edit Parent / Guardian extended fields for Member
  const [editParentRelation, setEditParentRelation] = useState<string>('Legal Guardian');
  const [editParentIsEmergency, setEditParentIsEmergency] = useState<boolean>(true);
  const [editParentIsVolunteer, setEditParentIsVolunteer] = useState<boolean>(false);
  const [editParentConnectedAthletes, setEditParentConnectedAthletes] = useState<any[]>([]);
  const [editParentAthleteToLink, setEditParentAthleteToLink] = useState<string>('');
  const [editParentAthleteRelation, setEditParentAthleteRelation] = useState<string>('Child');

  // Open Edit Modal helper
  const openEditMemberModal = async (m: any) => {
    let targetMember = m;
    let linkedList: any[] = [];
    let existingParent: any = null;

    if (currentClubId?.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      const fullMember = store.getMemberById(m.id);
      if (fullMember) {
        targetMember = { ...fullMember, roles: m.roles || fullMember.roles };
      }

      existingParent = store.parentContacts.find(p => 
        p.id === targetMember.id || 
        (p.email && targetMember.email && p.email.toLowerCase() === targetMember.email.toLowerCase()) ||
        (p.contactNumber && targetMember.phone && p.contactNumber.replace(/\D/g, '') === targetMember.phone.replace(/\D/g, ''))
      );

      const rels = store.athleteGuardianRelationships.filter(r => 
        r.guardianContactId === targetMember.id || (existingParent && r.guardianContactId === existingParent.id)
      );

      const allMembersList = store.getMembers(currentClubId || '');
      linkedList = rels.map(r => {
        const ath = allMembersList.find(m2 => m2.id === r.athleteId);
        return {
          id: r.id,
          athleteId: r.athleteId,
          athleteName: ath ? ath.fullName : r.athleteId,
          relationship: r.relationship || 'Child',
          isEmergencyContact: r.isEmergencyContact ?? true,
        };
      });

      // Also check members who have targetMember as guardian
      allMembersList.forEach(m2 => {
        if ((m2.guardianId === targetMember.id || (existingParent && m2.guardianId === existingParent.id) || 
            (m2.guardianName && m2.guardianName.toLowerCase() === targetMember.fullName.toLowerCase())) &&
            !linkedList.some(item => item.athleteId === m2.id)) {
          linkedList.push({
            id: `link-${m2.id}`,
            athleteId: m2.id,
            athleteName: m2.fullName,
            relationship: (m2 as any).guardianRelation || m2.emergencyContactRelation || 'Child',
            isEmergencyContact: true,
          });
        }
      });
    }

    const hasParentRole = (targetMember.roles || []).includes('PARENT') || !!existingParent || linkedList.length > 0;
    const initialRoles = targetMember.roles && targetMember.roles.length > 0 ? [...targetMember.roles] : ['MEMBER'];
    if (hasParentRole && !initialRoles.includes('PARENT')) {
      initialRoles.push('PARENT');
    }

    setEditingMember(targetMember);
    setEditRoles(initialRoles);
    setEditBranchId(targetMember.branchId || '');
    setEditCoach(targetMember.assignedCoachName || 'Shihan Kannan');
    setEditBeltRank(targetMember.sportData?.beltRank || 'Brown Belt (1st Kyu)');
    setEditGradingDate(targetMember.sportData?.lastGradingDate || '');
    setEditDiscipline(getAthleteDiscipline(targetMember));
    setEditCategory(getAthleteCategory(targetMember));
    setEditParentRelation(existingParent?.relationship || 'Legal Guardian');
    setEditParentIsEmergency(true);
    setEditParentIsVolunteer(existingParent?.isVolunteerEligible ?? false);
    setEditParentConnectedAthletes(linkedList);
    setEditParentAthleteToLink('');
    setEditParentAthleteRelation('Child');
    setIsEditModalOpen(true);
  };

  // Edit Parent / Guardian Modal state & controlled fields
  const [isEditGuardianModalOpen, setIsEditGuardianModalOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<any>(null);
  const [editingGuardianRels, setEditingGuardianRels] = useState<any[]>([]);
  const [athleteToLink, setAthleteToLink] = useState<string>('');
  const [athleteRelationToLink, setAthleteRelationToLink] = useState<string>('Child');

  const openEditGuardianModal = (guardian: any) => {
    setEditingGuardian(guardian);
    const rels = guardianRelationships.filter(r => r.guardianContactId === guardian.id);
    let linkedList = rels.map(r => {
      const ath = members.find(m => m.id === r.athleteId);
      return {
        id: r.id,
        athleteId: r.athleteId,
        athleteName: ath ? ath.fullName : (guardian.linkedAthleteName || r.athleteId),
        relationship: r.relationship,
        isEmergencyContact: r.isEmergencyContact ?? true,
        isPrimaryContact: r.isPrimaryContact ?? true,
      };
    });

    if (guardian.linkedAthleteName && !linkedList.some(a => a.athleteName === guardian.linkedAthleteName)) {
      linkedList.push({
        id: `temp-${Date.now()}`,
        athleteId: guardian.linkedAthleteId || '',
        athleteName: guardian.linkedAthleteName,
        relationship: guardian.relationship || 'Guardian',
        isEmergencyContact: true,
        isPrimaryContact: true,
      });
    }

    setEditingGuardianRels(linkedList);
    setAthleteToLink('');
    setAthleteRelationToLink('Child');
    setIsEditGuardianModalOpen(true);
  };

  const handleSaveGuardian = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGuardian) return;
    const fd = new FormData(e.currentTarget);
    const fullName = fd.get('fullName') as string;
    const contactNumber = fd.get('contactNumber') as string;
    const email = fd.get('email') as string;
    const isVolunteer = fd.get('isVolunteerEligible') === 'on';

    const { store } = await import('@/lib/store');

    let guardianId = editingGuardian.id;

    if (guardianId.startsWith('vir-')) {
      const newContact = store.addParentContact({
        clubId: currentClubId,
        fullName,
        contactNumber,
        email: email || undefined,
        isVolunteerEligible: isVolunteer,
        volunteerCommunicationConsent: isVolunteer,
        volunteerInterests: isVolunteer ? ['Event Marshall'] : [],
        isActive: true,
        createdBy: currentUser?.fullName || 'SuperAdmin',
      }, currentUser?.fullName || 'SuperAdmin');
      guardianId = newContact.id;

      const memberId = editingGuardian.linkedAthleteId || editingGuardian.id.replace('vir-', '');
      const targetMember = store.getMemberById(memberId);
      if (targetMember) {
        store.updateMember(memberId, {
          emergencyContactName: fullName,
          emergencyContactPhone: contactNumber,
          guardianId: newContact.id,
          guardianName: fullName,
        }, currentUser?.fullName || 'SuperAdmin');
      }
    } else {
      store.updateParentContact(guardianId, {
        fullName,
        contactNumber,
        email: email || undefined,
        isVolunteerEligible: isVolunteer,
      }, currentUser?.fullName || 'SuperAdmin');
    }

    // Sync athlete connections in store
    const existingRels = store.athleteGuardianRelationships.filter(r => r.guardianContactId === guardianId);
    existingRels.forEach(r => {
      store.unlinkAthleteGuardian(r.athleteId, guardianId);
    });

    editingGuardianRels.forEach(rel => {
      if (rel.athleteId) {
        store.linkAthleteGuardian(rel.athleteId, guardianId, {
          relationship: rel.relationship,
          isEmergencyContact: rel.isEmergencyContact,
          isPrimaryContact: rel.isPrimaryContact,
        });

        const ath = store.getMemberById(rel.athleteId);
        if (ath) {
          store.updateMember(rel.athleteId, {
            guardianId,
            guardianName: fullName,
            emergencyContactName: rel.isEmergencyContact ? fullName : ath.emergencyContactName,
            emergencyContactPhone: rel.isEmergencyContact ? contactNumber : ath.emergencyContactPhone,
            emergencyContactRelation: rel.relationship,
          }, currentUser?.fullName || 'SuperAdmin');
        }
      }
    });

    setIsEditGuardianModalOpen(false);
    fetchParentsAndGuardians();
    fetchMembers();
  };

  const handleDeleteGuardian = async (guardian: any) => {
    if (!confirm(`Are you sure you want to delete ${guardian.fullName}? This will unlink all connected athletes.`)) {
      return;
    }

    const { store } = await import('@/lib/store');

    if (guardian.id.startsWith('vir-')) {
      const memberId = guardian.linkedAthleteId || guardian.id.replace('vir-', '');
      const targetMember = store.getMemberById(memberId);
      if (targetMember) {
        store.updateMember(memberId, {
          emergencyContactName: undefined,
          emergencyContactPhone: undefined,
          emergencyContactRelation: undefined,
          guardianId: undefined,
          guardianName: undefined,
        }, currentUser?.fullName || 'SuperAdmin');
      }
    } else {
      store.deleteParentContact(guardian.id, currentUser?.fullName || 'SuperAdmin');
    }

    fetchParentsAndGuardians();
    fetchMembers();
  };

  // Athletes dataset
  const athleteMembers = useMemo(() => {
    return members.filter(m => m.isAthlete || (m.roles && m.roles.includes('ATHLETE')));
  }, [members]);

  // Filtered members for Tab 1
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (m.fullName || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q) ||
        (m.icPassport || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
      const matchesRole = roleFilter === 'All' || (m.roles && m.roles.includes(roleFilter));
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [members, searchQuery, statusFilter, roleFilter]);

  // Filtered athletes for Tab 2
  const filteredAthletes = useMemo(() => {
    return athleteMembers.filter(a => {
      const q = athleteSearchQuery.toLowerCase();
      const discipline = getAthleteDiscipline(a);
      const category = getAthleteCategory(a);

      const matchesSearch =
        (a.fullName || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.assignedCoachName || '').toLowerCase().includes(q) ||
        (a.sportData?.beltRank || '').toLowerCase().includes(q) ||
        discipline.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q);

      const matchesDiscipline =
        disciplineFilter === 'All' ||
        discipline.toLowerCase().includes(disciplineFilter.toLowerCase());

      return matchesSearch && matchesDiscipline;
    });
  }, [athleteMembers, athleteSearchQuery, disciplineFilter, getAthleteDiscipline, getAthleteCategory]);

  // Filtered parents & guardians for Tab 3
  const filteredGuardians = useMemo(() => {
    return parentContacts.filter(c => {
      const q = guardianSearchQuery.toLowerCase();
      const linkedFromRel = guardianRelationships
        .filter(r => r.guardianContactId === c.id)
        .map(r => {
          const athlete = members.find(m => m.id === r.athleteId);
          return athlete ? athlete.fullName : '';
        })
        .join(' ');

      const matchesSearch =
        (c.fullName || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.contactNumber || '').toLowerCase().includes(q) ||
        (c.linkedAthleteName || '').toLowerCase().includes(q) ||
        linkedFromRel.toLowerCase().includes(q);

      const matchesVolunteer =
        guardianVolunteerFilter === 'All'
          ? true
          : guardianVolunteerFilter === 'Volunteer Eligible'
          ? c.isVolunteerEligible
          : !c.isVolunteerEligible;

      return matchesSearch && matchesVolunteer;
    });
  }, [parentContacts, guardianSearchQuery, guardianVolunteerFilter, guardianRelationships, members]);

  // Add Member Submit
  const handleAddMemberSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentClubId) return;

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const fullName = formData.get('fullName') as string;
    const icPassport = formData.get('icPassport') as string;
    const phone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const selectedRoles = (formData.getAll('roles') as string[]).filter(r => assignable.includes(r));

    // Sports and affiliation fields
    const branchIdToSave = operatorBranchId || (formData.get('selectedBranchId') as string) || newBranchId || branchId || undefined;
    const preferredDiscipline = (formData.get('preferredDiscipline') as string) || newDiscipline || 'Both (Kata & Kumite)';
    let competitionCategory = (formData.get('competitionCategory') as string) || newCategory || '';
    const beltRank = (formData.get('beltRank') as string) || newBeltRank || 'White Belt / Novice';
    const lastGradingDate = (formData.get('lastGradingDate') as string) || newGradingDate || undefined;
    const assignedCoachName = (formData.get('assignedCoachName') as string) || newCoach || 'Shihan Kannan';

    let competitionEvents: string[] = [];
    if (preferredDiscipline === 'Non-Active') {
      competitionEvents = [];
      competitionCategory = 'N/A (Non-Active)';
    } else if (preferredDiscipline.includes('Both')) {
      competitionEvents = ['Kata', 'Kumite'];
    } else if (preferredDiscipline.includes('Kumite')) {
      competitionEvents = ['Kumite'];
    } else if (preferredDiscipline.includes('Kata')) {
      competitionEvents = ['Kata'];
    }

    if (currentClubId.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      const newMember = store.addMember({
        clubId: currentClubId,
        branchId: branchIdToSave,
        email,
        fullName,
        icPassport,
        phone,
        address,
        roles: selectedRoles.length > 0 ? selectedRoles : ['MEMBER'],
        isAthlete: selectedRoles.includes('ATHLETE'),
        isVolunteer: selectedRoles.includes('VOLUNTEER'),
        gender: (formData.get('gender') as any) || 'Male',
        dob: (formData.get('dob') as string) || '2000-01-01',
        nationality: (formData.get('nationality') as string) || 'Malaysian',
        medicalNotes: (formData.get('medicalConditions') as string) || undefined,
        assignedCoachName,
        sportData: {
          weightKg: formData.get('weight') ? parseFloat(formData.get('weight') as string) : undefined,
          heightCm: formData.get('height') ? parseFloat(formData.get('height') as string) : undefined,
          preferredDiscipline,
          competitionCategory,
          beltRank,
          lastGradingDate,
          competitionEvents,
        },
      }, currentUser?.fullName || 'SUPERADMIN');
      
      // Process Parent/Guardian Links
      const linksJson = formData.get('guardianLinksJSON') as string;
      if (linksJson) {
        try {
          const parsedLinks = JSON.parse(linksJson);
          for (const link of parsedLinks) {
            let contactId = link.contact.id;
            if (link.isNewContact) {
              const newContact = store.addParentContact({
                clubId: currentClubId,
                fullName: link.contact.fullName,
                contactNumber: link.contact.contactNumber,
                email: link.contact.email,
                isVolunteerEligible: link.contact.isVolunteerEligible,
                volunteerCommunicationConsent: link.contact.volunteerCommunicationConsent
              }, currentUser?.fullName || 'SUPERADMIN');
              contactId = newContact.id;
            }
            store.linkAthleteGuardian(newMember.id, contactId, {
              relationship: link.relationshipData.relationship,
              relationshipDescription: link.relationshipData.relationshipDescription,
              isPrimaryContact: link.relationshipData.isPrimaryContact,
              isEmergencyContact: link.relationshipData.isEmergencyContact
            });
          }
        } catch (err) {
          console.error("Error processing guardian links", err);
        }
      }
      
      setIsAddModalOpen(false);
      setGuardianLinks([]);
      setSelectedNewRoles(['MEMBER']);
      await fetchMembers();
      await fetchParentsAndGuardians();
      return;
    }

    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: currentClubId,
          email,
          fullName,
          icPassport,
          phone,
          address,
          roles: selectedRoles,
          branchId: branchIdToSave || null,
          gender: formData.get('gender'),
          dob: formData.get('dob'),
          nationality: formData.get('nationality'),
          medicalNotes: formData.get('medicalConditions'),
          assignedCoachName,
          sportData: {
            weightKg: formData.get('weight') ? parseFloat(formData.get('weight') as string) : undefined,
            heightCm: formData.get('height') ? parseFloat(formData.get('height') as string) : undefined,
            preferredDiscipline,
            competitionCategory,
            beltRank,
            lastGradingDate,
            competitionEvents,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to add member');
      } else {
        setIsAddModalOpen(false);
        await fetchMembers();
      }
    } catch (err) {
      console.error(err);
      alert('Network error while adding member.');
    }
  };

  // Edit Member Submit
  const handleEditMemberSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMember) return;

    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string) || editingMember.email;
    const fullName = (formData.get('fullName') as string) || editingMember.fullName;
    const icPassport = (formData.get('icPassport') as string) || editingMember.icPassport || '';
    const phone = (formData.get('phone') as string) || editingMember.phone || '';
    const address = (formData.get('address') as string) || editingMember.address || '';
    const canManageAllRoles = activeRole === 'SUPERADMIN' || activeRole === 'SYSTEM_ADMIN' || activeRole === 'CLUB_ADMIN';
    const validRoles = canManageAllRoles 
      ? editRoles 
      : Array.from(new Set([
          ...(editingMember.roles || []).filter((r: string) => !assignable.includes(r)),
          ...editRoles.filter(r => assignable.includes(r))
        ]));
    const finalRoles = validRoles.length > 0 ? validRoles : ['MEMBER'];

    const gender = formData.get('gender') as any;
    const dob = formData.get('dob') as string;
    const nationality = formData.get('nationality') as string;
    const medicalNotes = formData.get('medicalConditions') as string;
    const weight = formData.get('weight') ? parseFloat(formData.get('weight') as string) : undefined;
    const height = formData.get('height') ? parseFloat(formData.get('height') as string) : undefined;

    // Dojo / Branch, Coach, Belt Rank, Grading Date, Discipline, Category
    const branchIdToSave = (formData.get('branchId') as string) !== undefined
      ? (formData.get('branchId') as string)
      : editBranchId;
    const assignedCoachName = (formData.get('assignedCoachName') as string) || editCoach || 'Shihan Kannan';
    const beltRank = (formData.get('beltRank') as string) || editBeltRank || 'Black Belt (1st Dan+)';
    const lastGradingDate = (formData.get('lastGradingDate') as string) || editGradingDate || undefined;
    const preferredDiscipline = (formData.get('preferredDiscipline') as string) || editDiscipline || 'Both (Kata & Kumite)';
    let competitionCategory = (formData.get('competitionCategory') as string) || editCategory || '';

    let competitionEvents: string[] = [];
    if (preferredDiscipline === 'Non-Active') {
      competitionEvents = [];
      competitionCategory = 'N/A (Non-Active)';
    } else if (preferredDiscipline.includes('Both')) {
      competitionEvents = ['Kata', 'Kumite'];
    } else if (preferredDiscipline.includes('Kumite')) {
      competitionEvents = ['Kumite'];
    } else if (preferredDiscipline.includes('Kata')) {
      competitionEvents = ['Kata'];
    }

    const updatedSportData = {
      ...(editingMember.sportData || {}),
      weightKg: weight !== undefined ? weight : editingMember.sportData?.weightKg,
      heightCm: height !== undefined ? height : editingMember.sportData?.heightCm,
      preferredDiscipline,
      competitionCategory,
      beltRank,
      lastGradingDate,
      competitionEvents,
    };

    // 1. Optimistic UI update
    setMembers(prev => prev.map(m => {
      if (m.id === editingMember.id || (editingMember.email && m.email && m.email.toLowerCase() === editingMember.email.toLowerCase())) {
        return {
          ...m,
          fullName,
          email,
          phone,
          icPassport,
          address,
          branchId: branchIdToSave || undefined,
          roles: finalRoles,
          isAthlete: finalRoles.includes('ATHLETE'),
          isVolunteer: finalRoles.includes('VOLUNTEER'),
          gender: gender || m.gender,
          dob: dob || m.dob,
          nationality: nationality || m.nationality,
          medicalNotes: medicalNotes !== undefined ? medicalNotes : m.medicalNotes,
          assignedCoachName,
          sportData: updatedSportData,
        };
      }
      return m;
    }));

    setIsEditModalOpen(false);

    // 2. Persist to Mock Store
    if (currentClubId?.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      store.updateMember(editingMember.id, {
        fullName,
        email,
        phone,
        icPassport,
        address,
        branchId: branchIdToSave || undefined,
        roles: finalRoles,
        isAthlete: finalRoles.includes('ATHLETE'),
        isVolunteer: finalRoles.includes('VOLUNTEER'),
        gender,
        dob,
        nationality,
        medicalNotes,
        assignedCoachName,
        sportData: updatedSportData,
      }, currentUser?.fullName || 'SUPERADMIN');

      // If PARENT role is assigned, sync ParentContact and AthleteGuardianRelationships
      if (finalRoles.includes('PARENT')) {
        let guardianContactId = editingMember.id;
        const existingParent = store.parentContacts.find(p => 
          p.id === editingMember.id || 
          (p.email && email && p.email.toLowerCase() === email.toLowerCase()) ||
          (p.contactNumber && phone && p.contactNumber.replace(/\D/g, '') === phone.replace(/\D/g, ''))
        );

        if (existingParent) {
          guardianContactId = existingParent.id;
          store.updateParentContact(existingParent.id, {
            fullName,
            contactNumber: phone,
            email,
            isVolunteerEligible: editParentIsVolunteer,
          }, currentUser?.fullName || 'SuperAdmin');
        } else {
          const newP = store.addParentContact({
            id: `parent-${editingMember.id}`,
            clubId: currentClubId,
            fullName,
            contactNumber: phone,
            email,
            isVolunteerEligible: editParentIsVolunteer,
          }, currentUser?.fullName || 'SuperAdmin');
          guardianContactId = newP.id;
        }

        // Sync athlete relationships
        const currentRels = store.athleteGuardianRelationships.filter(r => r.guardianContactId === guardianContactId);
        
        // Remove unlinked
        for (const rel of currentRels) {
          if (!editParentConnectedAthletes.some(a => a.athleteId === rel.athleteId)) {
            store.unlinkAthleteGuardian(rel.athleteId, guardianContactId);
          }
        }
        
        // Add new links
        for (const conn of editParentConnectedAthletes) {
          const alreadyLinked = store.athleteGuardianRelationships.some(r => r.guardianContactId === guardianContactId && r.athleteId === conn.athleteId);
          if (!alreadyLinked) {
            store.linkAthleteGuardian(conn.athleteId, guardianContactId, {
              relationship: conn.relationship,
              isEmergencyContact: conn.isEmergencyContact,
              isPrimaryContact: true
            });
          }
        }
      }

      await fetchParentsAndGuardians();
    } else {
      // 3. Persist to Supabase
      try {
        await supabase.from('profiles').update({
          full_name: fullName,
          phone,
          address,
        }).eq('id', editingMember.id);
      } catch (err) {
        console.error(err);
      }
    }

    await fetchMembers();
  };

  // Delete Member
  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to delete this member from the roster?')) return;
    
    // 1. Optimistic UI update
    const targetMember = members.find(m => m.id === memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId && (!targetMember?.email || m.email?.toLowerCase() !== targetMember.email.toLowerCase())));

    if (currentClubId?.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      store.deleteMember(memberId, currentUser?.fullName || 'SUPERADMIN', currentClubId);
      await fetchMembers();
      return;
    }

    try {
      await supabase.from('club_members').delete().eq('user_id', memberId);
      await supabase.from('user_role_assignments').delete().eq('user_id', memberId);
      await fetchMembers();
    } catch (err) {
      console.error('Error deleting member:', err);
    }
  };

  // Add Parent/Guardian Submit
  const handleAddGuardianSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentClubId) return;

    const fd = new FormData(e.currentTarget);
    const fullName = (fd.get('fullName') as string)?.trim();
    const contactNumber = (fd.get('contactNumber') as string)?.trim();
    const email = (fd.get('email') as string)?.trim() || undefined;
    const relationship = (fd.get('relationship') as GuardianRelationshipType) || 'Parent';
    const athleteId = fd.get('athleteId') as string;
    const isEmergencyContact = fd.get('isEmergencyContact') === 'on';
    const isPrimaryContact = fd.get('isPrimaryContact') === 'on';
    const isVolunteerEligible = fd.get('isVolunteerEligible') === 'on';
    const volunteerCommunicationConsent = fd.get('volunteerConsent') === 'on';
    const availabilityNotes = (fd.get('availabilityNotes') as string)?.trim() || '';

    if (!fullName || !contactNumber) {
      setGuardianFeedback('Please provide both the guardian full name and contact number.');
      return;
    }

    try {
      const { store } = await import('@/lib/store');
      const newContact = store.addParentContact({
        clubId: currentClubId,
        fullName,
        contactNumber,
        email,
        isVolunteerEligible,
        volunteerCommunicationConsent,
        availabilityNotes,
      }, currentUser?.fullName || 'SUPERADMIN');

      if (athleteId && athleteId !== 'none') {
        store.linkAthleteGuardian(athleteId, newContact.id, {
          relationship,
          isPrimaryContact,
          isEmergencyContact,
        });
      }

      setIsAddGuardianModalOpen(false);
      setGuardianFeedback(null);
      await fetchParentsAndGuardians();
    } catch (err) {
      console.error('Error adding guardian:', err);
      setGuardianFeedback('Failed to save parent contact.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#0284C7] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading Members & Athletes Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
            <Users size={14} />
            <span>Membership & Athletes Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Members & Athletes Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Unified roster, athletic sports profiles, parent/guardian registry, and data exchange.
          </p>
        </div>

        {(activeRole === 'SUPERADMIN' || activeRole === 'CLUB_ADMIN' || activeRole === 'BRANCH_MANAGER') && (
          <div className="flex items-center space-x-2">
            {activeTab === 'guardians' ? (
              <button
                onClick={() => setIsAddGuardianModalOpen(true)}
                className="py-2.5 px-5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5"
              >
                <UserPlus size={16} />
                <span>Add Guardian</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedNewRoles(['MEMBER']);
                  setNewDiscipline('Both (Kata & Kumite)');
                  setNewCategory('');
                  setNewBeltRank('White Belt / Novice');
                  setNewCoach('Shihan Kannan');
                  setNewBranchId('');
                  setNewGradingDate('');
                  setIsAddModalOpen(true);
                }}
                className="py-2.5 px-5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5"
              >
                <Plus size={16} />
                <span>Add Member</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users size={15} />
          <span>All Members ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('athletes')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'athletes'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trophy size={15} />
          <span>Athletes Roster ({athleteMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('guardians')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'guardians'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <HeartHandshake size={15} />
          <span>Parents & Guardians ({parentContacts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('data-management')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'data-management'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database size={15} />
          <span>Data Management Center</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: ALL MEMBERS                                                  */}
      {/* =================================================================== */}
      {activeTab === 'all' && (
        <div className="space-y-5 animate-fade-in">
          {/* Quick Stat Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Roster</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{members.length}</span>
              <span className="text-[11px] text-slate-400">Club Registered</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Active Status</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {members.filter(m => m.status === 'Active').length}
              </span>
              <span className="text-[11px] text-slate-400">In Good Standing</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Athletes</span>
              <span className="text-2xl font-black text-[#0284C7] mt-1 block">
                {athleteMembers.length}
              </span>
              <span className="text-[11px] text-slate-400">Competitive & Training</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Coaches & Staff</span>
              <span className="text-2xl font-black text-purple-600 mt-1 block">
                {members.filter(m => m.roles?.some((r: string) => ['COACH', 'BRANCH_MANAGER', 'CLUB_ADMIN'].includes(r))).length}
              </span>
              <span className="text-[11px] text-slate-400">Instructional & Leadership</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by name, email, phone, IC/passport..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
              />
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5">
                <Filter size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-600">Role:</span>
              </div>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7]"
              >
                <option value="All">All Roles</option>
                <option value="MEMBER">Member</option>
                <option value="ATHLETE">Athlete</option>
                <option value="PARENT">Parent / Guardian</option>
                <option value="COACH">Coach</option>
                <option value="VOLUNTEER">Volunteer</option>
                <option value="BRANCH_MANAGER">Branch Manager</option>
                <option value="CLUB_ADMIN">Club Admin</option>
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7]"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Full Name & Contact</th>
                    <th className="py-3 px-4">Dojo / Branch</th>
                    <th className="py-3 px-4">Assigned Roles</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-bold text-sm">No members found</p>
                        <p className="text-xs mt-1">Try adjusting your search criteria or add a new member.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m, idx) => (
                      <tr key={`${m.id}-${idx}`} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-sky-600 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
                              {(m.fullName || 'M')[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 block leading-tight">{m.fullName || 'No Name'}</span>
                              <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                                <span>{m.email}</span>
                                {m.phone && (
                                  <>
                                    <span>•</span>
                                    <span>{m.phone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <span className="font-medium text-slate-700 block">{getBranchName(m.branchId)}</span>
                          {m.icPassport && (
                            <span className="text-[10px] text-slate-400 font-mono">IC: {m.icPassport}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(m.roles || ['MEMBER']).map((role: string, rIdx: number) => {
                              const isCoach = role === 'COACH';
                              const isAdmin = role === 'CLUB_ADMIN' || role === 'BRANCH_MANAGER';
                              const isAthlete = role === 'ATHLETE';
                              const isParent = role === 'PARENT';
                              return (
                                <span
                                  key={`${role}-${rIdx}`}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isAdmin
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : isCoach
                                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                      : isAthlete
                                      ? 'bg-sky-50 text-[#0284C7] border border-sky-200'
                                      : isParent
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {role === 'PARENT' ? 'Parent / Guardian' : role}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            m.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {m.status || 'Active'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {(activeRole === 'SUPERADMIN' || activeRole === 'CLUB_ADMIN' || activeRole === 'BRANCH_MANAGER') && (
                            <div className="flex items-center justify-end space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditMemberModal(m)}
                                className="p-1.5 text-slate-400 hover:text-[#0284C7] hover:bg-sky-50 rounded-lg transition-colors"
                                title="Edit Member Profile & Roles"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteMember(m.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Member"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: ATHLETES ROSTER                                              */}
      {/* =================================================================== */}
      {activeTab === 'athletes' && (
        <div className="space-y-5 animate-fade-in">
          {/* Athlete Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Athletes</span>
                <Trophy size={16} className="text-[#0284C7]" />
              </div>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{athleteMembers.length}</span>
              <span className="text-[11px] text-slate-400">Competitive & Grading Pool</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kumite (Combat)</span>
                <Flame size={16} className="text-amber-500" />
              </div>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                {athleteMembers.filter(a => {
                  const d = getAthleteDiscipline(a);
                  return d.includes('Kumite');
                }).length}
              </span>
              <span className="text-[11px] text-slate-400">Combat Category Active</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kata (Forms)</span>
                <Award size={16} className="text-emerald-500" />
              </div>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {athleteMembers.filter(a => {
                  const d = getAthleteDiscipline(a);
                  return d.includes('Kata');
                }).length}
              </span>
              <span className="text-[11px] text-slate-400">Forms & Precision Active</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Black Belts (Dan)</span>
                <ShieldCheck size={16} className="text-indigo-600" />
              </div>
              <span className="text-2xl font-black text-indigo-700 mt-1 block">
                {athleteMembers.filter(a => a.sportData?.beltRank?.toLowerCase().includes('black')).length}
              </span>
              <span className="text-[11px] text-slate-400">Elite Senior Ranks</span>
            </div>
          </div>

          {/* Athletes Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search athlete by name, category, coach, belt grade, email..."
                value={athleteSearchQuery}
                onChange={e => setAthleteSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
              />
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5">
                <Filter size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-600">Discipline:</span>
              </div>
              <select
                value={disciplineFilter}
                onChange={e => setDisciplineFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7]"
              >
                <option value="All">All Disciplines</option>
                <option value="Kumite">Kumite Only</option>
                <option value="Kata">Kata Only</option>
                <option value="Both">Both (Kata & Kumite)</option>
                <option value="Non-Active">Non-Active</option>
              </select>
            </div>
          </div>

          {/* Athletes Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Athlete & Bio</th>
                    <th className="py-3 px-4">Belt Rank</th>
                    <th className="py-3 px-4">Discipline & Category</th>
                    <th className="py-3 px-4">Weigh-in & Height</th>
                    <th className="py-3 px-4">Coach & Dojo</th>
                    <th className="py-3 px-4">KT 3.0 Ready</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAthletes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Trophy size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-bold text-sm">No athletes found</p>
                        <p className="text-xs mt-1">Assign the "ATHLETE" role to members or register a new athlete.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAthletes.map((a, idx) => {
                      const belt = a.sportData?.beltRank || 'Novice / White';
                      const isBlackBelt = belt.toLowerCase().includes('black');
                      const isBrownBelt = belt.toLowerCase().includes('brown');
                      const weight = a.sportData?.weightKg;
                      const height = a.sportData?.heightCm;
                      const discipline = getAthleteDiscipline(a);
                      const category = getAthleteCategory(a);

                      return (
                        <tr key={`${a.id}-${idx}`} className="group hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#0284C7] font-black flex items-center justify-center text-xs shrink-0 border border-sky-200">
                                {(a.fullName || 'A')[0].toUpperCase()}
                              </div>
                              <div>
                                <span className="font-black text-slate-900 block leading-tight">{a.fullName}</span>
                                <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5">
                                  <span>{a.gender || 'Athlete'}</span>
                                  <span>•</span>
                                  <span>DOB: {a.dob || '—'}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold ${
                              isBlackBelt
                                ? 'bg-slate-900 text-amber-300 border border-slate-700 shadow-xs'
                                : isBrownBelt
                                ? 'bg-amber-900/10 text-amber-900 border border-amber-900/20'
                                : 'bg-sky-50 text-[#0284C7] border border-sky-200'
                            }`}>
                              {belt}
                            </span>
                            {a.sportData?.lastGradingDate && (
                              <span className="block text-[10px] text-slate-400 mt-0.5">
                                Graded: {a.sportData.lastGradingDate}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div>
                                {discipline === 'Non-Active' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
                                    <span>Non-Active</span>
                                  </span>
                                ) : discipline === 'Kumite Only' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Flame size={10} className="mr-1 text-amber-600" />
                                    <span>Kumite Only</span>
                                  </span>
                                ) : discipline === 'Kata Only' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <Award size={10} className="mr-1 text-emerald-600" />
                                    <span>Kata Only</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                    <Sparkles size={10} className="mr-1 text-indigo-600" />
                                    <span>Both (Kata & Kumite)</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-semibold text-slate-700 block">
                                {category}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-1 text-slate-700 font-bold">
                                <Scale size={12} className="text-slate-400" />
                                <span>{weight ? `${weight} kg` : 'Unweighed'}</span>
                              </div>
                              <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                                <Ruler size={12} className="text-slate-400" />
                                <span>{height ? `${height} cm` : '—'}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-800 block">
                              {a.assignedCoachName || 'Unassigned Coach'}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                              <GitBranch size={10} />
                              <span>{getBranchName(a.branchId)}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-[#0284C7] border border-sky-200 space-x-1">
                              <ShieldCheck size={11} />
                              <span>KT 3.0 Synced</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditMemberModal(a)}
                                className="p-1.5 text-slate-400 hover:text-[#0284C7] hover:bg-sky-50 rounded-lg transition-colors"
                                title="Edit Athlete Profile & Sports Data"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteMember(a.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Athlete"
                              >
                                <Trash2 size={15} />
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
      {/* TAB 3: PARENTS & GUARDIANS                                          */}
      {/* =================================================================== */}
      {activeTab === 'guardians' && (
        <div className="space-y-5 animate-fade-in">
          {/* Guardian Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Registered</span>
                <HeartHandshake size={16} className="text-[#0284C7]" />
              </div>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{parentContacts.length}</span>
              <span className="text-[11px] text-slate-400">Parents & Guardians on Record</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Emergency Contacts</span>
                <Shield size={16} className="text-red-500" />
              </div>
              <span className="text-2xl font-black text-red-600 mt-1 block">
                {parentContacts.filter(c => c.isEmergencyContact || c.isEmergencyOnly || guardianRelationships.some(r => r.guardianContactId === c.id && r.isEmergencyContact)).length}
              </span>
              <span className="text-[11px] text-slate-400">Priority Medical / Contact List</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Volunteer Eligible</span>
                <UserCheck size={16} className="text-emerald-500" />
              </div>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {parentContacts.filter(c => c.isVolunteerEligible).length}
              </span>
              <span className="text-[11px] text-slate-400">Consented & Available</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by guardian name, phone, email, or linked athlete..."
                value={guardianSearchQuery}
                onChange={e => setGuardianSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
              />
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5">
                <Filter size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-600">Volunteer Filter:</span>
              </div>
              <select
                value={guardianVolunteerFilter}
                onChange={e => setGuardianVolunteerFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7]"
              >
                <option value="All">All Guardians</option>
                <option value="Volunteer Eligible">Volunteer Eligible Only</option>
                <option value="Non-Volunteer">Non-Volunteer Only</option>
              </select>
            </div>
          </div>

          {/* Guardians Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Parent / Guardian</th>
                    <th className="py-3 px-4">Contact Details</th>
                    <th className="py-3 px-4">Relationship & Emergency</th>
                    <th className="py-3 px-4">Linked Athletes / Wards</th>
                    <th className="py-3 px-4">Volunteer Engagement</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGuardians.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <HeartHandshake size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-bold text-sm">No parent contacts found</p>
                        <p className="text-xs mt-1">Click "Add Guardian" above to register a parent or emergency contact.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredGuardians.map((c, idx) => {
                      // Determine linked athletes
                      const rels = guardianRelationships.filter(r => r.guardianContactId === c.id);
                      const linkedAthletes = rels.map(r => {
                        const ath = members.find(m => m.id === r.athleteId);
                        return { name: ath?.fullName || r.athleteId, rel: r.relationship, isEmerg: r.isEmergencyContact };
                      });
                      if (c.linkedAthleteName && !linkedAthletes.some(a => a.name === c.linkedAthleteName)) {
                        linkedAthletes.push({ name: c.linkedAthleteName, rel: c.relationship || 'Guardian', isEmerg: true });
                      }

                      const isEmergency = c.isEmergencyOnly || c.isEmergencyContact || rels.some(r => r.isEmergencyContact);

                      return (
                        <tr key={`${c.id}-${idx}`} className="group hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-xs shrink-0 border border-emerald-200">
                                {(c.fullName || 'P')[0].toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block leading-tight">{c.fullName}</span>
                                <span className="text-[10px] font-mono text-slate-400">{c.id}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <a
                                href={`tel:${c.contactNumber}`}
                                className="flex items-center space-x-1.5 font-semibold text-slate-700 hover:text-[#0284C7]"
                              >
                                <Phone size={11} className="text-slate-400" />
                                <span>{c.contactNumber}</span>
                              </a>
                              {c.email ? (
                                <a
                                  href={`mailto:${c.email}`}
                                  className="flex items-center space-x-1.5 text-[11px] text-slate-400 hover:text-[#0284C7]"
                                >
                                  <Mail size={11} />
                                  <span>{c.email}</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-400">No email registered</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {c.relationship || (rels[0]?.relationship) || 'Parent / Guardian'}
                              </span>
                              {isEmergency && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 space-x-1">
                                  <Shield size={10} />
                                  <span>Emergency</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {linkedAthletes.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {linkedAthletes.map((ath, aIdx) => (
                                  <span
                                    key={aIdx}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-[#0284C7] border border-sky-200"
                                  >
                                    <Trophy size={10} className="mr-1" />
                                    <span>{ath.name}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No linked athlete</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {c.isVolunteerEligible ? (
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 space-x-1">
                                  <Check size={10} />
                                  <span>Volunteer Consented</span>
                                </span>
                                {c.volunteerInterests && c.volunteerInterests.length > 0 && (
                                  <span className="block text-[10px] text-slate-400 mt-0.5">
                                    {c.volunteerInterests.join(', ')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                Contact Only
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditGuardianModal(c)}
                                className="p-1.5 text-slate-400 hover:text-[#0284C7] hover:bg-sky-50 rounded-lg transition-colors"
                                title="Edit Guardian & Athlete Connections"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteGuardian(c)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Guardian"
                              >
                                <Trash2 size={15} />
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
      {/* TAB 4: DATA MANAGEMENT CENTER                                       */}
      {/* =================================================================== */}
      {activeTab === 'data-management' && (
        <div className="animate-fade-in">
          <DataManagementCenter
            clubId={currentClubId}
            branchId={currentBranchId === '__ALL__' ? undefined : currentBranchId}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* ADD GUARDIAN MODAL                                                  */}
      {/* =================================================================== */}
      {isAddGuardianModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Add Parent / Guardian</h3>
                <p className="text-xs text-slate-500">Register a guardian contact and link to club athletes.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddGuardianModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {guardianFeedback && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {guardianFeedback}
              </div>
            )}

            <form onSubmit={handleAddGuardianSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Guardian Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  required
                  placeholder="e.g. Tan Kok Wai"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contact Phone *</label>
                  <input
                    type="tel"
                    name="contactNumber"
                    required
                    placeholder="+6012-3456789"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Relationship</label>
                  <select
                    name="relationship"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0284C7]"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="parent@example.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0284C7]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Link to Athlete</label>
                <select
                  name="athleteId"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0284C7]"
                >
                  <option value="none">-- Select Athlete (Optional) --</option>
                  {athleteMembers.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.fullName} ({a.sportData?.beltRank || 'Athlete'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" name="isEmergencyContact" defaultChecked className="rounded text-[#0284C7] focus:ring-[#0284C7]" />
                  <span>Designate as Emergency Contact</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" name="isPrimaryContact" defaultChecked className="rounded text-[#0284C7] focus:ring-[#0284C7]" />
                  <span>Primary Guardian Contact</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" name="isVolunteerEligible" className="rounded text-[#0284C7] focus:ring-[#0284C7]" />
                  <span>Willing to volunteer during club events & tournaments</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" name="volunteerConsent" className="rounded text-[#0284C7] focus:ring-[#0284C7]" />
                  <span>Consent to receive volunteer notifications</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddGuardianModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Save Guardian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* ADD MEMBER MODAL                                                    */}
      {/* =================================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Add Club Member</h3>
                <p className="text-xs text-slate-500">Register a new member, athlete, coach, or official.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  required
                  placeholder="e.g. Chloe Tan"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] focus:ring-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="chloe@example.com"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] focus:ring-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="+6012-3456789"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] focus:ring-[#0284C7]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">IC / Passport *</label>
                  <input
                    type="text"
                    name="icPassport"
                    required
                    placeholder="040922-10-8888"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] focus:ring-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Gender</label>
                  <select
                    name="gender"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] focus:ring-[#0284C7]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    defaultValue="2004-09-22"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] focus:ring-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nationality</label>
                  <input
                    type="text"
                    name="nationality"
                    defaultValue="Malaysian"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] focus:ring-[#0284C7]"
                  />
                </div>
              </div>

              {/* Coach & Dojo Affiliation Section */}
              <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#0284C7] uppercase flex items-center space-x-1.5">
                    <GitBranch size={14} />
                    <span>Coach & Dojo Affiliation</span>
                  </span>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                    Branch Assignment
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Assigned Dojo / Branch *
                    </label>
                    <select
                      name="selectedBranchId"
                      value={newBranchId}
                      onChange={e => setNewBranchId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-semibold text-slate-800"
                    >
                      <option value="">-- Main Honbu Dojo --</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Assigned Coach / Sensei *
                    </label>
                    <select
                      name="assignedCoachName"
                      value={newCoach}
                      onChange={e => setNewCoach(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-semibold text-slate-800"
                    >
                      <option value="Shihan Kannan">Shihan Kannan (Chief Instructor)</option>
                      <option value="Sensei Mohan">Sensei Mohan (Senior Coach)</option>
                      <option value="Sensei Bala">Sensei Bala (Branch Instructor)</option>
                      <option value="Coach Razak">Coach Razak</option>
                      <option value="Coach Lee Wei">Coach Lee Wei</option>
                      <option value="Unassigned Coach">Unassigned Coach</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Address</label>
                <input
                  type="text"
                  name="address"
                  placeholder="Street, City, State"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] focus:ring-[#0284C7]"
                />
              </div>

              {/* Roles selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Member Roles</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {roleOptions.map(r => (
                    <label
                      key={r.val}
                      className="flex items-center space-x-2 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="roles"
                        value={r.val}
                        checked={selectedNewRoles.includes(r.val)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedNewRoles(prev => [...prev, r.val]);
                          } else {
                            setSelectedNewRoles(prev => prev.filter(x => x !== r.val));
                          }
                        }}
                        className="rounded text-[#0284C7] focus:ring-[#0284C7]"
                      />
                      <span className="text-xs font-bold text-slate-700">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sports details section when role ATHLETE is selected */}
              {selectedNewRoles.includes('ATHLETE') && (
                <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-800 uppercase flex items-center space-x-1.5">
                      <Award size={14} className="text-amber-600" />
                      <span>Belt Rank, Discipline & Sports Profile</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      KT 3.0 Compatible
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Belt Rank & Grade *
                      </label>
                      <select
                        name="beltRank"
                        value={newBeltRank}
                        onChange={e => setNewBeltRank(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-bold text-slate-900"
                      >
                        <option value="Black Belt (1st Dan+)">Black Belt (1st Dan+)</option>
                        <option value="Black Belt (2nd Dan+)">Black Belt (2nd Dan+)</option>
                        <option value="Brown Belt (1st Kyu)">Brown Belt (1st Kyu)</option>
                        <option value="Brown Belt (2nd Kyu)">Brown Belt (2nd Kyu)</option>
                        <option value="Brown Belt (3rd Kyu)">Brown Belt (3rd Kyu)</option>
                        <option value="Brown Belt (4th-1st Kyu)">Brown Belt (4th-1st Kyu)</option>
                        <option value="Green Belt (7th Kyu)">Green Belt (7th Kyu)</option>
                        <option value="Green Belt (5th-6th Kyu)">Green Belt (5th-6th Kyu)</option>
                        <option value="Blue Belt (6th Kyu)">Blue Belt (6th Kyu)</option>
                        <option value="Yellow Belt (8th Kyu)">Yellow Belt (8th Kyu)</option>
                        <option value="White Belt / Novice">White Belt / Novice</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Last Belt Grading Date
                      </label>
                      <input
                        type="date"
                        name="lastGradingDate"
                        value={newGradingDate}
                        onChange={e => setNewGradingDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Discipline *</label>
                      <select
                        name="preferredDiscipline"
                        value={newDiscipline}
                        onChange={e => {
                          const val = e.target.value;
                          setNewDiscipline(val);
                          if (val === 'Non-Active') {
                            setNewCategory('N/A (Non-Active)');
                          } else {
                            if (!newCategory || newCategory === 'N/A (Non-Active)' || newCategory.includes('Kata') || newCategory.includes('Kumite')) {
                              if (val === 'Kata Only') setNewCategory('Senior Individual Kata');
                              else if (val === 'Kumite Only') setNewCategory('Senior Kumite -67kg');
                              else setNewCategory('Senior Kata & Kumite -67kg');
                            }
                          }
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-semibold text-slate-800"
                      >
                        <option value="Both (Kata & Kumite)">Both (Kata & Kumite)</option>
                        <option value="Kumite Only">Kumite Only</option>
                        <option value="Kata Only">Kata Only</option>
                        <option value="Non-Active">Non-Active (Not Competing)</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-slate-700 uppercase">Competition Category / Division</label>
                        {newDiscipline === 'Non-Active' && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Non-Active</span>
                        )}
                      </div>
                      <input
                        type="text"
                        name="competitionCategory"
                        value={newDiscipline === 'Non-Active' ? 'N/A (Non-Active)' : newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        disabled={newDiscipline === 'Non-Active'}
                        list="karateCategoriesNew"
                        placeholder={newDiscipline === 'Non-Active' ? 'Disabled (Non-Active)' : 'e.g. Male Senior Kumite -67kg'}
                        className={`w-full px-3 py-2 text-xs rounded-xl font-semibold border ${
                          newDiscipline === 'Non-Active'
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed select-none'
                            : 'bg-white border-slate-200 text-slate-900 focus:border-[#0284C7]'
                        }`}
                      />
                      <datalist id="karateCategoriesNew">
                        <option value="Male Kumite -60kg (18+)" />
                        <option value="Male Kumite -67kg (18+)" />
                        <option value="Male Kumite -75kg (18+)" />
                        <option value="Male Kumite -84kg (18+)" />
                        <option value="Male Kumite +84kg (18+)" />
                        <option value="Female Kumite -50kg (18+)" />
                        <option value="Female Kumite -55kg (18+)" />
                        <option value="Female Kumite -61kg (18+)" />
                        <option value="Female Kumite +68kg (18+)" />
                        <option value="Male Senior Individual Kata" />
                        <option value="Female Senior Individual Kata" />
                        <option value="Junior Male Kumite -55kg (16-17)" />
                        <option value="Junior Male Kumite -61kg (16-17)" />
                        <option value="Junior Female Kumite -48kg (16-17)" />
                        <option value="Cadet Male Kumite -57kg" />
                        <option value="Cadet Female Kumite -54kg" />
                        <option value="Male Cadet Individual Kata" />
                        <option value="Female Cadet Individual Kata" />
                        <option value="U-14 Individual Kata" />
                      </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Weight (kg)</label>
                      <input type="number" step="0.1" name="weight" placeholder="e.g. 52.0" className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Height (cm)</label>
                      <input type="number" step="0.1" name="height" placeholder="e.g. 161" className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl" />
                    </div>
                  </div>
                </div>
              )}

              {/* Parent / Guardian section for Athletes & Parents */}
              {currentClubId && (selectedNewRoles.includes('PARENT') || selectedNewRoles.includes('ATHLETE')) && (
                <ParentGuardianDetails
                  clubId={currentClubId}
                  guardianLinks={guardianLinks}
                  setGuardianLinks={setGuardianLinks}
                />
              )}
              <input type="hidden" name="guardianLinksJSON" value={JSON.stringify(guardianLinks)} />

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Register Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* EDIT MEMBER MODAL                                                   */}
      {/* =================================================================== */}
      {isEditModalOpen && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Edit Member Profile</h3>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="font-mono text-[11px] text-[#0284C7]">ID: {editingMember.id}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] font-semibold text-slate-500">{editingMember.fullName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditMemberSubmit} className="space-y-4">
              {/* 1. Basic Bio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  defaultValue={editingMember.fullName || ''}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingMember.email || ''}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={editingMember.phone || ''}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">IC / Passport</label>
                  <input
                    type="text"
                    name="icPassport"
                    defaultValue={editingMember.icPassport || ''}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Gender</label>
                  <select
                    name="gender"
                    defaultValue={editingMember.gender || 'Male'}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              {/* 2. Coach & Dojo Affiliation Section */}
              <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#0284C7] uppercase flex items-center space-x-1.5">
                    <GitBranch size={14} />
                    <span>Coach & Dojo Affiliation</span>
                  </span>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                    Branch Assignment
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Assigned Dojo / Branch *
                    </label>
                    <select
                      name="branchId"
                      value={editBranchId}
                      onChange={e => setEditBranchId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-semibold text-slate-800"
                    >
                      <option value="">-- Main Honbu Dojo --</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Assigned Coach / Sensei *
                    </label>
                    <select
                      name="assignedCoachName"
                      value={editCoach}
                      onChange={e => setEditCoach(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-semibold text-slate-800"
                    >
                      <option value="Shihan Kannan">Shihan Kannan (Chief Instructor)</option>
                      <option value="Sensei Mohan">Sensei Mohan (Senior Coach)</option>
                      <option value="Sensei Bala">Sensei Bala (Branch Instructor)</option>
                      <option value="Coach Razak">Coach Razak</option>
                      <option value="Coach Lee Wei">Coach Lee Wei</option>
                      <option value="Unassigned Coach">Unassigned Coach</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Roles Management */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Assigned Roles</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {roleOptions.map(r => (
                    <label
                      key={r.val}
                      className="flex items-center space-x-2 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={editRoles.includes(r.val)}
                        onChange={e => {
                          if (e.target.checked) {
                            setEditRoles(prev => [...prev, r.val]);
                          } else {
                            setEditRoles(prev => prev.filter(x => x !== r.val));
                          }
                        }}
                        className="rounded text-[#0284C7] focus:ring-[#0284C7]"
                      />
                      <span className="text-xs font-bold text-slate-700">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 4. Belt Rank, Discipline & Sports Details (Conditional on ATHLETE role) */}
              {editRoles.includes('ATHLETE') && (
                <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-100 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-800 uppercase flex items-center space-x-1.5">
                      <Award size={14} className="text-amber-600" />
                      <span>Belt Rank, Discipline & Weigh-In</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      Martial Arts Profile
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Belt Rank & Grade *
                      </label>
                      <select
                        name="beltRank"
                        value={editBeltRank}
                        onChange={e => setEditBeltRank(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-bold text-slate-900"
                      >
                        <option value="Black Belt (1st Dan+)">Black Belt (1st Dan+)</option>
                        <option value="Black Belt (2nd Dan+)">Black Belt (2nd Dan+)</option>
                        <option value="Black Belt (3rd Dan+)">Black Belt (3rd Dan+)</option>
                        <option value="Brown Belt (1st Kyu)">Brown Belt (1st Kyu)</option>
                        <option value="Brown Belt (2nd Kyu)">Brown Belt (2nd Kyu)</option>
                        <option value="Brown Belt (3rd Kyu)">Brown Belt (3rd Kyu)</option>
                        <option value="Brown Belt (4th-1st Kyu)">Brown Belt (4th-1st Kyu)</option>
                        <option value="Green Belt (7th Kyu)">Green Belt (7th Kyu)</option>
                        <option value="Green Belt (5th-6th Kyu)">Green Belt (5th-6th Kyu)</option>
                        <option value="Blue Belt (6th Kyu)">Blue Belt (6th Kyu)</option>
                        <option value="Yellow Belt (8th Kyu)">Yellow Belt (8th Kyu)</option>
                        <option value="White Belt / Novice">White Belt / Novice</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Last Belt Grading Date
                      </label>
                      <input
                        type="date"
                        name="lastGradingDate"
                        value={editGradingDate}
                        onChange={e => setEditGradingDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Discipline *</label>
                      <select
                        name="preferredDiscipline"
                        value={editDiscipline}
                        onChange={e => {
                          const val = e.target.value;
                          setEditDiscipline(val);
                          if (val === 'Non-Active') {
                            setEditCategory('N/A (Non-Active)');
                          } else {
                            // Suggest appropriate category
                            const isFemale = (editingMember.gender || 'Male').toLowerCase() === 'female';
                            const w = editingMember.sportData?.weightKg;
                            if (val === 'Kata Only') {
                              setEditCategory(`${isFemale ? 'Female' : 'Male'} Senior Individual Kata`);
                            } else if (val === 'Kumite Only') {
                              setEditCategory(`${isFemale ? 'Female' : 'Male'} Senior Kumite ${w ? (w <= 60 ? '-60kg' : w <= 67 ? '-67kg' : w <= 75 ? '-75kg' : '+75kg') : 'Open Weight'}`);
                            } else {
                              setEditCategory(`${isFemale ? 'Female' : 'Male'} Senior Kata & Kumite ${w ? (w <= 60 ? '-60kg' : w <= 67 ? '-67kg' : w <= 75 ? '-75kg' : '+75kg') : 'Open Weight'}`);
                            }
                          }
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7] font-semibold text-slate-800"
                      >
                        <option value="Both (Kata & Kumite)">Both (Kata & Kumite)</option>
                        <option value="Kumite Only">Kumite Only</option>
                        <option value="Kata Only">Kata Only</option>
                        <option value="Non-Active">Non-Active (Not Competing)</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-slate-700 uppercase">Competition Category / Division</label>
                        {editDiscipline === 'Non-Active' && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Non-Active</span>
                        )}
                      </div>
                      <input
                        type="text"
                        name="competitionCategory"
                        value={editDiscipline === 'Non-Active' ? 'N/A (Non-Active)' : editCategory}
                        onChange={e => setEditCategory(e.target.value)}
                        disabled={editDiscipline === 'Non-Active'}
                        list="karateCategories"
                        placeholder={editDiscipline === 'Non-Active' ? 'Disabled (Non-Active)' : 'e.g. Male Senior Kumite -75kg'}
                        className={`w-full px-3 py-2 text-xs rounded-xl font-semibold border ${
                          editDiscipline === 'Non-Active'
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed select-none'
                            : 'bg-white border-slate-200 text-slate-900 focus:border-[#0284C7]'
                        }`}
                      />
                      <datalist id="karateCategories">
                        <option value="Male Kumite -60kg (18+)" />
                        <option value="Male Kumite -67kg (18+)" />
                        <option value="Male Kumite -75kg (18+)" />
                        <option value="Male Kumite -84kg (18+)" />
                        <option value="Male Kumite +84kg (18+)" />
                        <option value="Female Kumite -50kg (18+)" />
                        <option value="Female Kumite -55kg (18+)" />
                        <option value="Female Kumite -61kg (18+)" />
                        <option value="Female Kumite +68kg (18+)" />
                        <option value="Male Senior Individual Kata" />
                        <option value="Female Senior Individual Kata" />
                        <option value="Junior Male Kumite -55kg (16-17)" />
                        <option value="Junior Male Kumite -61kg (16-17)" />
                        <option value="Junior Female Kumite -48kg (16-17)" />
                        <option value="Cadet Male Kumite -57kg" />
                        <option value="Cadet Female Kumite -54kg" />
                        <option value="Male Cadet Individual Kata" />
                        <option value="Female Cadet Individual Kata" />
                        <option value="U-14 Individual Kata" />
                      </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        name="weight"
                        defaultValue={editingMember.sportData?.weightKg || ''}
                        placeholder="e.g. 64.5"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Height (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        name="height"
                        defaultValue={editingMember.sportData?.heightCm || ''}
                        placeholder="e.g. 172"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Parent Details & Connected Athletes (Conditional on PARENT role) */}
              {editRoles.includes('PARENT') && (
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                    <span className="font-bold text-xs text-emerald-900 uppercase flex items-center space-x-1.5">
                      <Users size={15} className="text-emerald-600" />
                      <span>Parent Details & Connected Athletes</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Family & Guardian
                    </span>
                  </div>

                  {/* Relationship & Preferences */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Primary Relationship *
                      </label>
                      <select
                        value={editParentRelation}
                        onChange={e => setEditParentRelation(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-emerald-600 font-semibold text-slate-800"
                      >
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Legal Guardian">Legal Guardian</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Other">Other Relative / Guardian</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-center space-y-2 pt-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editParentIsEmergency}
                          onChange={e => setEditParentIsEmergency(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">Primary Emergency Contact</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editParentIsVolunteer}
                          onChange={e => setEditParentIsVolunteer(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">Interested in Club Volunteer Program</span>
                      </label>
                    </div>
                  </div>

                  {/* Connected Athletes List */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1.5">
                      Connected Athletes / Wards ({editParentConnectedAthletes.length})
                    </label>
                    {editParentConnectedAthletes.length === 0 ? (
                      <div className="p-3 bg-white/80 rounded-xl border border-dashed border-emerald-200 text-center text-xs text-slate-500">
                        No athletes connected yet. Use the selector below to link an athlete.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {editParentConnectedAthletes.map(ath => (
                          <div
                            key={ath.athleteId}
                            className="flex items-center justify-between p-2 bg-white rounded-xl border border-emerald-100 shadow-2xs"
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                                {ath.athleteName.charAt(0)}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-slate-900 block">{ath.athleteName}</span>
                                <div className="flex items-center space-x-1.5 text-[10px]">
                                  <span className="bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded border border-emerald-200">
                                    {ath.relationship}
                                  </span>
                                  {ath.isEmergencyContact && (
                                    <span className="bg-rose-50 text-rose-600 font-semibold px-1.5 py-0.2 rounded border border-rose-200">
                                      Emergency Contact
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditParentConnectedAthletes(prev => prev.filter(x => x.athleteId !== ath.athleteId));
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Unlink athlete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Connect New Athlete */}
                  <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 space-y-2">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Connect An Athlete</span>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6">
                        <select
                          value={editParentAthleteToLink}
                          onChange={e => setEditParentAthleteToLink(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white focus:border-emerald-600"
                        >
                          <option value="">-- Select Athlete / Member --</option>
                          {members
                            .filter(m2 => m2.id !== editingMember?.id && !editParentConnectedAthletes.some(c => c.athleteId === m2.id))
                            .map(m2 => (
                              <option key={m2.id} value={m2.id}>
                                {m2.fullName} ({m2.sportData?.beltRank || 'Member'})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="sm:col-span-4">
                        <select
                          value={editParentAthleteRelation}
                          onChange={e => setEditParentAthleteRelation(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white focus:border-emerald-600"
                        >
                          <option value="Child">Child</option>
                          <option value="Son">Son</option>
                          <option value="Daughter">Daughter</option>
                          <option value="Ward">Ward</option>
                          <option value="Spouse">Spouse</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          disabled={!editParentAthleteToLink}
                          onClick={() => {
                            if (!editParentAthleteToLink) return;
                            const targetAth = members.find(m2 => m2.id === editParentAthleteToLink);
                            if (targetAth) {
                              setEditParentConnectedAthletes(prev => [
                                ...prev,
                                {
                                  id: `rel-${Date.now()}`,
                                  athleteId: targetAth.id,
                                  athleteName: targetAth.fullName,
                                  relationship: editParentAthleteRelation,
                                  isEmergencyContact: true,
                                }
                              ]);
                              setEditParentAthleteToLink('');
                            }
                          }}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center space-x-1"
                        >
                          <Plus size={14} />
                          <span>Link</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* EDIT PARENT / GUARDIAN MODAL                                        */}
      {/* =================================================================== */}
      {isEditGuardianModalOpen && editingGuardian && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Edit Parent / Guardian Profile</h3>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="font-mono text-[11px] text-[#0284C7]">ID: {editingGuardian.id}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] font-semibold text-slate-500">{editingGuardian.fullName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditGuardianModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGuardian} className="space-y-4">
              {/* 1. Guardian Contact Information */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Guardian Information
                </span>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    defaultValue={editingGuardian.fullName || ''}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Phone Number (WhatsApp) *</label>
                    <input
                      type="tel"
                      name="contactNumber"
                      required
                      defaultValue={editingGuardian.contactNumber || ''}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={editingGuardian.email || ''}
                      placeholder="e.g. parent@example.com"
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#0284C7]"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isVolunteerEligible"
                      defaultChecked={!!editingGuardian.isVolunteerEligible}
                      className="rounded text-[#0284C7] focus:ring-[#0284C7]"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Volunteer Program Participant (Available for event & tournament marshalling)
                    </span>
                  </label>
                </div>
              </div>

              {/* 2. Connected Athletes & Relationships */}
              <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0284C7] uppercase tracking-wider flex items-center space-x-1.5">
                    <Trophy size={14} />
                    <span>Connected Athletes & Wards ({editingGuardianRels.length})</span>
                  </span>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                    Family Connections
                  </span>
                </div>

                {editingGuardianRels.length === 0 ? (
                  <div className="p-3 bg-white rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    No athletes connected yet. Use the selector below to link an athlete.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editingGuardianRels.map((rel, rIdx) => (
                      <div
                        key={rIdx}
                        className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#0284C7] font-black text-xs flex items-center justify-center shrink-0">
                            {rel.athleteName?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block">{rel.athleteName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{rel.athleteId || 'Linked Ward'}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div>
                            <select
                              value={rel.relationship}
                              onChange={e => {
                                const newRel = e.target.value;
                                setEditingGuardianRels(prev =>
                                  prev.map((item, idx) => idx === rIdx ? { ...item, relationship: newRel } : item)
                                );
                              }}
                              className="px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                            >
                              <option value="Father">Father</option>
                              <option value="Mother">Mother</option>
                              <option value="Guardian">Guardian</option>
                              <option value="Spouse">Spouse</option>
                              <option value="Sibling">Sibling</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-slate-600">
                            <input
                              type="checkbox"
                              checked={!!rel.isEmergencyContact}
                              onChange={e => {
                                const checked = e.target.checked;
                                setEditingGuardianRels(prev =>
                                  prev.map((item, idx) => idx === rIdx ? { ...item, isEmergencyContact: checked } : item)
                                );
                              }}
                              className="rounded text-red-600 focus:ring-red-500"
                            />
                            <span className="font-semibold text-red-700">Emergency</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingGuardianRels(prev => prev.filter((_, idx) => idx !== rIdx));
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Unlink Athlete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Link another athlete selector */}
                <div className="pt-2 border-t border-sky-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={athleteToLink}
                    onChange={e => setAthleteToLink(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                  >
                    <option value="">-- Select an Athlete to Connect --</option>
                    {members
                      .filter(m => !editingGuardianRels.some(r => r.athleteId === m.id))
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.fullName} ({m.sportData?.beltRank || 'Athlete'})
                        </option>
                      ))}
                  </select>

                  <select
                    value={athleteRelationToLink}
                    onChange={e => setAthleteRelationToLink(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Other">Other</option>
                  </select>

                  <button
                    type="button"
                    disabled={!athleteToLink}
                    onClick={() => {
                      if (!athleteToLink) return;
                      const selectedAth = members.find(m => m.id === athleteToLink);
                      if (selectedAth) {
                        setEditingGuardianRels(prev => [
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
                    className="px-3 py-1.5 bg-[#0284C7] disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center space-x-1"
                  >
                    <Plus size={13} />
                    <span>Connect</span>
                  </button>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditGuardianModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Save Guardian & Connections
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
