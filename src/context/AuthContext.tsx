"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, SystemRole, Club, ClubBranch } from "@/types";
import { sortAssignments, type Assignment } from "@/lib/scms/access";
import { createClient } from "@/utils/supabase/client";
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
  switchClub: (id: string) => void;
  switchBranch: (id: string) => void;
  hasRole: (roles: SystemRole[]) => boolean;
  canAccessClub: (id: string) => boolean;
  canAccessBranch: (id: string) => boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setUser] = useState<User | null>(null),
    [activeRole, setRole] = useState<SystemRole>("MEMBER"),
    [clubId, setClub] = useState(""),
    [branchId, setBranch] = useState(""),
    [clubs, setClubs] = useState<Club[]>([]),
    [branches, setBranches] = useState<ClubBranch[]>([]);
  useEffect(() => {
    const db = createClient();
    let live = true;
    async function load() {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!live) return;
      if (!user) {
        setUser(null);
        setClubs([]);
        setBranches([]);
        return;
      }
      const [rs, ps, cs, bs] = await Promise.all([
        db
          .from("user_roles")
          .select("role,club_id,branch_id,granted_at")
          .eq("user_id", user.id),
        db
          .from("profiles")
          .select("full_name,phone,status")
          .eq("id", user.id)
          .single(),
        db.from("clubs").select("*"),
        db.from("club_branches").select("*"),
      ]);
      if (!live) return;
      if (rs.error || ps.error) {
        setUser(null);
        return;
      }
      const assignments = sortAssignments((rs.data || []) as Assignment[]);
      const role = (assignments[0]?.role || "MEMBER") as SystemRole;
      setUser({
        id: user.id,
        email: user.email || "",
        fullName: ps.data.full_name || "",
        phone: ps.data.phone,
        roles: assignments.map((r) => ({
          role: r.role as SystemRole,
          clubId: r.club_id || undefined,
          branchId: r.branch_id || undefined,
          grantedAt: r.granted_at || "",
        })),
        activeRole: role,
        status:
          ps.data.status === "ACTIVE"
            ? "Active"
            : ps.data.status === "SUSPENDED"
              ? "Suspended"
              : "Inactive",
        createdAt: user.created_at,
      });
      setRole(role);
      setClubs(
        (cs.data || []).map((c) => ({
          id: c.id,
          name: c.name,
          shortName: c.display_name || c.short_name || c.name,
          sport: c.sport || "",
          registrationNo: c.registration_no || "",
          establishedYear: c.established_year || 0,
          address: c.address || "",
          city: c.city || "",
          state: c.state || "",
          postcode: c.postcode || "",
          country: c.country || "Malaysia",
          phone: c.phone || "",
          email: c.email || "",
          status: c.status,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
      );
      setBranches(
        (bs.data || []).map((b) => ({
          id: b.id,
          clubId: b.club_id,
          name: b.name,
          address: b.address || "",
          city: b.city || "",
          state: b.state || "",
          postcode: b.postcode || "",
          country: b.country || "Malaysia",
          phone: b.phone || "",
          email: b.email || "",
          venueName: b.venue_name || "",
          status: b.status,
          createdAt: b.created_at,
          updatedAt: b.updated_at,
        })),
      );
      setClub(
        (c) =>
          c ||
          assignments.find((r) => r.club_id)?.club_id ||
          cs.data?.[0]?.id ||
          "",
      );
      setBranch(
        (b) => b || assignments.find((r) => r.branch_id)?.branch_id || "",
      );
    }
    void load();
    const { data: sub } = db.auth.onAuthStateChange(() => {
      queueMicrotask(() => {
        if (live) void load();
      });
    });
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const authorizedClubs = clubs;
  const authorizedBranches = branches.filter((b) => b.clubId === clubId);
  const activeClub = clubs.find((c) => c.id === clubId) || null,
    activeBranch = authorizedBranches.find((b) => b.id === branchId) || null;
  const login = async (email: string, password?: string) => {
    if (!password) return false;
    const { error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error) return false;
    window.location.assign("/api/auth/route-dispatch");
    return true;
  };
  const logout = async () => {
    const { error } = await createClient().auth.signOut({ scope: "local" });
    if (error) throw error;
    setUser(null);
    setClubs([]);
    setBranches([]);
    window.location.assign("/login");
  };
  function switchRole(role: SystemRole, c?: string, b?: string) {
    if (
      currentUser?.roles.some(
        (r) =>
          r.role === role &&
          (!c || r.clubId === c || !r.clubId) &&
          (!b || r.branchId === b || !r.branchId),
      )
    ) {
      setRole(role);
      if (c) setClub(c);
      if (b) setBranch(b);
    }
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
        switchClub: (id) => {
          if (clubs.some((c) => c.id === id)) {
            setClub(id);
            setBranch("");
          }
        },
        switchBranch: (id) => {
          if (authorizedBranches.some((b) => b.id === id)) setBranch(id);
        },
        hasRole: (rs) => rs.includes(activeRole),
        canAccessClub: (id) => clubs.some((c) => c.id === id),
        canAccessBranch: (id) => authorizedBranches.some((b) => b.id === id),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw Error("useAuth must be used within AuthProvider");
  return c;
}
