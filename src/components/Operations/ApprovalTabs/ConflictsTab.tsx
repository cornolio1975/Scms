'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, Check, Edit2 } from 'lucide-react';

export default function ConflictsTab() {
  const { activeClub, activeRole, activeBranch } = useAuth();
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customValue, setCustomValue] = useState<string>('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchConflicts();
  }, [activeClub, activeBranch]);

  const fetchConflicts = async () => {
    setLoading(true);
    let query = supabase
      .from('approval_requests')
      .select('*, profiles(full_name, email)')
      .eq('request_type', 'KARATETECH_RECONCILIATION')
      .eq('status', 'PENDING_APPROVAL');

    if (activeRole !== 'SUPERADMIN' && activeClub) {
      query = query.eq('club_id', activeClub.id);
    }
    if (activeRole === 'BRANCH_MANAGER' && activeBranch) {
      query = query.eq('branch_id', activeBranch.id);
    }

    const { data } = await query;
    if (data) setConflicts(data);
    setLoading(false);
  };

  const handleResolve = async (id: string, type: 'USE_SCMS' | 'USE_KARATETECH' | 'CORRECTED') => {
    let finalValue = customValue;
    if (type === 'CORRECTED' && !finalValue) {
      alert("Please enter a custom corrected value.");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to resolve using ${type}?`)) return;

    setResolvingId(id);
    const res = await fetch('/api/integration/scms/lifecycle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RESOLVE_CONFLICT', id, resolutionType: type, correctedValue: finalValue })
    });
    const result = await res.json();
    setResolvingId(null);
    setCustomValue('');
    
    if (result.success) {
      fetchConflicts();
    } else {
      alert(result.error);
    }
  };

  if (loading) return <div className="text-sm text-slate-500 p-8 text-center animate-pulse">Loading conflicts...</div>;

  return (
    <div className="space-y-4">
      {conflicts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-xs text-slate-500">
          No synchronization conflicts detected.
        </div>
      ) : (
        conflicts.map((conflict) => {
          const reqData = conflict.requested_data || {};
          const field = reqData.conflict_field || 'Unknown Field';

          return (
            <div key={conflict.id} className="bg-white border border-rose-200 rounded-3xl p-6 shadow-xs flex flex-col gap-6">
              
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert size={16} className="text-rose-600" />
                    <span className="font-bold text-xs text-rose-600 uppercase tracking-wider">3-Way Sync Conflict</span>
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900">{conflict.profiles?.full_name}</h3>
                  <p className="text-xs font-bold text-slate-500">Conflicting Field: <span className="text-slate-800">{field.toUpperCase()}</span></p>
                </div>
              </div>

              {/* 3-Way Comparison Table */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Last Synced Value</span>
                  <span className="font-mono text-sm text-slate-600">{reqData.last_synced_value || 'None'}</span>
                </div>
                <div className="bg-sky-50 rounded-xl p-4 border border-sky-200 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-sky-600 uppercase">Current SCMS Value</span>
                  <span className="font-mono text-sm text-sky-900 font-bold">{reqData.scms_value || 'None'}</span>
                  <button 
                    onClick={() => handleResolve(conflict.id, 'USE_SCMS')}
                    disabled={resolvingId === conflict.id}
                    className="mt-3 py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] rounded flex items-center justify-center gap-1 uppercase"
                  >
                    <Check size={12} /> Use SCMS
                  </button>
                </div>
                <div className="bg-rose-50 rounded-xl p-4 border border-rose-200 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-rose-600 uppercase">Current KarateTech Value</span>
                  <span className="font-mono text-sm text-rose-900 font-bold">{reqData.karatetech_value || 'None'}</span>
                  <button 
                    onClick={() => handleResolve(conflict.id, 'USE_KARATETECH')}
                    disabled={resolvingId === conflict.id}
                    className="mt-3 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded flex items-center justify-center gap-1 uppercase"
                  >
                    <Check size={12} /> Use KarateTech
                  </button>
                </div>
              </div>

              {/* Manual Correction */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Enter Corrected Value</label>
                  <input 
                    type="text" 
                    placeholder={`Correct ${field}...`}
                    value={customValue}
                    onChange={e => setCustomValue(e.target.value)}
                    className="w-full text-sm font-mono border border-slate-200 rounded-lg p-2.5 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={() => handleResolve(conflict.id, 'CORRECTED')}
                  disabled={!customValue || resolvingId === conflict.id}
                  className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all w-full sm:w-auto justify-center"
                >
                  <Edit2 size={14} /> Resolve Manually
                </button>
              </div>

            </div>
          );
        })
      )}
    </div>
  );
}
