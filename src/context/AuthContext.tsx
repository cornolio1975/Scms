'use client';

/**
 * Scms Authentication & Session Context
 * Enforces RBAC (14 Roles), Multi-Tenant Isolation, Multi-Branch Filtering, and Multi-Role Switching
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SystemRole, Club, ClubBranch } from '@/types';
import { store, INITIAL_USERS } from '@/lib/store';

interface AuthContextType {
  currentUser: User | null;
  activeRole: SystemRole;
  activeClub: Club | null;
  activeBranch: ClubBranch | null;
  authorizedClubs: Club[];
  authorizedBranches: ClubBranch[];
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: SystemRole, clubId?: string, branchId?: string) => void;
  switchClub: (clubId: string) => void;
  switchBranch: (branchId: string) => void;
  hasRole: (roles: SystemRole[]) => boolean;
  canAccessClub: (clubId: string) => boolean;
  canAccessBranch: (branchId: string) => boolean;
  updateProfile: (fullName: string, phone?: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
    // First store mock clubs
    store.getClubs().forEach(c => map.set(c.id, c));
    // Then db clubs override or add
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

  useEffect(() => {
    let subscription: any;

    async function loadSession(userObj?: any) {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();

        // Concurrently fetch clubs and branches from Supabase
        const [clubsRes, branchesRes] = await Promise.all([
          supabase.from('clubs').select('*').order('name'),
          supabase.from('club_branches').select('*').order('name')
        ]);

        if (clubsRes.data) {
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

        if (branchesRes.data) {
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

          // Fetch actual role from DB
          const { data: userRole } = await supabase
            .from('user_roles')
            .select('role, club_id, branch_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
            
          const dbRole = userRole?.role || 'MEMBER';
          const dbClubId = userRole?.club_id;
          const dbBranchId = userRole?.branch_id;

          // Mock-store (Scms-) fallback: roles/branch assignments live in localStorage
          const { resolveMockRole } = await import('@/lib/mockRole');
          const mock = resolveMockRole(user.email, user.user_metadata?.full_name);
          const role = (dbRole !== 'MEMBER' ? dbRole : mock?.role || dbRole) as SystemRole;
          const assignedClubId = dbClubId || mock?.clubId;
          const assignedBranchId = dbBranchId || mock?.branchId;
          
          // Create a mock User object from session for context compatibility
          const mockUser: User = {
            id: user.id,
            email: user.email || '',
            fullName: user.user_metadata?.full_name || mock?.fullName || 'User',
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
    }

    loadSession();

    // Listen for auth changes
    import('@/utils/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          loadSession(session?.user);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setActiveRole('MEMBER');
        }
      });
      subscription = data.subscription;
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

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

    // If user has branch-specific roles, filter; otherwise if club-level, show all
    if (permittedBranchIds.size > 0) {
      return clubBranches.filter(b => permittedBranchIds.has(b.id));
    }
    return clubBranches;
  }, [currentUser, activeClubId, activeRole, allKnownBranches]);

  // Auto-select first authorized club & branch if none active
  useEffect(() => {
    if (authorizedClubs.length > 0 && (!activeClubId || !authorizedClubs.some(c => c.id === activeClubId))) {
      const defaultClub = authorizedClubs[0];
      setActiveClubId(defaultClub.id);
    }
  }, [authorizedClubs, activeClubId]);

  useEffect(() => {
    if (authorizedBranches.length > 0) {
      if (activeBranchId === '__ALL__') {
        return;
      }
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

  const updateProfile = async (fullName: string, phone?: string): Promise<boolean> => {
    try {
      // 1. Try to update Supabase if signed in
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.auth.updateUser({
          data: { full_name: fullName, phone: phone }
        });
        if (error) console.error('Supabase profile update failed:', error);
      }
      
      // 2. Also update local mock store user just in case
      if (currentUser) {
        store.updateUser(currentUser.id, { fullName, phone });
        setCurrentUser({ ...currentUser, fullName });
      }
      
      return true;
    } catch (e) {
      console.error('Failed to update profile', e);
      return false;
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>;
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
        login,
        logout,
        switchRole,
        switchClub,
        switchBranch,
        hasRole,
        canAccessClub,
        canAccessBranch,
        updateProfile,
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
