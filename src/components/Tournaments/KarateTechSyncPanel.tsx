'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RefreshCw, CheckCircle2, XCircle, Users, Activity, Settings, Clock, Send } from 'lucide-react';
// import { KarateTechSyncService } from '@/lib/integrations/karatetech-sync'; 
// NOTE: Since the sync service uses server-side Node.js features (crypto, process.env), 
// it must be called via Next.js Server Actions or API routes.

export default function KarateTechSyncPanel() {
  const { activeClub, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'status' | 'sync' | 'history' | 'settings'>('status');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const { testKarateTechConnection } = await import('@/app/actions/karatetech');
      const res = await testKarateTechConnection();
      setIsConnected(Boolean(res.success && res.isHealthy));
    } catch {
      setIsConnected(false);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
            <Activity size={14} />
            <span>Integrations / KarateTech 3.0</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Participant Synchronization
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Secure REST API integration mapping SCMS members to KarateTech participants.
          </p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-px">
        {['status', 'sync', 'history', 'settings'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 capitalize ${
              activeTab === tab
                ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab === 'status' && <Activity size={15} />}
            {tab === 'sync' && <Users size={15} />}
            {tab === 'history' && <Clock size={15} />}
            {tab === 'settings' && <Settings size={15} />}
            <span>{tab === 'status' ? 'Connection Status' : tab === 'sync' ? 'Participants Sync' : tab === 'history' ? 'Sync History' : 'Settings'}</span>
          </button>
        ))}
      </div>

      {activeTab === 'status' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 max-w-2xl">
          <h3 className="font-extrabold text-base text-slate-900">API Connection Status</h3>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center space-x-3">
              {isConnected === null ? (
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400"><RefreshCw size={18} /></div>
              ) : isConnected ? (
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle2 size={18} /></div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600"><XCircle size={18} /></div>
              )}
              <div>
                <span className="font-bold text-slate-900 block">KarateTech 3.0 Production API</span>
                <span className="text-xs text-slate-500">https://karatetech3.spsportdatasolution.org</span>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              isConnected === null ? 'bg-slate-100 text-slate-600' : isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {isConnected === null ? 'Unknown' : isConnected ? 'Connected' : 'Failed'}
            </span>
          </div>

          <button
            onClick={testConnection}
            disabled={isTesting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-[#0284C7] hover:bg-[#0369A1] transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isTesting ? <RefreshCw size={16} className="animate-spin" /> : <Activity size={16} />}
            <span>Test Connection</span>
          </button>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4 max-w-4xl">
          <h3 className="font-extrabold text-base text-slate-900">Bulk Participant Synchronization</h3>
          <p className="text-xs text-slate-500 mb-4">
            Select participants from your club to safely transmit and map their SCMS identities to KarateTech 3.0.
            This action generates an idempotent request ID to guarantee zero duplicate identities.
          </p>
          <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-sky-800 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 size={16} />
            <span>UI placeholder for Server Action integration. Server-side API client is fully built.</span>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs max-w-4xl">
          <h3 className="font-extrabold text-base text-slate-900 mb-4">Audit Log & Sync History</h3>
          <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
            <span className="text-slate-400 text-sm font-semibold">No sync history available for this club yet.</span>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs max-w-2xl space-y-4">
          <h3 className="font-extrabold text-base text-slate-900">Integration Guardrails</h3>
          <p className="text-xs text-slate-500 mb-4">
            These settings govern the strict field-ownership boundary between SCMS and KarateTech.
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-center space-x-2"><CheckCircle2 className="text-emerald-500" size={16} /> <span>SCMS owns Core Identity (Name, DOB)</span></li>
            <li className="flex items-center space-x-2"><CheckCircle2 className="text-emerald-500" size={16} /> <span>KarateTech owns Tournament Results</span></li>
            <li className="flex items-center space-x-2"><CheckCircle2 className="text-emerald-500" size={16} /> <span>Strict Duplicate Participant Protection Enabled</span></li>
          </ul>
        </div>
      )}
    </div>
  );
}
