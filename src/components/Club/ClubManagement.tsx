'use client';

/**
 * Scms Club Management & Multi-Branch Architecture
 * Fully connected to Supabase backend & Store, securely separated by RBAC and server actions.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { createBranchAndAssignManager } from '@/app/actions/branches';
import { updateClubProfileAction, updateBranchProfileAction } from '@/app/actions/club-profile';
import { assignClubAdminAction, assignBranchManagerAction } from '@/app/actions/multi-club';
import { validateDisplayName } from '@/lib/validation/club';
import {
  Building2,
  GitBranch,
  MapPin,
  Clock,
  User,
  Plus,
  CheckCircle2,
  Layers,
  Edit2,
  AlertCircle,
  Save,
  Info,
  Phone,
  Mail,
  Search,
  Globe,
  ShieldCheck,
  ChevronRight,
  ShieldAlert,
  UserCheck,
  Users,
  Award,
  Shield,
  Filter
} from 'lucide-react';

interface ClubManagementProps {
  clubId?: string;
  branchId?: string;
  initialTab?: 'profile' | 'branches' | 'officials' | 'onboarding';
}

export default function ClubManagement({ clubId, branchId, initialTab = 'profile' }: ClubManagementProps) {
  const { activeRole, activeClub, activeBranch, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'branches' | 'officials' | 'onboarding'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  // All clubs for SUPERADMIN selector
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>(clubId || activeClub?.id || 'Scms-CLUB-000001');

  // Modals
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  
  // Branch Manager Assignment Modal
  const [assignManagerModal, setAssignManagerModal] = useState<{ isOpen: boolean; branchId: string | null; branchName: string }>({
    isOpen: false,
    branchId: null,
    branchName: ''
  });
  const [branchManagerSearchTerm, setBranchManagerSearchTerm] = useState('');
  const [assigningBranchManager, setAssigningBranchManager] = useState(false);

  // Club Admin Assignment Modal
  const [assignClubAdminModal, setAssignClubAdminModal] = useState(false);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [assigningAdmin, setAssigningAdmin] = useState(false);

  // Officials & Staff Tab States
  const [officialSearchTerm, setOfficialSearchTerm] = useState('');
  const [officialRoleFilter, setOfficialRoleFilter] = useState<'ALL' | 'ADMIN' | 'MANAGER' | 'COACH' | 'STAFF'>('ALL');
  const [assignOfficialModal, setAssignOfficialModal] = useState<{
    isOpen: boolean;
    member: any | null;
  }>({
    isOpen: false,
    member: null
  });
  const [selectedOfficialRole, setSelectedOfficialRole] = useState<string>('COACH');
  const [selectedOfficialBranchId, setSelectedOfficialBranchId] = useState<string>('');
  const [assigningOfficialRole, setAssigningOfficialRole] = useState(false);
  const [officialMemberSearch, setOfficialMemberSearch] = useState('');

  // Current Club & Branches data
  const [club, setClub] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [clubMembers, setClubMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingClub, setSavingClub] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for live character counter & validation
  const [clubNameInput, setClubNameInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');

  const supabase = createClient();

  const isSuperAdmin = activeRole === 'SUPERADMIN' || activeRole === 'SYSTEM_ADMIN';
  const isClubAdmin = activeRole === 'CLUB_ADMIN' || activeRole === 'CLUB_CO_ADMIN';
  const isBranchManager = activeRole === 'BRANCH_MANAGER';

  // Can the user edit the parent club profile?
  const canEditClub = isSuperAdmin || isClubAdmin;

  // Load all clubs for SuperAdmin
  useEffect(() => {
    async function loadAllClubs() {
      if (!isSuperAdmin) return;
      try {
        const { data: dbClubs } = await supabase.from('clubs').select('id, name, display_name');
        if (dbClubs && dbClubs.length > 0) {
          setAllClubs(dbClubs);
        } else {
          const { store } = await import('@/lib/store');
          setAllClubs(store.getClubs().map(c => ({ id: c.id, name: c.name, display_name: c.displayName })));
        }
      } catch {
        // Fallback
      }
    }
    loadAllClubs();
  }, [isSuperAdmin, supabase]);

  // Load current club and branches
  useEffect(() => {
    async function loadClubData() {
      setLoading(true);
      setFeedback(null);
      const targetClubId = selectedClubId || clubId || activeClub?.id;
      if (!targetClubId) {
        setLoading(false);
        return;
      }

      // 1. Fetch Club
      let currentClub: any = null;
      if (targetClubId.startsWith('Scms-')) {
        const { store } = await import('@/lib/store');
        currentClub = store.getClubById(targetClubId);
      } else {
        const { data: dbClub } = await supabase.from('clubs').select('*').eq('id', targetClubId).maybeSingle();
        currentClub = dbClub;
      }

      if (!currentClub && activeClub?.id === targetClubId) {
        currentClub = activeClub;
      }

      if (currentClub) {
        setClub(currentClub);
        setClubNameInput(currentClub.name || '');
        let initialDisplayName = currentClub.display_name || currentClub.displayName;
        if (!initialDisplayName || initialDisplayName.trim() === '' || initialDisplayName.length > 30) {
          if (currentClub.name?.toLowerCase().includes('senshi')) {
            initialDisplayName = 'Senshi Goju-Ryu';
          } else if (currentClub.name && currentClub.name.length <= 30) {
            initialDisplayName = currentClub.name.trim();
          } else {
            initialDisplayName = (currentClub.name || 'Senshi Club').trim().substring(0, 30);
          }
        }
        setDisplayNameInput(initialDisplayName);
      }

      // 2. Fetch Branches
      let branchList: any[] = [];
      if (targetClubId.startsWith('Scms-')) {
        const { store } = await import('@/lib/store');
        branchList = store.getBranches(targetClubId);
      } else {
        const { data: dbBranches } = await supabase.from('club_branches').select('*').eq('club_id', targetClubId);
        if (dbBranches && dbBranches.length > 0) {
          branchList = dbBranches;
        } else {
          const { store } = await import('@/lib/store');
          branchList = store.getBranches(targetClubId);
        }
      }
      setBranches(branchList);

      // 3. Fetch Members for Admin & Manager assignment
      try {
        const { data: membersRolesData } = await supabase
          .from('user_roles')
          .select(`
            user_id,
            role,
            branch_id,
            profiles (
              id,
              full_name,
              email,
              phone,
              status
            )
          `)
          .eq('club_id', targetClubId);

        if (membersRolesData && membersRolesData.length > 0) {
          const map = new Map<string, any>();
          membersRolesData.forEach((r: any) => {
            if (r.profiles) {
              if (!map.has(r.profiles.id)) {
                map.set(r.profiles.id, {
                  id: r.profiles.id,
                  full_name: r.profiles.full_name,
                  fullName: r.profiles.full_name,
                  email: r.profiles.email,
                  phone: r.profiles.phone,
                  roles: [r.role],
                  branchId: r.branch_id
                });
              } else {
                map.get(r.profiles.id).roles.push(r.role);
              }
            }
          });
          setClubMembers(Array.from(map.values()));
        } else if (targetClubId.startsWith('Scms-')) {
          const { store } = await import('@/lib/store');
          const mockMembers = store.getMembers(targetClubId);
          const mockUsers = store.users.filter(u => u.roles.some(r => r.clubId === targetClubId));
          const map = new Map<string, any>();

          // 1. Add mock users with official roles
          mockUsers.forEach(u => {
            const clubRoles = u.roles.filter(r => r.clubId === targetClubId).map(r => r.role);
            map.set(u.id, {
              id: u.id,
              full_name: u.fullName,
              fullName: u.fullName,
              email: u.email,
              phone: u.phone,
              roles: clubRoles.length > 0 ? clubRoles : [u.activeRole || 'CLUB_ADMIN'],
              branchId: u.activeBranchId
            });
          });

          // 2. Add members
          mockMembers.forEach(m => {
            if (!map.has(m.id)) {
              map.set(m.id, {
                id: m.id,
                full_name: m.fullName,
                fullName: m.fullName,
                email: m.email,
                phone: m.phone,
                roles: m.roles && m.roles.length > 0 ? m.roles : (m.isAthlete ? ['ATHLETE'] : ['MEMBER']),
                branchId: m.branchId
              });
            } else {
              const existing = map.get(m.id);
              if (m.roles) {
                m.roles.forEach((r: string) => {
                  if (!existing.roles.includes(r)) existing.roles.push(r);
                });
              }
            }
          });

          // 3. Ensure primary admin is represented if present on club
          if (currentClub?.primary_admin_name || currentClub?.primaryAdminName) {
            const pAdminId = currentClub.primary_admin_id || currentClub.primaryAdminId || 'usr-padmin';
            const pAdminEmail = currentClub.primary_admin_email || currentClub.primaryAdminEmail || currentClub.email;
            if (!map.has(pAdminId) && !Array.from(map.values()).some((v: any) => v.email === pAdminEmail)) {
              map.set(pAdminId, {
                id: pAdminId,
                full_name: currentClub.primary_admin_name || currentClub.primaryAdminName,
                fullName: currentClub.primary_admin_name || currentClub.primaryAdminName,
                email: pAdminEmail,
                phone: currentClub.primary_admin_phone || currentClub.primaryAdminPhone || currentClub.phone,
                roles: ['CLUB_ADMIN'],
                branchId: undefined
              });
            }
          }

          setClubMembers(Array.from(map.values()));
        }
      } catch {
        // Non-fatal
      }

      setLoading(false);
    }

    loadClubData();
  }, [selectedClubId, clubId, activeClub?.id, supabase]);

  const handleAssignClubAdmin = async (member: any) => {
    const targetClubId = selectedClubId || clubId || activeClub?.id;
    if (!targetClubId) return;
    const adminName = member.fullName || member.full_name;
    const adminEmail = member.email || '';
    const adminPhone = member.phone || '';

    setAssigningAdmin(true);
    try {
      if (targetClubId.startsWith('Scms-')) {
        const { store } = await import('@/lib/store');
        store.assignClubAdmin(targetClubId, member.id, currentUser?.fullName || 'SuperAdmin');
      }

      const res = await assignClubAdminAction({
        clubId: targetClubId,
        targetUserId: member.id,
        adminName,
        adminEmail
      });

      if (res.error) {
        setFeedback({
          type: 'error',
          message: 'Error assigning admin: ' + res.error
        });
      } else {
        setClub((prev: any) => ({
          ...prev,
          primaryAdminId: member.id,
          primary_admin_id: member.id,
          primaryAdminName: adminName,
          primary_admin_name: adminName,
          primaryAdminEmail: adminEmail,
          primary_admin_email: adminEmail,
          primaryAdminPhone: adminPhone,
          primary_admin_phone: adminPhone
        }));

        setFeedback({
          type: 'success',
          message: `Successfully promoted ${adminName} to Primary Club Administrator!`
        });
        setAssignClubAdminModal(false);
        setAdminSearchTerm('');

        if (!targetClubId.startsWith('Scms-')) {
          const { data: dbClub } = await supabase.from('clubs').select('*').eq('id', targetClubId).maybeSingle();
          if (dbClub) {
            setClub((prev: any) => ({
              ...prev,
              ...dbClub,
              primary_admin_name: adminName,
              primary_admin_email: adminEmail,
              primary_admin_phone: adminPhone
            }));
          }
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Error: ' + err.message
      });
    } finally {
      setAssigningAdmin(false);
    }
  };

  const handleAssignBranchManager = async (member: any) => {
    const targetClubId = selectedClubId || clubId || activeClub?.id;
    if (!targetClubId || !assignManagerModal.branchId) return;
    const mgrName = member.fullName || member.full_name;

    setAssigningBranchManager(true);
    try {
      if (targetClubId.startsWith('Scms-')) {
        const { store } = await import('@/lib/store');
        store.assignBranchManager(targetClubId, assignManagerModal.branchId, member.id, currentUser?.fullName || 'SuperAdmin');
        setBranches([...store.getBranches(targetClubId)]);
      }

      const res = await assignBranchManagerAction({
        clubId: targetClubId,
        branchId: assignManagerModal.branchId,
        targetUserId: member.id,
        managerName: mgrName,
        managerEmail: member.email
      });

      if (res.error) {
        setFeedback({
          type: 'error',
          message: 'Error assigning manager: ' + res.error
        });
      } else {
        setBranches((prev: any[]) =>
          prev.map(b =>
            b.id === assignManagerModal.branchId
              ? { ...b, managerId: member.id, manager_id: member.id, managerName: mgrName, manager_name: mgrName }
              : b
          )
        );

        setFeedback({
          type: 'success',
          message: `Successfully appointed ${mgrName} as Manager of ${assignManagerModal.branchName}!`
        });
        setAssignManagerModal({ isOpen: false, branchId: null, branchName: '' });
        setBranchManagerSearchTerm('');

        if (!targetClubId.startsWith('Scms-')) {
          const { data: dbBranches } = await supabase.from('club_branches').select('*').eq('club_id', targetClubId);
          if (dbBranches) setBranches(dbBranches);
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Error: ' + err.message
      });
    } finally {
      setAssigningBranchManager(false);
    }
  };

  const handleAssignOfficialRole = async (member: any, role: string, targetBranchId?: string) => {
    const targetClubId = selectedClubId || clubId || activeClub?.id;
    if (!targetClubId || !member) return;

    setAssigningOfficialRole(true);
    try {
      const memberName = member.fullName || member.full_name;

      if (targetClubId.startsWith('Scms-')) {
        const { store } = await import('@/lib/store');
        const user = store.users.find(u => u.id === member.id || u.email === member.email);
        if (user) {
          if (!user.roles.some(r => r.role === role && r.clubId === targetClubId)) {
            user.roles.push({
              role: role as any,
              clubId: targetClubId,
              branchId: targetBranchId || undefined,
              grantedAt: new Date().toISOString()
            });
          }
        }
        const mem = store.members.find(m => m.id === member.id || m.email === member.email);
        if (mem) {
          if (!mem.roles) mem.roles = [];
          if (!mem.roles.includes(role)) mem.roles.push(role);
          if (targetBranchId) mem.branchId = targetBranchId;
        }
        store.logActivity(
          currentUser?.fullName || 'SuperAdmin',
          'Official Role Appointed',
          `Assigned ${memberName} as ${role} for ${club?.name}.`,
          'CLUB',
          targetClubId,
          targetBranchId
        );
      } else {
        if (member.id && member.id.length > 20) {
          await supabase.from('user_roles').upsert({
            user_id: member.id,
            club_id: targetClubId,
            branch_id: targetBranchId || null,
            role: role
          }, { onConflict: 'user_id,club_id,role' });
        }
      }

      // Update clubMembers local state
      setClubMembers(prev => prev.map(m => {
        if (m.id === member.id) {
          const currentRoles = m.roles || [];
          const updatedRoles = currentRoles.includes(role) ? currentRoles : [...currentRoles, role];
          return {
            ...m,
            roles: updatedRoles,
            branchId: targetBranchId || m.branchId
          };
        }
        return m;
      }));

      setFeedback({
        type: 'success',
        message: `Successfully appointed ${memberName} as ${role.replace(/_/g, ' ')}!`
      });
      setAssignOfficialModal({ isOpen: false, member: null });
      setOfficialMemberSearch('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Failed to assign official role: ' + err.message
      });
    } finally {
      setAssigningOfficialRole(false);
    }
  };


  // Live validation for Display Name
  const displayNameValidation = validateDisplayName(displayNameInput);
  const isDisplayNameExceeded = displayNameInput.trim().length > 30;

  // Handle Save Club Profile
  const handleUpdateClub = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEditClub) return;

    if (!displayNameValidation.valid) {
      setFeedback({ type: 'error', message: displayNameValidation.error || 'Invalid Display Name.' });
      return;
    }

    setSavingClub(true);
    setFeedback(null);

    const fd = new FormData(e.currentTarget);
    const targetClubId = selectedClubId || clubId || activeClub?.id || 'Scms-CLUB-000001';
    fd.set('clubId', targetClubId);
    fd.set('name', clubNameInput);
    fd.set('displayName', displayNameInput);

    let clientSaved = false;
    // 1. Immediately update client-side store so localStorage and current session reflect the changes
    if (targetClubId.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      try {
        store.updateClub(
          targetClubId,
          {
            name: clubNameInput,
            displayName: displayNameInput,
            registrationNo: (fd.get('registrationNo') as string)?.trim() || undefined,
            establishedYear: fd.get('establishedYear') ? parseInt(fd.get('establishedYear') as string, 10) : undefined,
            phone: (fd.get('phone') as string)?.trim() || '',
            email: (fd.get('email') as string)?.trim() || '',
            address: (fd.get('address') as string)?.trim() || '',
            city: (fd.get('city') as string)?.trim() || '',
            state: (fd.get('state') as string)?.trim() || '',
            postcode: (fd.get('postcode') as string)?.trim() || '',
            country: (fd.get('country') as string)?.trim() || 'Malaysia',
          },
          currentUser?.fullName || 'SuperAdmin'
        );
        const updated = store.getClubById(targetClubId);
        if (updated) {
          setClub({ ...updated });
          setClubNameInput(updated.name);
          setDisplayNameInput(updated.displayName || updated.name);
          clientSaved = true;
        }
      } catch (err: any) {
        console.error('Error updating client store:', err);
      }
    }

    // 2. Call server action for Supabase and backend synchronization
    const res = await updateClubProfileAction(fd);
    setSavingClub(false);

    if (res.error && !clientSaved) {
      setFeedback({ type: 'error', message: res.error });
      alert('Error saving club profile: ' + res.error);
    } else {
      const successMsg = 'Club Profile & Display Name successfully updated! KarateTech 3.0 will receive this Display Name.';
      setFeedback({
        type: 'success',
        message: successMsg
      });
      if (res.club) {
        setClub(res.club);
        setClubNameInput(res.club.name || '');
        setDisplayNameInput(res.club.display_name || res.club.displayName || '');
      }
      alert('Club Profile & Display Name successfully saved!');
    }
  };

  // Handle Save Branch Profile
  const handleUpdateBranchProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBranch) return;

    setSavingBranch(true);
    const fd = new FormData(e.currentTarget);
    fd.set('branchId', editingBranch.id);

    // If mock club / mock branch, update client store immediately
    if (selectedClubId.startsWith('Scms-') || editingBranch.id.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      try {
        store.updateBranch(
          editingBranch.id,
          {
            name: (fd.get('name') as string)?.trim(),
            displayName: (fd.get('displayName') as string)?.trim() || undefined,
            venueName: (fd.get('venueName') as string)?.trim() || 'Dojo Facility',
            address: (fd.get('address') as string)?.trim() || '',
            district: (fd.get('district') as string)?.trim() || '',
            city: (fd.get('city') as string)?.trim() || '',
            state: (fd.get('state') as string)?.trim() || '',
            postcode: (fd.get('postcode') as string)?.trim() || '',
            country: (fd.get('country') as string)?.trim() || 'Malaysia',
            phone: (fd.get('phone') as string)?.trim() || '',
            email: (fd.get('email') as string)?.trim() || '',
            operatingHours: (fd.get('operatingHours') as string)?.trim() || undefined,
            status: ((fd.get('status') as string) || 'Active') as any
          },
          currentUser?.fullName || activeRole
        );
      } catch (err) {
        console.error('Error updating store branch:', err);
      }
    }

    const res = await updateBranchProfileAction(fd);
    setSavingBranch(false);

    if (res.error && !selectedClubId.startsWith('Scms-')) {
      alert(res.error);
    } else {
      alert('Branch Profile successfully saved!');
      setEditingBranch(null);
      // Reload branches
      if (selectedClubId.startsWith('Scms-')) {
        const { store } = await import('@/lib/store');
        setBranches([...store.getBranches(selectedClubId)]);
      } else {
        const { data: dbBranches } = await supabase.from('club_branches').select('*').eq('club_id', selectedClubId);
        if (dbBranches) setBranches(dbBranches);
      }
    }
  };

  // Handle Create New Branch
  const handleCreateBranch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedClubId) return;
    const fd = new FormData(e.currentTarget);

    if (selectedClubId.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      store.addBranch(
        selectedClubId,
        {
          name: fd.get('name') as string,
          venueName: fd.get('venueName') as string,
          address: fd.get('address') as string,
          city: fd.get('city') as string,
          state: fd.get('state') as string
        },
        'SUPERADMIN'
      );
      alert('Branch created successfully (Mock Store)!');
      setIsAddBranchOpen(false);
      setBranches(store.getBranches(selectedClubId));
      return;
    }

    fd.append('clubId', selectedClubId);
    const res = await createBranchAndAssignManager(fd);

    if (res.error) {
      alert(res.error);
    } else {
      alert('Branch created successfully!');
      setIsAddBranchOpen(false);
      const { data: dbBranches } = await supabase.from('club_branches').select('*').eq('club_id', selectedClubId);
      if (dbBranches) setBranches(dbBranches);
    }
  };

  const filteredAdminMembers = clubMembers.filter((m: any) => {
    if (!adminSearchTerm.trim()) return true;
    const q = adminSearchTerm.toLowerCase();
    const name = (m.fullName || m.full_name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    const phone = (m.phone || '').toLowerCase();
    const id = (m.id || '').toLowerCase();
    const rolesMatch = Array.isArray(m.roles) && m.roles.some((r: string) => r.toLowerCase().includes(q));
    return name.includes(q) || email.includes(q) || phone.includes(q) || id.includes(q) || rolesMatch;
  });

  const filteredBranchMembers = clubMembers.filter((m: any) => {
    if (!branchManagerSearchTerm.trim()) return true;
    const q = branchManagerSearchTerm.toLowerCase();
    const name = (m.fullName || m.full_name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    const phone = (m.phone || '').toLowerCase();
    const id = (m.id || '').toLowerCase();
    const rolesMatch = Array.isArray(m.roles) && m.roles.some((r: string) => r.toLowerCase().includes(q));
    return name.includes(q) || email.includes(q) || phone.includes(q) || id.includes(q) || rolesMatch;
  });

  const officialsList = React.useMemo(() => {
    return clubMembers.filter(m => {
      const isPrimaryAdmin =
        (club?.primary_admin_id && m.id === club.primary_admin_id) ||
        (club?.primary_admin_email && m.email === club.primary_admin_email) ||
        (club?.primaryAdminEmail && m.email === club.primaryAdminEmail) ||
        (club?.primary_admin_name && (m.fullName === club.primary_admin_name || m.full_name === club.primary_admin_name));

      const hasOfficialRole = Array.isArray(m.roles) && m.roles.some((r: string) =>
        ['CLUB_ADMIN', 'CLUB_CO_ADMIN', 'BRANCH_MANAGER', 'COACH', 'ASSISTANT_COACH', 'REGISTRATION_OFFICER', 'SECRETARY', 'TREASURER', 'OFFICIAL', 'STAFF'].includes(r.toUpperCase())
      );

      return isPrimaryAdmin || hasOfficialRole;
    });
  }, [clubMembers, club]);

  const filteredOfficials = React.useMemo(() => {
    return officialsList.filter(o => {
      // Filter by role category
      if (officialRoleFilter === 'ADMIN') {
        const isAdmin = (Array.isArray(o.roles) && o.roles.some((r: string) => ['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(r.toUpperCase()))) ||
          (club?.primary_admin_id && o.id === club.primary_admin_id) ||
          (club?.primary_admin_email && o.email === club.primary_admin_email);
        if (!isAdmin) return false;
      } else if (officialRoleFilter === 'MANAGER') {
        if (!Array.isArray(o.roles) || !o.roles.some((r: string) => r.toUpperCase() === 'BRANCH_MANAGER')) return false;
      } else if (officialRoleFilter === 'COACH') {
        if (!Array.isArray(o.roles) || !o.roles.some((r: string) => ['COACH', 'ASSISTANT_COACH'].includes(r.toUpperCase()))) return false;
      } else if (officialRoleFilter === 'STAFF') {
        if (!Array.isArray(o.roles) || !o.roles.some((r: string) => ['REGISTRATION_OFFICER', 'SECRETARY', 'TREASURER', 'OFFICIAL', 'STAFF'].includes(r.toUpperCase()))) return false;
      }

      if (officialSearchTerm.trim()) {
        const q = officialSearchTerm.toLowerCase();
        const name = (o.fullName || o.full_name || '').toLowerCase();
        const email = (o.email || '').toLowerCase();
        const phone = (o.phone || '').toLowerCase();
        const rolesStr = (o.roles || []).join(' ').toLowerCase();
        const branch = (branches.find(b => b.id === o.branchId)?.name || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || rolesStr.includes(q) || branch.includes(q);
      }
      return true;
    });
  }, [officialsList, officialRoleFilter, officialSearchTerm, club, branches]);

  const filteredMembersForOfficialAssignment = React.useMemo(() => {
    if (!officialMemberSearch.trim()) return clubMembers;
    const q = officialMemberSearch.toLowerCase();
    return clubMembers.filter((m: any) => {
      const name = (m.fullName || m.full_name || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      const phone = (m.phone || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || id.includes(q);
    });
  }, [clubMembers, officialMemberSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0284C7]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header & Role Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
            <Building2 size={14} />
            <span>Club & Branch Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Club Profile Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage canonical club profile, official KarateTech 3.0 Display Name, and satellite branch details.
          </p>
        </div>

        {/* SuperAdmin Club Switcher */}
        {isSuperAdmin && allClubs.length > 0 && (
          <div className="flex items-center space-x-2 bg-slate-100 p-2 rounded-2xl border border-slate-200">
            <Search size={14} className="text-slate-500 ml-1" />
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Switch Club:</span>
            <select
              value={selectedClubId}
              onChange={e => setSelectedClubId(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus:border-[#0284C7] focus:outline-hidden"
            >
              {allClubs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.display_name ? `${c.display_name} (${c.name})` : c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Role Notice Banner */}
      {isBranchManager && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-amber-900">
          <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Branch Manager View:</span> You have view-only access to the parent club profile.
            Branch managers cannot edit the parent club profile or change the club Display Name. You may edit your assigned branch details below.
          </div>
        </div>
      )}

      {/* Feedback Alerts */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center space-x-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'profile'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 size={15} />
          <span>Club Profile & Display Name</span>
        </button>

        <button
          onClick={() => setActiveTab('branches')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'branches'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitBranch size={15} />
          <span>Branches Directory ({branches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('officials')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'officials'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users size={15} />
          <span>Officials & Staff ({officialsList.length})</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* 1. CLUB PROFILE FORM                                                */}
      {/* =================================================================== */}
      {activeTab === 'profile' && club && (
        <div className="space-y-8">
          <form onSubmit={handleUpdateClub} className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs max-w-4xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div>
                <span className="font-mono text-xs font-bold text-[#0284C7] block">Club ID: {club.id}</span>
                <span className="text-xs text-slate-400">Canonical Sports Club Master Entity</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-[#0284C7] border border-sky-200 flex items-center space-x-1">
                  <ShieldCheck size={12} />
                  <span>KarateTech 3.0 Connected</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* FIELD 1: CLUB NAME */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Club Name <span className="text-rose-500">*</span>
                  <span className="text-[11px] text-slate-400 font-normal ml-2">(Canonical registered name in SCMS)</span>
                </label>
                <input
                  name="name"
                  value={clubNameInput}
                  onChange={e => setClubNameInput(e.target.value)}
                  disabled={!canEditClub}
                  required
                  placeholder="Enter canonical club name"
                  className="w-full text-base font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-[#0284C7] focus:bg-white focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                />
              </div>

              {/* FIELD 2: DISPLAY NAME (CRITICAL FOR KARATETECH) */}
              <div className="bg-sky-50/70 border-2 border-sky-200 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 flex items-center space-x-1.5 uppercase tracking-wide">
                    <span>Display Name</span>
                    <span className="text-rose-500">*</span>
                    <span className="bg-[#0284C7] text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                      TRANSMITTED TO KARATETECH 3.0
                    </span>
                  </label>
                  <div className="flex items-center space-x-1 text-xs">
                    <span
                      className={`font-mono font-bold ${
                        isDisplayNameExceeded ? 'text-rose-600' : 'text-slate-600'
                      }`}
                    >
                      {displayNameInput.trim().length}/30
                    </span>
                    <span className="text-slate-400 text-[10px]">characters</span>
                  </div>
                </div>

                <input
                  name="displayName"
                  value={displayNameInput}
                  onChange={e => setDisplayNameInput(e.target.value)}
                  disabled={!canEditClub}
                  required
                  placeholder="Enter club display name"
                  maxLength={40} // Allow typing beyond to show live validation error
                  className={`w-full text-base font-extrabold bg-white border rounded-xl px-3.5 py-2.5 transition-all outline-hidden ${
                    isDisplayNameExceeded
                      ? 'border-rose-400 text-rose-900 focus:ring-2 focus:ring-rose-400'
                      : 'border-sky-300 text-slate-950 focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20'
                  } disabled:bg-slate-100 disabled:text-slate-500`}
                />

                {/* Validation and Preview info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] pt-1 gap-1">
                  {isDisplayNameExceeded ? (
                    <span className="text-rose-600 font-bold flex items-center space-x-1">
                      <AlertCircle size={12} />
                      <span>Exceeds maximum allowed length of 30 characters! Please shorten.</span>
                    </span>
                  ) : (
                    <span className="text-slate-500 flex items-center space-x-1">
                      <Info size={12} className="text-[#0284C7] shrink-0" />
                      <span>Transmitted directly to KarateTech 3.0 as the participant's official club name.</span>
                    </span>
                  )}

                  {displayNameInput.trim() && !isDisplayNameExceeded && (
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Preview: "{displayNameInput.trim()}"
                    </span>
                  )}
                </div>
              </div>

              {/* OTHER PROFILE FIELDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold block">Club Registration / ROS No.</label>
                  <input
                    name="registrationNo"
                    defaultValue={club.registration_no || club.registrationNo}
                    disabled={!canEditClub}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7] focus:outline-hidden disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold block">Established Year</label>
                  <input
                    type="number"
                    name="establishedYear"
                    defaultValue={club.established_year || club.establishedYear}
                    disabled={!canEditClub}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7] focus:outline-hidden disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold block">Club Contact Phone</label>
                  <input
                    name="phone"
                    defaultValue={club.phone}
                    disabled={!canEditClub}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7] focus:outline-hidden disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold block">Club Official Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={club.email}
                    disabled={!canEditClub}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7] focus:outline-hidden disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-slate-600 font-bold block">Headquarters Address</label>
                  <input
                    name="address"
                    defaultValue={club.address}
                    disabled={!canEditClub}
                    placeholder="Street Address"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7] focus:outline-hidden disabled:bg-slate-100 mb-2"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      name="city"
                      defaultValue={club.city}
                      disabled={!canEditClub}
                      placeholder="City"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7] focus:outline-hidden disabled:bg-slate-100"
                    />
                    <input
                      name="state"
                      defaultValue={club.state}
                      disabled={!canEditClub}
                      placeholder="State"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7] focus:outline-hidden disabled:bg-slate-100"
                    />
                    <input
                      name="postcode"
                      defaultValue={club.postcode}
                      disabled={!canEditClub}
                      placeholder="Postcode"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7] focus:outline-hidden disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-slate-600 font-bold block">Country</label>
                  <input
                    name="country"
                    defaultValue={club.country || 'Malaysia'}
                    disabled={!canEditClub}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7] focus:outline-hidden disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>

            {canEditClub && (
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 block">
                    Changes will be permanently audited and applied to future KarateTech 3.0 syncs.
                  </span>
                  {feedback && (
                    <span
                      className={`text-xs font-bold inline-flex items-center space-x-1.5 ${
                        feedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {feedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>{feedback.message}</span>
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={savingClub || isDisplayNameExceeded}
                  className="px-6 py-2.5 bg-[#0284C7] hover:bg-[#0369A1] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
                >
                  {savingClub ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Save size={15} />
                  )}
                  <span>Save Club Profile</span>
                </button>
              </div>
            )}
          </form>

          {/* PRIMARY CLUB ADMINISTRATOR & GOVERNANCE CARD */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs max-w-4xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
              <div>
                <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-0.5">
                  <UserCheck size={14} />
                  <span>Club Leadership & Governance</span>
                </div>
                <h3 className="font-extrabold text-base text-slate-900">Primary Club Administrator</h3>
                <p className="text-xs text-slate-500">
                  Select an active member from this club's roster to assign as the primary administrator with full operational privileges.
                </p>
              </div>
              {canEditClub && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignClubAdminModal(true);
                    setAdminSearchTerm('');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <UserCheck size={14} />
                  <span>Assign / Change Club Admin</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Administrator Name</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">
                  {club.primary_admin_name || club.primaryAdminName || 'Not Assigned'}
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Official Email</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block truncate">
                  {club.primary_admin_email || club.primaryAdminEmail || club.email || '—'}
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Phone</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">
                  {club.primary_admin_phone || club.primaryAdminPhone || club.phone || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* EMBEDDED BRANCHES PREVIEW SECTION */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Affiliated Branches & Dojos</h3>
                <p className="text-xs text-slate-500">
                  Satellite dojos operating under {club.display_name || club.name}. Branch athletes automatically inherit this club's Display Name.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('branches')}
                className="text-xs font-bold text-[#0284C7] hover:underline flex items-center space-x-1"
              >
                <span>Manage Branches</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map(b => (
                <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-sm text-slate-900">{b.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {b.status || 'Active'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center space-x-1">
                    <MapPin size={12} className="shrink-0 text-slate-400" />
                    <span>{b.city || 'City'}, {b.state || 'State'}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">Code: {b.id.substring(0, 18)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. BRANCHES DIRECTORY TAB                                           */}
      {/* =================================================================== */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-slate-900">Branch Profiles & Venues</h2>
              <p className="text-xs text-slate-500">
                Satellite branches maintain operational dojos under <strong className="text-slate-800">{club?.name}</strong>.
                All branches inherit the parent club official Display Name (<strong className="text-[#0284C7]">{club?.displayName || club?.display_name || club?.name}</strong>) when synchronizing athletes to KarateTech 3.0.
              </p>
            </div>
            {canEditClub && (
              <button
                onClick={() => setIsAddBranchOpen(true)}
                className="py-2.5 px-5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center space-x-1.5"
              >
                <Plus size={16} />
                <span>Establish New Branch</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map(b => {
              // Comprehensive permission check per branch
              const isThisBranchManager = isBranchManager && (
                b.id === activeBranch?.id ||
                b.id === (currentUser as any)?.activeBranchId ||
                b.manager_id === currentUser?.id ||
                b.managerId === currentUser?.id ||
                (currentUser?.fullName && (b.manager_name === currentUser.fullName || b.managerName === currentUser.fullName)) ||
                currentUser?.roles?.some((r: any) =>
                  (r.role === 'BRANCH_MANAGER' || r.role === 'COACH') &&
                  (r.branchId === b.id || r.branch_id === b.id)
                )
              );
              const canEditThisBranch = isSuperAdmin || isClubAdmin || isThisBranchManager;

              return (
                <div
                  key={b.id}
                  className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-sky-300 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#0284C7]">
                        Code: {b.id.substring(0, 12)}...
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {b.status || 'Active'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-base text-slate-900 leading-snug">{b.name}</h4>
                      <p className="text-xs text-slate-500">{b.venue_name || b.venueName || 'Facility Tatami'}</p>
                    </div>

                    <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl px-2.5 py-1 text-[11px] text-sky-900 font-medium">
                      KT 3.0 Display Name: <span className="font-bold text-[#0284C7]">{club?.displayName || club?.display_name || club?.name}</span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <div className="flex items-center space-x-2">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{b.address ? `${b.address}, ` : ''}{b.city}, {b.state}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User size={13} className="text-slate-400 shrink-0" />
                        <span className="text-slate-400">Manager:</span>
                        <span className="font-bold text-slate-800">{b.managerName || b.manager_id || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock size={13} className="text-slate-400 shrink-0" />
                        <span>{b.operating_hours || b.operatingHours || 'Schedule not set'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    {canEditClub && (
                      <button
                        onClick={() => setAssignManagerModal({ isOpen: true, branchId: b.id, branchName: b.name })}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:underline"
                      >
                        {b.manager_id || b.managerName ? 'Change Manager' : 'Assign Manager'}
                      </button>
                    )}

                    {canEditThisBranch ? (
                      <button
                        onClick={() => setEditingBranch(b)}
                        className="py-1.5 px-3 bg-sky-50 text-[#0284C7] hover:bg-sky-100 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1 ml-auto"
                      >
                        <Edit2 size={12} />
                        <span>Edit Branch Profile</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic ml-auto">View only</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. OFFICIALS & STAFF TAB                                            */}
      {/* =================================================================== */}
      {activeTab === 'officials' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Officials & Staff Management</h2>
              <p className="text-xs text-slate-500">
                Governance leadership, certified coaches, branch managers, and operational staff for <strong className="text-slate-800">{club?.displayName || club?.name}</strong>.
              </p>
            </div>
            {canEditClub && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignClubAdminModal(true);
                    setAdminSearchTerm('');
                  }}
                  className="py-2.5 px-4 bg-sky-50 hover:bg-sky-100 text-[#0284C7] font-bold text-xs rounded-xl border border-sky-200 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <UserCheck size={15} />
                  <span>Change Primary Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignOfficialModal({ isOpen: true, member: null });
                    setSelectedOfficialRole('COACH');
                    setSelectedOfficialBranchId('');
                    setOfficialMemberSearch('');
                  }}
                  className="py-2.5 px-4 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Appoint Official</span>
                </button>
              </div>
            )}
          </div>

          {/* Primary Club Administrator Card */}
          <div className="bg-gradient-to-r from-sky-900 to-slate-900 rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-400/20 text-sky-200 border border-sky-400/30">
                  <ShieldCheck size={12} />
                  <span>Primary Club Administrator • Full Governance</span>
                </div>
                <h3 className="text-xl font-black tracking-tight text-white">
                  {club?.primary_admin_name || club?.primaryAdminName || 'No Primary Administrator Assigned'}
                </h3>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-sky-100/80">
                  <span className="flex items-center space-x-1.5">
                    <Mail size={13} className="text-sky-300" />
                    <span>{club?.primary_admin_email || club?.primaryAdminEmail || club?.email || 'No email registered'}</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <Phone size={13} className="text-sky-300" />
                    <span>{club?.primary_admin_phone || club?.primaryAdminPhone || club?.phone || 'No phone registered'}</span>
                  </span>
                </div>
              </div>

              {canEditClub && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignClubAdminModal(true);
                    setAdminSearchTerm('');
                  }}
                  className="px-4 py-2.5 bg-white text-slate-900 hover:bg-sky-50 font-bold text-xs rounded-xl transition-all shadow-sm shrink-0 flex items-center space-x-1.5 cursor-pointer"
                >
                  <UserCheck size={14} className="text-[#0284C7]" />
                  <span>Assign / Change Admin</span>
                </button>
              )}
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Officials & Staff</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{officialsList.length}</span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Appointed platform leaders</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Club Administrators</span>
              <span className="text-2xl font-black text-sky-600 mt-1 block">
                {officialsList.filter(o => o.roles?.some((r: string) => ['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(r.toUpperCase())) || o.id === club?.primary_admin_id).length}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Admins & Co-Admins</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Branch Managers</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {officialsList.filter(o => o.roles?.some((r: string) => r.toUpperCase() === 'BRANCH_MANAGER')).length}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Dojo location heads</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Coaches & Technical</span>
              <span className="text-2xl font-black text-purple-600 mt-1 block">
                {officialsList.filter(o => o.roles?.some((r: string) => ['COACH', 'ASSISTANT_COACH'].includes(r.toUpperCase()))).length}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Karate instructors</span>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={officialSearchTerm}
                  onChange={e => setOfficialSearchTerm(e.target.value)}
                  placeholder="Search officials by name, email, phone, role, or branch..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-[#0284C7] focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0">
                {(['ALL', 'ADMIN', 'MANAGER', 'COACH', 'STAFF'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setOfficialRoleFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      officialRoleFilter === f
                        ? 'bg-[#0284C7] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'ALL' && `All (${officialsList.length})`}
                    {f === 'ADMIN' && 'Admins'}
                    {f === 'MANAGER' && 'Branch Managers'}
                    {f === 'COACH' && 'Coaches'}
                    {f === 'STAFF' && 'Staff'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Officials Roster Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOfficials.length === 0 ? (
              <div className="col-span-full bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Users size={24} />
                </div>
                <h4 className="font-black text-slate-900 text-sm">No Officials Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {officialSearchTerm.trim() || officialRoleFilter !== 'ALL'
                    ? 'No officials match your current search or role filter criteria.'
                    : 'No officials have been appointed under this club roster yet.'}
                </p>
                {canEditClub && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssignOfficialModal({ isOpen: true, member: null });
                      setOfficialSearchTerm('');
                      setOfficialRoleFilter('ALL');
                    }}
                    className="px-4 py-2 bg-[#0284C7] text-white text-xs font-bold rounded-xl hover:bg-[#0369A1] transition-all"
                  >
                    Appoint First Official
                  </button>
                )}
              </div>
            ) : (
              filteredOfficials.map((o: any) => {
                const isPrimaryAdmin =
                  (club?.primary_admin_id && o.id === club.primary_admin_id) ||
                  (club?.primary_admin_email && o.email === club.primary_admin_email) ||
                  (club?.primaryAdminEmail && o.email === club.primaryAdminEmail) ||
                  (club?.primary_admin_name && (o.fullName === club.primary_admin_name || o.full_name === club.primary_admin_name));

                const branchName = branches.find(b => b.id === o.branchId)?.name;

                return (
                  <div
                    key={o.id}
                    className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-sky-300 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                            isPrimaryAdmin
                              ? 'bg-sky-100 text-sky-800 border border-sky-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {(o.fullName || o.full_name)?.charAt(0) || 'O'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate">
                              {o.fullName || o.full_name}
                            </h4>
                            <span className="text-[11px] text-slate-400 block truncate font-mono">
                              {o.email || 'No email registered'}
                            </span>
                          </div>
                        </div>

                        {isPrimaryAdmin && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-sky-100 text-sky-800 border border-sky-200 shrink-0">
                            Primary
                          </span>
                        )}
                      </div>

                      {/* Role Badges */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {(o.roles || ['OFFICIAL']).map((r: string, idx: number) => {
                          const rUpper = r.toUpperCase();
                          let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                          if (rUpper === 'CLUB_ADMIN') badgeStyle = 'bg-sky-50 text-sky-800 border-sky-200';
                          else if (rUpper === 'CLUB_CO_ADMIN') badgeStyle = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                          else if (rUpper === 'BRANCH_MANAGER') badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                          else if (rUpper.includes('COACH')) badgeStyle = 'bg-purple-50 text-purple-800 border-purple-200';
                          else if (rUpper.includes('OFFICER') || rUpper.includes('SECRETARY')) badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';

                          return (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeStyle}`}
                            >
                              {r.replace(/_/g, ' ')}
                            </span>
                          );
                        })}
                      </div>

                      {/* Contact & Branch Meta */}
                      <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                        {o.phone && (
                          <div className="flex items-center space-x-2 text-[11px]">
                            <Phone size={12} className="text-slate-400 shrink-0" />
                            <span>{o.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2 text-[11px]">
                          <GitBranch size={12} className="text-slate-400 shrink-0" />
                          <span className="text-slate-500">Branch:</span>
                          <span className="font-semibold text-slate-800 truncate">
                            {branchName || 'Club-Wide (All Branches)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {canEditClub && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignOfficialModal({ isOpen: true, member: o });
                            setSelectedOfficialRole(o.roles?.[0] || 'COACH');
                            setSelectedOfficialBranchId(o.branchId || '');
                          }}
                          className="text-xs font-bold text-[#0284C7] hover:underline"
                        >
                          Change Role / Dojo
                        </button>

                        {!isPrimaryAdmin && (
                          <button
                            type="button"
                            onClick={() => handleAssignClubAdmin(o)}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-sky-50 text-[#0284C7] hover:bg-sky-100 transition-colors cursor-pointer"
                          >
                            Promote to Admin
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* EDIT BRANCH PROFILE MODAL                                           */}
      {/* =================================================================== */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-black text-lg text-slate-900">Edit Branch Profile</h3>
                <p className="text-xs text-slate-500 font-mono">ID: {editingBranch.id}</p>
              </div>
              <button onClick={() => setEditingBranch(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateBranchProfile} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Parent Club (Immutable):</span>
                <span className="font-bold text-slate-900">{club?.name} ({club?.display_name || club?.displayName})</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Branch Name *</label>
                <input
                  name="name"
                  defaultValue={editingBranch.name}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Display Name</label>
                  <input
                    name="displayName"
                    defaultValue={editingBranch.display_name || editingBranch.displayName || ''}
                    placeholder="Short Display Name"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingBranch.status || 'Active'}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Facility / Venue Name *</label>
                <input
                  name="venueName"
                  defaultValue={editingBranch.venue_name || editingBranch.venueName || ''}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Address</label>
                <input
                  name="address"
                  defaultValue={editingBranch.address || ''}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7] mb-2"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    name="district"
                    placeholder="District"
                    defaultValue={editingBranch.district || ''}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <input
                    name="city"
                    placeholder="City"
                    defaultValue={editingBranch.city || ''}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <input
                    name="state"
                    placeholder="State"
                    defaultValue={editingBranch.state || 'Selangor'}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input
                    name="postcode"
                    placeholder="Postcode"
                    defaultValue={editingBranch.postcode || ''}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <input
                    name="country"
                    placeholder="Country"
                    defaultValue={editingBranch.country || 'Malaysia'}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Contact Phone</label>
                  <input
                    name="phone"
                    defaultValue={editingBranch.phone || ''}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Contact Email</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={editingBranch.email || ''}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Operating Hours</label>
                <input
                  name="operatingHours"
                  defaultValue={editingBranch.operating_hours || editingBranch.operatingHours || ''}
                  placeholder="e.g. Sat & Sun 9am-12pm"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBranch}
                  className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1"
                >
                  {savingBranch && <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-1" />}
                  <span>Save Branch Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE BRANCH MODAL */}
      {isAddBranchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900">Establish New Branch</h3>
              <button onClick={() => setIsAddBranchOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Branch Name *</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Cyberjaya Tatami Dojo"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Facility / Venue Name *</label>
                <input
                  name="venueName"
                  type="text"
                  required
                  placeholder="e.g. Cyberjaya Tatami Studio"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">City *</label>
                  <input
                    name="city"
                    type="text"
                    required
                    placeholder="e.g. Cyberjaya"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">State</label>
                  <input
                    name="state"
                    type="text"
                    defaultValue="Selangor"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddBranchOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN CLUB ADMIN FROM ALL MEMBERS */}
      {assignClubAdminModal && (
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
                  Select an active member from <strong>{club?.display_name || club?.name}</strong> ({clubMembers.length} available members) to assign as the primary administrator.
                </p>
              </div>
              <button
                onClick={() => {
                  setAssignClubAdminModal(false);
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
                  {clubMembers.length === 0
                    ? 'No members registered under this club yet.'
                    : `No matching club members found for "${adminSearchTerm}".`}
                </div>
              ) : (
                filteredAdminMembers.map((m: any) => {
                  const isCurrentAdmin =
                    (club?.primary_admin_id === m.id) ||
                    (club?.primary_admin_email === m.email) ||
                    (club?.primaryAdminEmail === m.email);

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors gap-3"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#0284C7] flex items-center justify-center font-black text-xs shrink-0">
                          {(m.fullName || m.full_name)?.charAt(0) || 'M'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs truncate">{m.fullName || m.full_name}</span>
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
                  setAssignClubAdminModal(false);
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

      {/* MODAL: ASSIGN BRANCH MANAGER FROM ALL MEMBERS */}
      {assignManagerModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2 text-[#0284C7] text-xs font-bold uppercase tracking-wider">
                  <GitBranch size={14} />
                  <span>Branch Manager Assignment</span>
                </div>
                <h3 className="font-black text-xl text-slate-900 tracking-tight mt-0.5">
                  Assign Manager: {assignManagerModal.branchName}
                </h3>
                <p className="text-xs text-slate-500">
                  Select an active member from <strong>{club?.display_name || club?.name}</strong> ({clubMembers.length} available members) to manage this branch location.
                </p>
              </div>
              <button
                onClick={() => {
                  setAssignManagerModal({ isOpen: false, branchId: null, branchName: '' });
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
                  {clubMembers.length === 0
                    ? 'No members registered under this club yet.'
                    : `No matching club members found for "${branchManagerSearchTerm}".`}
                </div>
              ) : (
                filteredBranchMembers.map((m: any) => {
                  const currentBranch = branches.find(b => b.id === assignManagerModal.branchId);
                  const isCurrentBranchMgr =
                    currentBranch?.manager_id === m.id ||
                    currentBranch?.managerId === m.id ||
                    currentBranch?.manager_name === (m.fullName || m.full_name) ||
                    currentBranch?.managerName === (m.fullName || m.full_name);

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors gap-3"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                          {(m.fullName || m.full_name)?.charAt(0) || 'M'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs truncate">{m.fullName || m.full_name}</span>
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
                  setAssignManagerModal({ isOpen: false, branchId: null, branchName: '' });
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

      {/* MODAL: APPOINT / CHANGE OFFICIAL ROLE */}
      {assignOfficialModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2 text-[#0284C7] text-xs font-bold uppercase tracking-wider">
                  <Award size={14} />
                  <span>Official Appointment</span>
                </div>
                <h3 className="font-black text-xl text-slate-900 tracking-tight mt-0.5">
                  {assignOfficialModal.member ? 'Update Official Role' : 'Appoint Club Official'}
                </h3>
                <p className="text-xs text-slate-500">
                  Assign administrative, technical coaching, or operational responsibilities for {club?.displayName || club?.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignOfficialModal({ isOpen: false, member: null })}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Member Selection if not pre-selected */}
            {!assignOfficialModal.member ? (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Select Member from Club Roster *
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={officialMemberSearch}
                    onChange={e => setOfficialMemberSearch(e.target.value)}
                    placeholder="Search roster by name, email, or IC..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-[#0284C7]"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {filteredMembersForOfficialAssignment.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No members found.</div>
                  ) : (
                    filteredMembersForOfficialAssignment.slice(0, 30).map((m: any) => (
                      <div
                        key={m.id}
                        onClick={() => setAssignOfficialModal(prev => ({ ...prev, member: m }))}
                        className="p-3 flex items-center justify-between hover:bg-sky-50/60 cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-900">{m.fullName || m.full_name}</div>
                          <div className="text-[11px] text-slate-400">{m.email || 'No email'}</div>
                        </div>
                        <span className="text-[10px] font-bold text-[#0284C7] bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          Select
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-sky-50/60 border border-sky-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-[#0284C7] flex items-center justify-center font-black text-sm">
                    {(assignOfficialModal.member.fullName || assignOfficialModal.member.full_name)?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      {assignOfficialModal.member.fullName || assignOfficialModal.member.full_name}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono">
                      {assignOfficialModal.member.email || assignOfficialModal.member.phone || 'Club Member'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignOfficialModal(prev => ({ ...prev, member: null }))}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
                >
                  Change Member
                </button>
              </div>
            )}

            {/* Role Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Appointed Role *
              </label>
              <select
                value={selectedOfficialRole}
                onChange={e => setSelectedOfficialRole(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7]"
              >
                <option value="COACH">Sensei / Head Coach</option>
                <option value="ASSISTANT_COACH">Assistant Coach / Instructor</option>
                <option value="CLUB_CO_ADMIN">Club Co-Administrator</option>
                <option value="BRANCH_MANAGER">Branch Dojo Manager</option>
                <option value="REGISTRATION_OFFICER">Registration & Compliance Officer</option>
                <option value="OFFICIAL">General Operations Official</option>
                <option value="SECRETARY">Honorary Secretary</option>
                <option value="TREASURER">Honorary Treasurer</option>
              </select>
            </div>

            {/* Branch Assignment */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Assigned Dojo / Branch Location
              </label>
              <select
                value={selectedOfficialBranchId}
                onChange={e => setSelectedOfficialBranchId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0284C7]"
              >
                <option value="">Club-Wide (All Branches / HQ)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city || 'Dojo'})
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setAssignOfficialModal({ isOpen: false, member: null })}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!assignOfficialModal.member || assigningOfficialRole}
                onClick={() =>
                  handleAssignOfficialRole(
                    assignOfficialModal.member,
                    selectedOfficialRole,
                    selectedOfficialBranchId
                  )
                }
                className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                {assigningOfficialRole && (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                )}
                <span>Confirm Appointment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
