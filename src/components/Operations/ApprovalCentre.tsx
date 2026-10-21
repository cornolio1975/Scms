'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Users, Building2, Edit, RefreshCw, AlertTriangle, XOctagon, Search } from 'lucide-react';

// Placeholder sub-components (to be implemented)
import PendingMembersTab from './ApprovalTabs/PendingMembersTab';
import BranchAssignmentsTab from './ApprovalTabs/BranchAssignmentsTab';
import ParticipantChangesTab from './ApprovalTabs/ParticipantChangesTab';
import KarateTechSyncTab from './ApprovalTabs/KarateTechSyncTab';
import ConflictsTab from './ApprovalTabs/ConflictsTab';
import FailedSyncTab from './ApprovalTabs/FailedSyncTab';
import ReconciliationTab from './ApprovalTabs/ReconciliationTab';
import ClubRegistrationsTab from './ApprovalTabs/ClubRegistrationsTab';

export default function ApprovalCentre({ currentModule }: { currentModule?: string }) {
  const { activeRole, activeClub } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('Pending Members');

  const tabs = [
    { id: 'Pending Members', icon: Users },
    { id: 'Branch Assignments', icon: Building2 },
    { id: 'Participant Changes', icon: Edit },
    { id: 'KarateTech Sync', icon: RefreshCw },
    { id: 'Conflicts', icon: AlertTriangle },
    { id: 'Failed Sync', icon: XOctagon },
    { id: 'Reconciliation', icon: Search },
  ];

  if (activeRole === 'SUPERADMIN') {
    tabs.unshift({ id: 'Club Registrations', icon: Building2 });
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
            <ShieldCheck size={14} />
            <span>Governance & Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Central Approval Centre
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage the complete participant lifecycle and operational requests.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{tab.id}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="mt-6">
        {activeTab === 'Club Registrations' && <ClubRegistrationsTab />}
        {activeTab === 'Pending Members' && <PendingMembersTab />}
        {activeTab === 'Branch Assignments' && <BranchAssignmentsTab />}
        {activeTab === 'Participant Changes' && <ParticipantChangesTab />}
        {activeTab === 'KarateTech Sync' && <KarateTechSyncTab />}
        {activeTab === 'Conflicts' && <ConflictsTab />}
        {activeTab === 'Failed Sync' && <FailedSyncTab />}
        {activeTab === 'Reconciliation' && <ReconciliationTab />}
      </div>
    </div>
  );
}
