'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function PendingMembersTab() {
  const { activeClub, activeRole, activeBranch } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchPendingMembers();
  }, [activeClub, activeBranch]);

  const fetchPendingMembers = async () => {
    setLoading(true);

    if (activeClub?.id?.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      const mockMembers = store.getMembers(activeClub.id)
        .filter(m => (m as any).__mockStatus !== 'APPROVED' && ((m.status as string) === 'Pending' || (m.status === 'Active' && m.fullName.toLowerCase().includes('bala'))))
        .map(m => ({
          id: m.id,
          role: m.roles?.[0] || 'MEMBER',
          participant_status: 'PENDING_APPROVAL',
          profiles: {
            full_name: m.fullName,
            email: m.email
          }
        }));
      setMembers(mockMembers);
      setLoading(false);
      return;
    }

    let query = supabase
      .from('user_roles')
      .select('*, profiles(full_name, email)')
      .in('participant_status', ['REGISTERED', 'PENDING_APPROVAL']);

    if (activeRole !== 'SUPERADMIN' && activeClub) {
      query = query.eq('club_id', activeClub.id);
    }
    
    // Branch Managers only see pending members trying to join their branch
    if (activeRole === 'BRANCH_MANAGER' && activeBranch) {
      query = query.eq('branch_id', activeBranch.id);
    }

    const { data, error } = await query;
    if (data) setMembers(data);
    setLoading(false);
  };

  const handleAction = async (roleId: string, action: 'APPROVED' | 'REJECTED', userId?: string) => {
    if (activeClub?.id?.startsWith('Scms-')) {
      const { store } = await import('@/lib/store');
      store.updateMember(roleId, { status: action === 'APPROVED' ? 'Active' : 'Rejected', __mockStatus: action } as any, 'SUPERADMIN');
      fetchPendingMembers();
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .update({ participant_status: action })
      .eq('id', roleId);

    if (!error) {
      if (action === 'APPROVED' && userId) {
        // Update profile status as well to unlock login
        await supabase.from('profiles').update({ status: 'ACTIVE' }).eq('id', userId);
      }
      fetchPendingMembers();
    } else {
      alert(`Failed to process: ${error.message}`);
    }
  };

  if (loading) return <div className="text-sm text-slate-500 p-8 text-center animate-pulse">Loading queue...</div>;

  return (
    <div className="space-y-4">
      {members.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-xs text-slate-500">
          No pending members require approval.
        </div>
      ) : (
        members.map((member) => (
          <div key={member.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-sky-600">REQ-{member.id.substring(0,6)}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">{member.participant_status}</span>
              </div>
              <h3 className="font-extrabold text-base text-slate-900">{member.profiles?.full_name}</h3>
              <p className="text-xs text-slate-500">{member.profiles?.email}</p>
              <p className="text-xs font-bold text-slate-700 mt-2">Requested Role: {member.role}</p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => handleAction(member.id, 'APPROVED', member.user_id)}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>Approve</span>
              </button>
              <button
                onClick={() => handleAction(member.id, 'REJECTED', member.user_id)}
                className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
              >
                <XCircle size={16} />
                <span>Reject</span>
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
