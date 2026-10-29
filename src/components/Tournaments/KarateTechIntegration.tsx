'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  KarateTechIntegrationService,
  KarateTechTournament,
} from '@/lib/integrations/karateTech';
import {
  Trophy,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  Send,
  RefreshCw,
} from 'lucide-react';
import { readRegistrationJson } from '@/lib/integrations/registration-response';

interface KarateTechIntegrationProps {
  clubId?: string;
  branchId?: string;
}

export default function KarateTechIntegration({ clubId, branchId }: KarateTechIntegrationProps) {
  const { activeRole, activeClub } = useAuth();
  const [activeTab, setActiveTab] = useState<'discover' | 'drafts' | 'monitor'>('discover');
  const [tournaments, setTournaments] = useState<KarateTechTournament[]>([]);
  const [loading, setLoading] = useState(true);

  // Registration Draft Builder State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [athleteLoadError, setAthleteLoadError] = useState('');

  const [clubAthletes, setClubAthletes] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<{ id: string; tournamentName: string; status: string }[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTournaments = async () => {
    setIsRefreshing(true);
    try {
      const data = await KarateTechIntegrationService.getUpcomingTournaments();
      setTournaments(data);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await KarateTechIntegrationService.getUpcomingTournaments();
      setTournaments(data);

      if (clubId) {
        try {
          setAthleteLoadError('');
          if (clubId.startsWith('Scms-')) {
            const { store } = await import('@/lib/store');
            const athletes = store.getMembers(clubId, branchId === '__ALL__' ? undefined : branchId)
              .filter(member => member.isAthlete || member.roles?.includes('ATHLETE'));
            setClubAthletes(athletes);
            setLoading(false);
            return;
          }
          const response = await fetch(`/api/integration/karatetech/participants?clubId=${encodeURIComponent(clubId)}`, { cache: 'no-store' });
          const result = await readRegistrationJson(response, 'SCMS');
          if (!response.ok || result.success !== true) throw new Error(result.message || result.error || 'Unable to load club athletes.');
          setClubAthletes((result.members || []).map((member: any) => ({ ...member, fullName: member.full_name })));
        } catch (error) {
          setClubAthletes([]);
          setAthleteLoadError(error instanceof Error ? error.message : 'Unable to load athletes.');
        }
      } else {
        setClubAthletes([]);
      }
      setLoading(false);
    }
    loadData();
  }, [clubId, branchId]);

  const handleStartDraft = () => {
    setSubmissionStatus('');
    setSelectedAthleteIds([]);
    setIsBuilderOpen(true);
  };

  const handleToggleAthlete = (athleteId: string) => {
    setSelectedAthleteIds(prev => prev.includes(athleteId) ? prev.filter(id => id !== athleteId) : [...prev, athleteId]);
  };

  const handleSubmitDraft = async () => {
    if (!clubId || isSubmitting || !selectedAthleteIds.length) return;
    setIsSubmitting(true);
    setSubmissionStatus('Sending athlete profiles to KarateTech 3.0…');
    try {
      const local = clubId.startsWith('Scms-');
      const endpoint = local ? '/api/integration/karatetech/participants/import' : '/api/integration/karatetech/participants/batch';
      let requestBody: any = { clubId, memberIds: selectedAthleteIds };
      if (local) {
        const { store } = await import('@/lib/store');
        const club = store.getClubById(clubId);
        requestBody = {
          clubId,
          clubName: club?.displayName || club?.name || activeClub?.name,
          participants: selectedAthleteIds.map(id => {
            const athlete = store.getMemberById(id);
            if (!athlete || athlete.clubId !== clubId) throw new Error('A saved athlete is no longer in this club. Reopen the athlete list.');
            return {
              id: athlete.id, clubId, fullName: athlete.fullName, gender: athlete.gender, dob: athlete.dob,
              icPassport: athlete.icPassport, email: athlete.email, phone: athlete.phone,
              sportData: { weightKg: athlete.sportData?.weightKg, heightCm: athlete.sportData?.heightCm },
              branchId: athlete.branchId, nationality: athlete.nationality,
              emergencyContactName: athlete.emergencyContact?.name,
              emergencyContactPhone: athlete.emergencyContact?.phone,
            };
          }),
        };
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60000),
      });
      const result = await readRegistrationJson(response, 'SCMS');
      if (!response.ok || result.success !== true || !result.data) throw new Error(result.error || result.message || 'Athlete transfer was not confirmed.');
      const data = result.data;
      if (data.failed > 0) {
        const failedIds = data.failures.map((failure: any) => failure.scms_member_id);
        setSelectedAthleteIds(failedIds);
        setSubmissionStatus(`${data.created + data.updated} transferred; ${data.failed} failed. ${data.failures.map((failure: any) => {
          const name = clubAthletes.find(athlete => athlete.id === failure.scms_member_id)?.fullName || 'Athlete';
          return name + ': ' + failure.reason;
        }).join(' ')}`);
        return;
      }
      if (data.total !== selectedAthleteIds.length || data.created + data.updated + data.already_synced !== data.total) {
        throw new Error('KarateTech did not confirm every selected athlete. Please check the transfer status before retrying.');
      }
      setDrafts(prev => [{ id: crypto.randomUUID(), tournamentName: 'KarateTech athlete profiles', status: 'TRANSFERRED' }, ...prev]);
      setSelectedAthleteIds([]);
      setSubmissionStatus(`Success: ${data.total} athlete profile(s) received by KarateTech. Assign tournament categories in KarateTech.`);
    } catch (error) {
      setSubmissionStatus(error instanceof Error ? error.message : 'Transfer failed. Your selection is unchanged.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div>Loading KarateTech Data...</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
            <Trophy size={14} />
            <span>KarateTech 3.0 Controlled Integration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Athlete Transfer & Tournaments
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleStartDraft} disabled={!clubId} className="px-4 py-2.5 rounded-xl bg-[#0284C7] text-white text-sm font-bold disabled:opacity-50">Send Athlete Profiles</button>
          <button
            onClick={refreshTournaments}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
            title="Fetch latest published tournaments from KarateTech 3.0"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#0284C7]' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Latest'}</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <span className="text-xs font-bold text-slate-700">KarateTech tournament discovery</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-600" role="status">
        Available athletes: <strong>{clubAthletes.length}</strong>
        {clubId?.startsWith('Scms-') && ' • Saved on this device'}
      </p>
      {athleteLoadError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{athleteLoadError}</p>}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('discover')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'discover'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trophy size={15} />
          <span>Discover Tournaments ({tournaments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('drafts')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'drafts'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Send size={15} />
          <span>Transfers This Session ({drafts.length})</span>
        </button>

        {['SUPERADMIN', 'SYSTEM_ADMIN'].includes(activeRole) && (
          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'monitor'
                ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <RefreshCw size={15} />
            <span>SuperAdmin Monitor</span>
          </button>
        )}
      </div>

      {activeTab === 'discover' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tournaments.map(t => (
              <div
                key={t.tournamentId}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-[#0284C7]">
                      KarateTech Official
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700">
                      Registration {t.registrationStatus}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900">{t.tournamentName}</h3>
                    <span className="text-xs font-semibold text-slate-500 block mt-0.5">
                      Organizer: {t.organizer}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-center space-x-2">
                      <Calendar size={14} className="text-slate-400 shrink-0" />
                      <span>Date: <strong>{t.tournamentDate}</strong></span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{t.venue}, {t.state}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={handleStartDraft}
                    disabled={!clubId}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <span>Send Athlete Profiles</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'drafts' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
          <h3 className="font-extrabold text-base text-slate-900">Athlete Profile Transfers</h3>
          {drafts.length === 0 ? (
            <p className="text-xs text-slate-500">No athlete transfers recorded in this session.</p>
          ) : (
            <div className="space-y-3">
              {drafts.map(d => (
                <div key={d.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#0284C7] block">{d.id}</span>
                      <h4 className="font-extrabold text-sm text-slate-900">{d.tournamentName}</h4>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      {d.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'monitor' && (
         <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
           <h3 className="font-extrabold text-base text-slate-900 mb-4">SuperAdmin Monitor (Mocked)</h3>
           <p className="text-sm text-slate-500">Only accessible to SuperAdmin. Displays external API status and global mappings.</p>
         </div>
      )}

      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl min-w-0 w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900">Send Athlete Profiles</h3>
              <button disabled={isSubmitting} aria-label="Close athlete transfer" onClick={() => setIsBuilderOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-sm text-slate-600">Send athlete identity, contact and measurement details to KarateTech's configured athlete intake. Assign tournaments and categories in KarateTech; this transfer does not register a category.</p>
            {athleteLoadError && <p role="alert" className="text-sm text-amber-800">{athleteLoadError}</p>}
            {submissionStatus && (
              <div className="p-3 bg-sky-50 border border-sky-200 text-sky-800 rounded-xl text-xs font-bold">
                {submissionStatus}
              </div>
            )}

            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 block">
                Select Club Athletes ({selectedAthleteIds.length}/100 Selected):
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {!clubAthletes.length && <p className="text-sm text-slate-500">No athletes available. Check your club selection and athlete profiles.</p>}
                {clubAthletes.map(ath => {
                  const isSelected = selectedAthleteIds.includes(ath.id);
                  return (
                    <div key={ath.id} className={`p-3 rounded-2xl border text-xs space-y-2 ${isSelected ? 'bg-sky-50/60 border-[#0284C7]' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2.5 cursor-pointer">
                          <input type="checkbox" disabled={isSubmitting || (!isSelected && selectedAthleteIds.length >= 100)} checked={isSelected} onChange={() => handleToggleAthlete(ath.id)} className="w-4 h-4 text-[#0284C7] rounded cursor-pointer" />
                          <span className="font-bold text-slate-900">{ath.fullName}</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button onClick={handleSubmitDraft} disabled={selectedAthleteIds.length === 0 || isSubmitting} className="py-2.5 px-6 rounded-xl font-bold text-sm text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 flex items-center space-x-2">
                <Send size={15} />
                <span>{isSubmitting ? 'Submitting…' : 'Send to KarateTech 3.0'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
