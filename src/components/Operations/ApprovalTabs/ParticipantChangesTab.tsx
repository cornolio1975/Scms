'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function ParticipantChangesTab() {
  const { activeClub, activeRole, activeBranch } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchChanges();
  }, [activeClub, activeBranch]);

  const fetchChanges = async () => {
    setLoading(true);
    let query = supabase
      .from('approval_requests')
      .select('*, profiles(full_name, email)')
      .eq('request_type', 'PARTICIPANT_CHANGE')
      .eq('status', 'PENDING_APPROVAL');

    if (activeRole !== 'SUPERADMIN' && activeClub) {
      query = query.eq('club_id', activeClub.id);
    }
    if (activeRole === 'BRANCH_MANAGER' && activeBranch) {
      query = query.eq('branch_id', activeBranch.id);
    }

    const { data } = await query;
    if (data) setRequests(data);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm("Approve this profile change?")) return;
    
    // Call server action for secure lifecycle transition
    const res = await fetch('/api/integration/scms/lifecycle', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE_CHANGE', id })
    });
    const result = await res.json();
    if (result.success) {
      fetchChanges();
    } else {
      alert(result.error);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Rejection Reason:");
    if (!reason) return;
    
    const { error } = await supabase.from('approval_requests').update({ status: 'REJECTED', rejection_reason: reason }).eq('id', id);
    if (!error) fetchChanges();
  };

  if (loading) return <div className="text-sm text-slate-500 p-8 text-center animate-pulse">Loading changes...</div>;

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-xs text-slate-500">
          No participant changes pending.
        </div>
      ) : (
        requests.map((req) => (
          <div key={req.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-sky-600">CHG-{req.id.substring(0,6)}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">REVIEW REQUIRED</span>
              </div>
              <h3 className="font-extrabold text-base text-slate-900">{req.profiles?.full_name}</h3>
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                <div className="font-bold mb-1">Requested Changes:</div>
                {Object.keys(req.requested_data || {}).map(key => (
                  <div key={key} className="grid grid-cols-3 gap-2">
                    <span className="font-semibold text-slate-500">{key}:</span>
                    <span className="text-rose-600 line-through">{req.previous_data?.[key] || 'null'}</span>
                    <span className="text-emerald-600 font-bold">→ {req.requested_data[key]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button onClick={() => handleApprove(req.id)} className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 justify-center">
                <CheckCircle2 size={16} /> Approve
              </button>
              <button onClick={() => handleReject(req.id)} className="py-2 px-4 bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 justify-center">
                <XCircle size={16} /> Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
