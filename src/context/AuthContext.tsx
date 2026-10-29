'use client';

/**
 * Scms Authentication & Session Context
 * Enforces RBAC (14 Roles), Multi-Tenant Isolation, Multi-Branch Filtering, Multi-Role Switching,
 * and User Profile Onboarding Management.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { User, SystemRole, Club, ClubBranch } from '@/types';
import { store } from '@/lib/store';

interface AuthContextType {
  currentUser: User | null;
  activeRole: SystemRole;
  activeClub: Club | null;
  activeBranch: ClubBranch | null;
  authorizedClubs: Club[];
  authorizedBranches: ClubBranch[];
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: SystemRole, clubId?: string, branchId?: string) => void;
  switchClub: (clubId: string) => void;
  switchBranch: (branchId: string) => void;
  hasRole: (roles: SystemRole[]) => boolean;
  canAccessClub: (clubId: string) => boolean;
  canAccessBranch: (branchId: string) => boolean;
  updateProfile: (data: Partial<User> | string, phone?: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<SystemRole>('MEMBER');
  const [activeClubId, setActiveClubId] = useState<string | undefined>(undefined);
  const [activeBranchId, setActiveBranchId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const [dbClubs, setDbClubs] = useState<Club[]>([]);
  const [dbBranches, setDbBranches] = useState<ClubBranch[]>([]);

  // Compute all available clubs merging DB clubs with store clubs
  const allKnownClubs = React.useMemo(() => {
    const map = new Map<string, Club>();
    store.getClubs().forEach(c => map.set(c.id, c));
    dbClubs.forEach(c => map.set(c.id, c));
    return Array.from(map.values());
  }, [dbClubs]);

  // Compute all available branches merging DB branches with store branches
  const allKnownBranches = React.useMemo(() => {
    const map = new Map<string, ClubBranch>();
    store.getBranches().forEach(b => map.set(b.id, b));
    dbBranches.forEach(b => map.set(b.id, b));
    return Array.from(map.values());
  }, [dbBranches]);

  // Sync active club & branch objects
  const activeClub = activeClubId ? allKnownClubs.find(c => c.id === activeClubId) || null : null;
  const activeBranch = (activeBranchId && activeBranchId !== '__ALL__')
    ? allKnownBranches.find(b => b.id === activeBranchId) || null
    : null;

  const loadSession = useCallback(async (userObj?: any) => {
    try {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();

      // Protected fetch with 3.5s timeout so network stalls never cause infinite loading
      const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
        setTimeout(() => resolve({ timeout: true }), 3500)
      );

      const fetchPromise = Promise.all([
        supabase.from('clubs').select('*').order('name'),
        supabase.from('club_branches').select('*').order('name')
      ]);

      const res: any = await Promise.race([fetchPromise, timeoutPromise]);

      if (res && !res.timeout && Array.isArray(res)) {
        const [clubsRes, branchesRes] = res;

        if (clubsRes?.data) {
          const mappedClubs: Club[] = clubsRes.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            displayName: c.display_name,
            shortName: c.short_name || c.display_name || c.name,
            registrationNo: c.registration_no || '',
            establishedYear: c.established_year || 2020,
            sport: c.sport || 'Karate',
            address: c.address || '',
            city: c.city || '',
            state: c.state || '',
            postcode: c.postcode || '',
            country: c.country || 'Malaysia',
            phone: c.phone || '',
            email: c.email || '',
            status: c.status || 'Active',
            primaryAdminId: c.primary_admin_id,
            createdAt: c.created_at || new Date().toISOString(),
            updatedAt: c.updated_at || new Date().toISOString(),
          }));
          setDbClubs(mappedClubs);
        }

        if (branchesRes?.data) {
          const mappedBranches: ClubBranch[] = branchesRes.data.map((b: any) => ({
            id: b.id,
            clubId: b.club_id,
            name: b.name,
            address: b.address || '',
            city: b.city || '',
            state: b.state || '',
            postcode: b.postcode || '',
            country: b.country || 'Malaysia',
            phone: b.phone || '',
            email: b.email || '',
            venueName: b.venue_name || b.name,
            managerId: b.manager_id,
            status: b.status || 'Active',
            createdAt: b.created_at || new Date().toISOString(),
            updatedAt: b.updated_at || new Date().toISOString(),
          }));
          setDbBranches(mappedBranches);
        }
      }

      let user = userObj;
      if (!user) {
        const { data } = await supabase.auth.getUser();
        user = data.user;
      }

      if (user) {
        if (user.user_metadata?.temp_password && typeof window !== 'undefined' && !window.location.pathname.includes('/update-password')) {
          window.location.href = '/update-password';
          return;
        }

        // Fetch user profile from DB
        const [userRoleRes, profileRes] = await Promise.all([
          supabase
            .from('user_roles')
            .select('role, club_id, branch_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()
        ]);

        const userRole = userRoleRes.data;
        const profile = profileRes.data;

        const dbRole = userRole?.role || 'MEMBER';
        const dbClubId = userRole?.club_id;
        const dbBranchId = userRole?.branch_id;

        // Mock-store (Scms-) fallback: roles/branch assignments live in localStorage
        const { resolveMockRole } = await import('@/lib/mockRole');
        const mock = resolveMockRole(user.email, user.user_metadata?.full_name);
        const role = (dbRole !== 'MEMBER' ? dbRole : mock?.role || dbRole) as SystemRole;
        const assignedClubId = dbClubId || mock?.clubId;
        const assignedBranchId = dbBranchId || mock?.branchId;

        const mockUser: User = {
          id: user.id,
          email: user.email || '',
          fullName: profile?.full_name || user.user_metadata?.full_name || mock?.fullName || 'User',
          phone: profile?.phone || '',
          avatarUrl: profile?.avatar_url || '',
          icPassport: profile?.ic_passport || '',
          residentialAddress: profile?.residential_address || '',
          emergencyContactName: profile?.emergency_contact_name || '',
          emergencyContactPhone: profile?.emergency_contact_phone || '',
          preferredNadiCentre: profile?.preferred_nadi_centre || '',
          onboardingCompleted: profile ? profile.onboarding_completed === true : false,
          preferredLanguage: (profile?.preferred_language as 'en' | 'ms') || 'en',
          photoVisibility: (profile?.photo_visibility as any) || 'CLUB_ONLY',
          otherInfo: profile?.other_info || '',
          status: 'Active',
          roles: [{ role, clubId: assignedClubId, branchId: assignedBranchId, grantedAt: new Date().toISOString() }],
          activeRole: role,
          activeClubId: assignedClubId,
          activeBranchId: assignedBranchId,
          createdAt: user.created_at,
        };

        setCurrentUser(mockUser);
        setActiveRole(role);
        if (assignedClubId) setActiveClubId(assignedClubId);
        if (assignedBranchId) setActiveBranchId(assignedBranchId);
      } else {
        setCurrentUser(null);
        setActiveRole('MEMBER');
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let subscription: any;
    let disposed = false;

    // Safety fallback: ensure loading spinner is dismissed within 3.5s no matter what
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 3500);

    loadSession();

    // Listen for auth state changes
    import('@/utils/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          loadSession(session?.user);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setActiveRole('MEMBER');
          setActiveClubId(undefined);
          setActiveBranchId(undefined);
        }
      });
      subscription = data.subscription;
      if (disposed) subscription.unsubscribe();
    }).catch(() => {
      setIsLoading(false);
    });

    return () => {
      disposed = true;
      clearTimeout(safetyTimer);
      if (subscription) subscription.unsubscribe();
    };
  }, [loadSession]);

  // Compute authorized clubs for current user
  const authorizedClubs = React.useMemo(() => {
    if (!currentUser) return [];
    if (['SUPERADMIN', 'SYSTEM_ADMIN', 'OBSERVER'].includes(activeRole)) {
      return allKnownClubs;
    }
    const permittedClubIds = new Set(
      currentUser.roles.filter(r => r.clubId).map(r => r.clubId!)
    );
    return allKnownClubs.filter(c => permittedClubIds.has(c.id));
  }, [currentUser, activeRole, allKnownClubs]);

  // Compute authorized branches for current club
  const authorizedBranches = React.useMemo(() => {
    if (!currentUser || !activeClubId) return [];
    const clubBranches = allKnownBranches.filter(b => b.clubId === activeClubId);

    if (['SUPERADMIN', 'SYSTEM_ADMIN', 'OBSERVER', 'CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(activeRole)) {
      return clubBranches;
    }

    const permittedBranchIds = new Set(
      currentUser.roles
        .filter(r => r.clubId === activeClubId && r.branchId)
        .map(r => r.branchId!)
    );

    if (permittedBranchIds.size > 0) {
      return clubBranches.filter(b => permittedBranchIds.has(b.id));
    }
    return clubBranches;
  }, [currentUser, activeClubId, activeRole, allKnownBranches]);

  useEffect(() => {
    if (authorizedClubs.length > 0 && (!activeClubId || !authorizedClubs.some(c => c.id === activeClubId))) {
      setActiveClubId(authorizedClubs[0].id);
    }
  }, [authorizedClubs, activeClubId]);

  useEffect(() => {
    if (authorizedBranches.length > 0) {
      if (activeBranchId === '__ALL__') return;
      if (!activeBranchId || !authorizedBranches.some(b => b.id === activeBranchId)) {
        setActiveBranchId(authorizedBranches[0].id);
      }
    }
  }, [authorizedBranches, activeBranchId]);

  const login = async (email: string, _password?: string): Promise<boolean> => {
    const user = store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      setCurrentUser(user);
      setActiveRole(user.activeRole);
      setActiveClubId(user.activeClubId);
      setActiveBranchId(user.activeBranchId);
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    setActiveRole('MEMBER');
    setActiveClubId(undefined);
    setActiveBranchId(undefined);
  };

  const switchRole = (role: SystemRole, clubId?: string, branchId?: string) => {
    if (!currentUser) return;
    const hasRoleAssignment = currentUser.roles.some(r => r.role === role);
    if (!hasRoleAssignment && currentUser.activeRole !== 'SUPERADMIN') {
      console.warn(`Role elevation denied: User does not possess role ${role}`);
      return;
    }

    setActiveRole(role);
    if (clubId) setActiveClubId(clubId);
    if (branchId) setActiveBranchId(branchId);
  };

  const switchClub = (clubId: string) => {
    if (canAccessClub(clubId)) {
      setActiveClubId(clubId);
      const branches = allKnownBranches.filter(b => b.clubId === clubId);
      if (branches.length > 0) {
        if (activeBranchId !== '__ALL__') {
          setActiveBranchId(branches[0].id);
        }
      } else {
        setActiveBranchId(undefined);
      }
    }
  };

  const switchBranch = (branchId: string) => {
    if (!branchId || branchId === '__ALL__') {
      setActiveBranchId('__ALL__');
      return;
    }
    if (canAccessBranch(branchId)) {
      setActiveBranchId(branchId);
    }
  };

  const hasRole = (roles: SystemRole[]): boolean => {
    return roles.includes(activeRole);
  };

  const canAccessClub = (clubId: string): boolean => {
    if (['SUPERADMIN', 'SYSTEM_ADMIN', 'OBSERVER'].includes(activeRole)) return true;
    if (clubId.startsWith('Scms-')) return true;
    return authorizedClubs.some(c => c.id === clubId) || currentUser?.roles?.some(r => r.clubId === clubId) || false;
  };

  const canAccessBranch = (branchId: string): boolean => {
    if (!branchId || branchId === '__ALL__') return true;
    if (['SUPERADMIN', 'SYSTEM_ADMIN', 'OBSERVER', 'CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(activeRole)) return true;
    if (branchId.startsWith('Scms-')) return true;
    return authorizedBranches.some(b => b.id === branchId) || currentUser?.roles?.some(r => r.branchId === branchId) || false;
  };

  const updateProfile = async (dataOrName: Partial<User> | string, phoneParam?: string): Promise<boolean> => {
    try {
      const updates: Partial<User> = typeof dataOrName === 'string'
        ? { fullName: dataOrName, phone: phoneParam }
        : dataOrName;

      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Prepare DB profile payload
        const profileUpdate: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.fullName !== undefined) profileUpdate.full_name = updates.fullName;
        if (updates.phone !== undefined) profileUpdate.phone = updates.phone;
        if (updates.icPassport !== undefined) profileUpdate.ic_passport = updates.icPassport;
        if (updates.residentialAddress !== undefined) profileUpdate.residential_address = updates.residentialAddress;
        if (updates.emergencyContactName !== undefined) profileUpdate.emergency_contact_name = updates.emergencyContactName;
        if (updates.emergencyContactPhone !== undefined) profileUpdate.emergency_contact_phone = updates.emergencyContactPhone;
        if (updates.preferredNadiCentre !== undefined) profileUpdate.preferred_nadi_centre = updates.preferredNadiCentre;
        if (updates.avatarUrl !== undefined) profileUpdate.avatar_url = updates.avatarUrl;
        if (updates.photoVisibility !== undefined) profileUpdate.photo_visibility = updates.photoVisibility;
        if (updates.onboardingCompleted !== undefined) profileUpdate.onboarding_completed = updates.onboardingCompleted;
        if (updates.preferredLanguage !== undefined) profileUpdate.preferred_language = updates.preferredLanguage;
        if (updates.otherInfo !== undefined) profileUpdate.other_info = updates.otherInfo;

        const { error: profileErr } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', session.user.id);

        if (profileErr) console.warn('Supabase profiles update warning:', profileErr);

        if (updates.fullName || updates.phone) {
          await supabase.auth.updateUser({
            data: { 
              full_name: updates.fullName, 
              phone: updates.phone 
            }
          });
        }
      }
      
      // Update local state
      if (currentUser) {
        const updatedUser = { ...currentUser, ...updates };
        setCurrentUser(updatedUser);
        store.updateUser(currentUser.id, { 
          fullName: updates.fullName || currentUser.fullName, 
          phone: updates.phone !== undefined ? updates.phone : currentUser.phone 
        });
      }
      
      return true;
    } catch (e) {
      console.error('Failed to update profile', e);
      return false;
    }
  };

  const refreshSession = async () => {
    await loadSession();
  };

  // Only show full-screen loader on protected routes during initial 3.5s
  if (isLoading && pathname !== '/login' && pathname !== '/' && !pathname.startsWith('/api/')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600"></div>
        <p className="text-xs font-medium text-slate-500">Loading your workspace…</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole,
        activeClub,
        activeBranch,
        authorizedClubs,
        authorizedBranches,
        isLoading,
        login,
        logout,
        switchRole,
        switchClub,
        switchBranch,
        hasRole,
        canAccessClub,
        canAccessBranch,
        updateProfile,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
