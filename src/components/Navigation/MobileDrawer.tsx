'use client';

/**
 * Scms Mobile Navigation Drawer
 * Section 30 & 31: Hamburger -> Light-Blue slide-out drawer, touch targets >= 44px, full role-based access
 */

import React from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import {
  X,
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
  CheckSquare,
  ShieldCheck,
  BarChart3,
  FileText,
  UserCheck,
  Settings,
} from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
}

export default function MobileDrawer({
  isOpen,
  onClose,
  currentModule,
  onSelectModule,
}: MobileDrawerProps) {
  const { activeRole, activeClub, activeBranch, currentUser } = useAuth();

  if (!isOpen) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'all-members', label: 'Members & Athletes', icon: Users },
    { id: 'all-volunteers', label: 'Volunteer System', icon: HeartHandshake },
    { id: 'coach-console', label: 'Coach Console', icon: Award },
    { id: 'parent-portal', label: 'Parent Portal', icon: UserCheck },
    { id: 'take-attendance', label: 'Take Attendance', icon: CalendarCheck2 },
    { id: 'invoices', label: 'Finance & Invoices', icon: CreditCard },
    { id: 'training-groups', label: 'Training & Classes', icon: GraduationCap },
    { id: 'events', label: 'Events & Seminars', icon: CalendarDays },
    { id: 'kt-tournaments', label: 'KarateTech Tournaments', icon: Trophy },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    ...(['SUPERADMIN', 'SYSTEM_ADMIN', 'CLUB_ADMIN'].includes(activeRole)
      ? [{ id: 'approvals', label: 'Approval Centre', icon: ShieldCheck }]
      : []),
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-out Light-Blue Drawer */}
      <div className="relative w-4/5 max-w-sm bg-[#F0F9FF] border-r border-[#BAE6FD] h-full flex flex-col shadow-2xl z-10 animate-fade-in">
        {/* Drawer Header */}
        <div className="h-16 px-4 bg-[#E0F2FE] border-b border-[#BAE6FD] flex items-center justify-between">
          <div className="flex items-center overflow-hidden py-1 h-full">
            <Image
              src="/logo.jpg"
              alt="SP SportData Solution"
              width={160}
              height={32}
              className="h-full w-auto object-contain"
              priority
            />
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-[#BAE6FD]/40 touch-target flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* User & Club Context Card */}
        <div className="p-3.5 bg-white border-b border-[#BAE6FD] mx-3 my-2.5 rounded-xl shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser?.fullName.charAt(0) || 'U'}
            </div>
            <div className="truncate">
              <span className="font-bold text-xs text-slate-900 block truncate">
                {currentUser?.fullName}
              </span>
              <span className="text-[10px] font-semibold text-[#0284C7] bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                {activeRole.replace('_', ' ')}
              </span>
            </div>
          </div>
          {activeClub && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
              <span className="truncate font-medium">{activeClub.shortName}</span>
              <span className="text-slate-400 shrink-0">{activeBranch?.name.split(' ')[0] || 'HQ'}</span>
            </div>
          )}
        </div>

        {/* Navigation Link Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {navItems.map(item => {
            const isActive = currentModule === item.id || currentModule.startsWith(`${item.id}-`);
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectModule(item.id);
                  onClose();
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all touch-target ${
                  isActive
                    ? 'bg-[#0284C7] text-white shadow-sm'
                    : 'text-slate-700 hover:bg-[#E0F2FE] hover:text-slate-900'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500'} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#BAE6FD] bg-[#E0F2FE]/40 text-center text-xs text-slate-500">
          <span className="font-medium text-[11px]">Scms Mobile • SP SportData Solution</span>
        </div>
      </div>
    </div>
  );
}
