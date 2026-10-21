'use client';

/**
 * Scms Desktop Sidebar Navigation
 * Strict Rule 26 & 27: LEFT = LIGHT BLUE NAVIGATION (240–280px), RIGHT = WHITE WORKSPACE
 * Fully role-based menu items with submenus, collapsible state, and active indicators
 */

import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  HeartHandshake,
  CalendarCheck2,
  CreditCard,
  GraduationCap,
  Award,
  CalendarDays,
  Trophy,
  MessageSquare,
  CheckSquare,
  ShieldCheck,
  BarChart3,
  FileText,
  UserCheck,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  GitBranch,
} from 'lucide-react';

interface SidebarProps {
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles?: string[]; // If undefined, visible to all
  badge?: number | string;
  subItems?: { id: string; label: string }[];
}

export default function Sidebar({
  currentModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { activeRole, activeClub, activeBranch } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    club: false,
    members: false,
    volunteers: false,
    attendance: false,
    finance: false,
    training: false,
    tournaments: false,
  });

  const toggleSubmenu = (menuId: string) => {
    setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const menuSections: { title?: string; items: MenuItem[] }[] = [
    {
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        {
          id: 'all-clubs',
          label: 'All Clubs Governance',
          icon: Building2,
          roles: ['SUPERADMIN', 'SYSTEM_ADMIN'],
        },
        {
          id: 'club-profile',
          label: 'Club Profile',
          icon: Building2,
          roles: ['CLUB_ADMIN', 'CLUB_CO_ADMIN', 'OBSERVER'],
        },
        {
          id: 'branch-profile',
          label: 'Branch Dojo Profile',
          icon: GitBranch,
          roles: ['BRANCH_MANAGER'],
        },
        {
          id: 'club',
          label: 'Club Management',
          icon: Building2,
          roles: ['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN', 'CLUB_CO_ADMIN', 'OBSERVER'],
          subItems: [
            { id: 'all-clubs', label: 'All Clubs Directory' },
            { id: 'club-profile', label: 'Club Profile' },
            { id: 'onboarding', label: 'Onboarding Wizard' },
          ],
        },
        {
          id: 'members',
          label: 'Members & Athletes',
          icon: Users,
          roles: ['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN', 'CLUB_CO_ADMIN', 'BRANCH_MANAGER', 'COACH', 'REGISTRATION_OFFICER'],
        },
        {
          id: 'volunteers',
          label: 'Volunteers',
          icon: HeartHandshake,
          badge: 'Active',
          subItems: [
            { id: 'all-volunteers', label: 'Volunteer Registry' },
            { id: 'assignments', label: 'Assignments' },
            { id: 'volunteer-checkin', label: 'Check-In / Out' },
            { id: 'volunteer-hours', label: 'Volunteer Hours' },
          ],
        },
        {
          id: 'coach-console',
          label: 'Coach Console',
          icon: Award,
          roles: ['SUPERADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER', 'COACH', 'ASSISTANT_COACH'],
        },
        {
          id: 'parent-portal',
          label: 'Parent Portal',
          icon: UserCheck,
          roles: ['SUPERADMIN', 'PARENT', 'MEMBER'],
        },
        {
          id: 'attendance',
          label: 'Attendance',
          icon: CalendarCheck2,
          roles: ['SUPERADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER', 'COACH', 'ASSISTANT_COACH', 'STAFF'],
          subItems: [
            { id: 'take-attendance', label: 'Take Attendance' },
            { id: 'sessions', label: 'Classes & Sessions' },
            { id: 'attendance-reports', label: 'Attendance Reports' },
          ],
        },
        {
          id: 'membership-finance',
          label: 'Membership & Fees',
          icon: CreditCard,
          roles: ['SUPERADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER', 'FINANCE'],
          subItems: [
            { id: 'membership-plans', label: 'Plans & Renewals' },
            { id: 'invoices', label: 'Invoices & Billing' },
            { id: 'receipts', label: 'Receipts & Payments' },
          ],
        },
        {
          id: 'training',
          label: 'Training & Groups',
          icon: GraduationCap,
          roles: ['SUPERADMIN', 'CLUB_ADMIN', 'BRANCH_MANAGER', 'COACH', 'MEMBER', 'ATHLETE'],
          subItems: [
            { id: 'training-groups', label: 'Training Groups' },
            { id: 'schedule', label: 'Training Schedule' },
          ],
        },
        {
          id: 'events',
          label: 'Events & Seminars',
          icon: CalendarDays,
        },
        {
          id: 'tournaments',
          label: 'KarateTech Tournaments',
          icon: Trophy,
          badge: 'KT 3.0',
          subItems: [
            { id: 'kt-tournaments', label: 'Discover Tournaments' },
            { id: 'kt-drafts', label: 'Registration Drafts' },
            { id: 'kt-monitor', label: 'KarateTech Monitor' },
          ],
        },
        {
          id: 'tasks',
          label: 'Tasks Management',
          icon: CheckSquare,
        },
        {
          id: 'approvals',
          label: 'Approvals & Club Managers',
          icon: ShieldCheck,
          roles: ['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN'],
          subItems: [
            { id: 'approvals', label: 'Pending Approvals' },
            { id: 'approved-managers', label: 'Approved Managers' }
          ]
        },
        {
          id: 'reports',
          label: 'Reports & Analytics',
          icon: BarChart3,
          roles: ['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN', 'FINANCE', 'OBSERVER'],
        },
        {
          id: 'documents',
          label: 'Document Hub',
          icon: FileText,
        },
        {
          id: 'activity',
          label: 'Activity Centre',
          icon: MessageSquare,
        },
        {
          id: 'settings',
          label: 'System Settings',
          icon: Settings,
          roles: ['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN'],
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-30 transition-all duration-300 ease-in-out flex flex-col border-r border-[#BAE6FD] bg-[#F0F9FF] select-none ${
        collapsed ? 'w-20' : 'w-64 xl:w-72'
      }`}
      style={{
        boxShadow: '1px 0 10px rgba(2, 132, 199, 0.05)',
      }}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-[#BAE6FD] bg-[#E0F2FE]/60">
        {!collapsed && (
          <div className="flex items-center overflow-hidden h-full py-2">
            <Image
              src="/logo.jpg"
              alt="SP SportData Solution"
              width={200}
              height={40}
              className="h-full w-auto object-contain"
              priority
            />
          </div>
        )}

        {collapsed && (
          <div className="mx-auto flex items-center justify-center w-full h-full py-2 overflow-hidden">
             <Image
              src="/logo.jpg"
              alt="SP"
              width={40}
              height={40}
              className="h-8 w-auto object-cover object-left"
              style={{ width: '32px' }}
              priority
            />
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex w-7 h-7 rounded-md items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-[#BAE6FD]/40 transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Active Club / Branch Micro-Banner */}
      {!collapsed && activeClub && (
        <div className="px-4 py-2.5 bg-[#E0F2FE]/40 border-b border-[#BAE6FD]/60 flex items-center justify-between text-xs">
          <div className="truncate pr-2 min-w-0 flex-1">
            <span className="text-slate-500 font-medium block text-[10px] uppercase tracking-wider">
              {activeBranch ? 'Active Club & Branch' : 'Active Club & All Dojos'}
            </span>
            <span className="font-bold text-slate-900 truncate block text-[13px]" title={activeClub.name}>
              {activeClub.displayName || activeClub.shortName || activeClub.name}
            </span>
            {activeBranch ? (
              <span className="text-[11px] font-semibold text-[#0284C7] truncate flex items-center space-x-1 mt-0.5" title={activeBranch.name}>
                <GitBranch size={11} className="shrink-0 text-[#0284C7]" />
                <span className="truncate">{activeBranch.name}</span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-[#0284C7] truncate flex items-center space-x-1 mt-0.5" title="All Club Dojos">
                <GitBranch size={11} className="shrink-0 text-[#0284C7]" />
                <span className="truncate">All Club Dojos</span>
              </span>
            )}
          </div>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0284C7]/10 text-[#0284C7] border border-[#0284C7]/20 uppercase shrink-0">
            {activeClub.sport}
          </span>
        </div>
      )}

      {/* Menu Navigation */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
        {menuSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.items.map(item => {
              // Role check
              if (item.roles && !item.roles.includes(activeRole)) {
                return null;
              }

              const isMainActive = currentModule === item.id || currentModule.startsWith(`${item.id}-`);
              const isSubExpanded = expandedMenus[item.id];
              const IconComponent = item.icon;

              return (
                <div key={item.id} className="space-y-0.5">
                  <button
                    onClick={() => {
                      if (item.subItems) {
                        toggleSubmenu(item.id);
                        if (collapsed) onToggleCollapse();
                      } else {
                        onSelectModule(item.id);
                      }
                    }}
                    className={`w-full flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all group ${
                      isMainActive
                        ? 'bg-[#E0F2FE] text-[#0284C7] font-semibold shadow-xs'
                        : 'text-slate-700 hover:bg-[#E0F2FE]/50 hover:text-slate-900'
                    }`}
                  >
                    <IconComponent
                      size={18}
                      className={`shrink-0 transition-transform ${
                        isMainActive ? 'text-[#0284C7]' : 'text-slate-500 group-hover:text-slate-800'
                      }`}
                    />

                    {!collapsed && (
                      <span className="ml-3 truncate text-left flex-1">{item.label}</span>
                    )}

                    {!collapsed && item.badge && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-[#0284C7] text-white">
                        {item.badge}
                      </span>
                    )}

                    {!collapsed && item.subItems && (
                      <span className="ml-auto text-slate-400">
                        {isSubExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    )}
                  </button>

                  {/* Subitems */}
                  {!collapsed && item.subItems && isSubExpanded && (
                    <div className="pl-9 pr-1 py-1 space-y-1">
                      {item.subItems.map(sub => {
                        const isSubActive = currentModule === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => onSelectModule(sub.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              isSubActive
                                ? 'bg-[#0284C7] text-white font-semibold'
                                : 'text-slate-600 hover:bg-[#BAE6FD]/40 hover:text-slate-900'
                            }`}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer System Status */}
      <div className="p-3 border-t border-[#BAE6FD] bg-[#E0F2FE]/30 text-xs">
        {!collapsed ? (
          <div className="flex items-center justify-between text-slate-500">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-medium">KT 3.0 Connected</span>
            </span>
            <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-[#BAE6FD] text-slate-600">
              v1.0.0
            </span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="KT 3.0 Connected" />
          </div>
        )}
      </div>
    </aside>
  );
}
