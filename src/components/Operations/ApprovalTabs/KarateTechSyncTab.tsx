'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { RefreshCw, CheckCircle, Clock } from 'lucide-react';

export default function KarateTechSyncTab() {
  const { activeClub, activeRole } = useAuth();
  const [syncJobs, setSyncJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchSyncJobs();
  }, [activeClub]);

  const fetchSyncJobs = async () => {
    setLoading(true);
    let query = supabase
      .from('sync_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (activeRole !== 'SUPERADMIN' && activeClub) {
      query = query.eq('club_id', activeClub.id);
    }

    const { data, error } = await query;
    if (data) setSyncJobs(data);
    setLoading(false);
  };

  const handleRetry = async (jobId: string) => {
    // Basic logic to reset a job to pending
    const { error } = await supabase
      .from('sync_jobs')
      .update({ status: 'PENDING', attempts: 0 })
      .eq('id', jobId);

    if (!error) {
      fetchSyncJobs();
    }
  };

  if (loading) return <div className="text-sm text-slate-500 p-8 text-center animate-pulse">Loading sync queues...</div>;

  return (
    <div className="space-y-4">
      {syncJobs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-xs text-slate-500">
          No pending or recent sync jobs.
        </div>
      ) : (
        syncJobs.map((job) => (
          <div key={job.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500">JOB-{job.id.substring(0,6)}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                  job.status === 'FAILED' ? 'bg-rose-50 text-rose-700' :
                  'bg-sky-50 text-sky-700'
                }`}>
                  {job.status}
                </span>
              </div>
              <h3 className="font-extrabold text-base text-slate-900">Participant ID: {job.participant_id}</h3>
              <p className="text-xs text-slate-500">Operation: {job.operation} ({job.direction})</p>
              {job.error && <p className="text-xs font-bold text-rose-600 mt-1">Error: {job.error}</p>}
            </div>

            <div className="flex items-center gap-2">
              {job.status === 'FAILED' && (
                <button
                  onClick={() => handleRetry(job.id)}
                  className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
