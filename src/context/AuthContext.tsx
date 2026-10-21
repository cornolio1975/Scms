'use client';

/**
 * Scms Authentication & Session Context
 * Enforces RBAC (14 Roles), Multi-Tenant Isolation, Multi-Branch Filtering, and Multi-Role Switching
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SystemRole, Club, ClubBranch } from '@/types';
import { store } from '@/lib/store';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<SystemRole>('MEMBER');
  const [activeClubId, setActiveClubId] = useState<string | undefined>(undefined);
  const [activeBranchId, setActiveBranchId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Sync active club & branch objects
  const activeClub = activeClubId ? store.getClubById(activeClubId) || null : null;
  const activeBranch = activeBranchId ? store.getBranches().find(b => b.id === activeBranchId) || null : null;

  useEffect(() => {
    async function loadSession() {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Load the complete DB-backed role scope. Authorization must not be
          // reconstructed from browser state or user metadata.
          const [{ data: profile }, { data: roleRows }] = await Promise.all([
            supabase
              .from('profiles')
              .select('full_name, phone, status')
              .eq('id', user.id)
              .single(),
            supabase
              .from('user_roles')
              .select('role, club_id, branch_id, granted_at')
              .eq('user_id', user.id)
              .order('granted_at', { ascending: true }),
          ]);

          const roles = (roleRows || []).map(row => ({
            role: row.role as SystemRole,
            clubId: row.club_id || undefined,
            branchId: row.branch_id || undefined,
            grantedAt: row.granted_at || user.created_at,
          }));

          const role = roles[0]?.role || 'MEMBER';
          const scopedRole = roles.find(assignment => assignment.role === role);
          const profileStatus =
            profile?.status === 'SUSPENDED'
              ? 'Suspended'
              : profile?.status === 'INACTIVE'
                ? 'Inactive'
                : 'Active';

          const sessionUser: User = {
            id: user.id,
            email: user.email || '',
            fullName: profile?.full_name || user.user_metadata?.full_name || 'User',
            phone: profile?.phone || undefined,
            status: profileStatus,
            roles,
            activeRole: role,
            activeClubId: scopedRole?.clubId,
            activeBranchId: scopedRole?.branchId,
            createdAt: user.created_at,
          };

          setCurrentUser(sessionUser);
          setActiveRole(role);
          setActiveClubId(scopedRole?.clubId);
          setActiveBranchId(scopedRole?.branchId);
        }
      } catch (e) {
        console.error('Failed to load session:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, []);

  // Compute authorized clubs for current user
  const authorizedClubs = React.useMemo(() => {
    if (!currentUser) return [];
    if (['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole)) {
      return store.getClubs();
    }
    const permittedClubIds = new Set(
      currentUser.roles.filter(r => r.clubId).map(r => r.clubId!)
    );
    return store.getClubs().filter(c => permittedClubIds.has(c.id));
  }, [currentUser, activeRole]);

  // Compute authorized branches for current club
  const authorizedBranches = React.useMemo(() => {
    if (!currentUser || !activeClubId) return [];
    const clubBranches = store.getBranches(activeClubId);

    if (['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(activeRole)) {
      return clubBranches;
    }

    const permittedBranchIds = new Set(
      currentUser.roles
        .filter(r => r.clubId === activeClubId && r.branchId)
        .map(r => r.branchId!)
    );

    // Branch-scoped roles never inherit access to every branch simply because
    // their assignment is incomplete. Club-level admins are handled above.
    if (permittedBranchIds.size > 0) {
      return clubBranches.filter(b => permittedBranchIds.has(b.id));
    }
    return [];
  }, [currentUser, activeClubId, activeRole]);

  // Auto-select first authorized club & branch if none active
  useEffect(() => {
    if (authorizedClubs.length > 0 && (!activeClubId || !authorizedClubs.some(c => c.id === activeClubId))) {
      const defaultClub = authorizedClubs[0];
      setActiveClubId(defaultClub.id);
    }
  }, [authorizedClubs, activeClubId]);

  useEffect(() => {
    if (authorizedBranches.length > 0 && (!activeBranchId || !authorizedBranches.some(b => b.id === activeBranchId))) {
      setActiveBranchId(authorizedBranches[0].id);
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
      const clubBranches = store.getBranches(clubId);
      const permittedBranchIds = new Set(
        currentUser?.roles
          .filter(r => r.clubId === clubId && r.branchId)
          .map(r => r.branchId!) || []
      );
      const branches = ['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(activeRole)
        ? clubBranches
        : clubBranches.filter(branch => permittedBranchIds.has(branch.id));

      if (branches.length > 0) {
        setActiveBranchId(branches[0].id);
      } else {
        setActiveBranchId(undefined);
      }
    }
  };

  const switchBranch = (branchId: string) => {
    if (canAccessBranch(branchId)) {
      setActiveBranchId(branchId);
    }
  };

  const hasRole = (roles: SystemRole[]): boolean => {
    return roles.includes(activeRole);
  };

  const canAccessClub = (clubId: string): boolean => {
    if (['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole)) return true;
    return authorizedClubs.some(c => c.id === clubId);
  };

  const canAccessBranch = (branchId: string): boolean => {
    if (['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole)) return true;
    if (['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(activeRole)) {
      return store.getBranches(activeClubId).some(b => b.id === branchId);
    }
    return authorizedBranches.some(b => b.id === branchId);
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
