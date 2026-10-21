'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';
import {
  KarateTechIntegrationService,
  KarateTechTournament,
  FALLBACK_CATEGORIES,
} from '@/lib/integrations/karateTech';
import { TournamentRegistrationDraft, TournamentRegistrationItem, Member } from '@/types';
import {
  Trophy,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  Send,
  RefreshCw,
} from 'lucide-react';
import { generateImmutableId, generateIdempotencyKey } from '@/lib/idGenerator';

interface KarateTechIntegrationProps {
  clubId?: string;
  branchId?: string;
}

export default function KarateTechIntegration({ clubId, branchId }: KarateTechIntegrationProps) {
  const { activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'discover' | 'drafts' | 'monitor'>('discover');
  const [tournaments, setTournaments] = useState<KarateTechTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<KarateTechTournament | null>(null);

  // Registration Draft Builder State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [submissionStatus, setSubmissionStatus] = useState<string>('');

  const [clubAthletes, setClubAthletes] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<TournamentRegistrationDraft[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();

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
        if (clubId.startsWith('Scms-')) {
          const { store } = await import('@/lib/store');
          const members = store.getMembers(clubId, branchId);
          // Only show those with ATHLETE role or isAthlete flag
          const athletes = members.filter(m => m.isAthlete || m.roles?.includes('ATHLETE'));
          setClubAthletes(athletes);
          setDrafts([]);
        } else {
          // Fetch athletes from Supabase
          let query = supabase
            .from('user_roles')
            .select(`
              id,
              profiles (
                id,
                email,
                full_name,
                gender
              )
            `)
            .eq('club_id', clubId)
            .eq('role', 'MEMBER'); // Assuming athletes are members.

          if (branchId) {
            query = query.eq('branch_id', branchId);
          }

          const { data: membersData } = await query;
          if (membersData) {
            const athletes = membersData.map((m: any) => ({
              id: m.profiles.id,
              fullName: m.profiles.full_name,
              gender: m.profiles.gender || null,
              dob: m.profiles.dob || m.profiles.date_of_birth || null,
              isAthlete: true,
              sportData: { beltRank: m.profiles.beltRank || 'White Belt', weightKg: m.profiles.weight || null }
            }));
            setClubAthletes(athletes);
          }
          
          // Mocking drafts for now since they are not in DB schema
          setDrafts([]); 
        }
      }
      setLoading(false);
    }
    loadData();
  }, [clubId, branchId, supabase]);

  const handleStartDraft = (t: KarateTechTournament) => {
    setSelectedTournament(t);
    setSelectedAthleteIds([]);
    setSelectedCategories({});
    setIsBuilderOpen(true);
  };

  const handleToggleAthlete = (athleteId: string) => {
    setSelectedAthleteIds(prev =>
      prev.includes(athleteId) ? prev.filter(id => id !== athleteId) : [...prev, athleteId]
    );
  };

  const handleCategorySelect = (athleteId: string, categoryId: string) => {
    setSelectedCategories(prev => ({ ...prev, [athleteId]: categoryId }));
  };

  const handleSubmitDraft = async () => {
    if (!selectedTournament || !clubId) return;
    setSubmissionStatus('Validating and submitting to KarateTech 3.0...');

    const items: TournamentRegistrationItem[] = selectedAthleteIds.map(athId => {
      const athlete = clubAthletes.find(a => a.id === athId)!;
      const eligibleCategories = KarateTechIntegrationService.suggestEligibleCategories(
        athlete as Member,
        selectedTournament.tournamentDate
      );
      const catId = selectedCategories[athId] || (eligibleCategories.length > 0 ? eligibleCategories[0].id : FALLBACK_CATEGORIES[0].id);
      const cat = FALLBACK_CATEGORIES.find(c => c.id === catId);

      const val = KarateTechIntegrationService.validateParticipantCategory(
        athlete as Member,
        selectedTournament.tournamentDate,
        catId
      );

      return {
        scmsMemberId: athlete.id,
        memberName: athlete.fullName,
        discipline: 'Kumite',
        targetCategoryId: catId,
        targetCategoryName: cat?.name || 'Category',
        ageAtTournament: new Date().getFullYear() - 2005,
        weightKg: athlete.sportData?.weightKg || 60,
        gender: athlete.gender,
        eligibilityPassed: val.eligible,
        validationError: val.reason,
      };
    });

    const draftId = generateImmutableId('TREG');
    const idempotencyKey = generateIdempotencyKey();

    const draft: TournamentRegistrationDraft = {
      id: draftId,
      tournamentId: selectedTournament.tournamentId,
      tournamentName: selectedTournament.tournamentName,
      tournamentDate: selectedTournament.tournamentDate,
      clubId: clubId,
      participants: items,
      idempotencyKey,
      status: 'READY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await KarateTechIntegrationService.submitRegistrationDraft(draft, activeRole || 'BRANCH_MANAGER');

    if (res.success) {
      draft.status = 'ACKNOWLEDGED';
      draft.acknowledgedAt = new Date().toISOString();
      setDrafts([draft, ...drafts]);
      setSubmissionStatus(`Success! Acknowledged by KarateTech 3.0: ${res.acknowledgementId}`);
      setTimeout(() => {
        setIsBuilderOpen(false);
        setSubmissionStatus('');
        setActiveTab('drafts');
      }, 2000);
    } else {
      draft.status = 'VALIDATION_FAILED';
      setSubmissionStatus(res.error || 'Submission failed');
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
            Official Tournament Registration
          </h1>
        </div>

        <div className="flex items-center space-x-3">
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
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-700">KarateTech Live Bridge</span>
          </div>
        </div>
      </div>

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
          <span>Registration Drafts ({drafts.length})</span>
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
                    onClick={() => handleStartDraft(t)}
                    disabled={t.registrationStatus !== 'Open'}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <span>Register Club Participants</span>
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
          <h3 className="font-extrabold text-base text-slate-900">Submitted & Draft Rosters</h3>
          {drafts.length === 0 ? (
            <p className="text-xs text-slate-500">No tournament registration drafts found.</p>
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

      {isBuilderOpen && selectedTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900">Draft Registration Builder</h3>
              <button onClick={() => setIsBuilderOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {submissionStatus && (
              <div className="p-3 bg-sky-50 border border-sky-200 text-sky-800 rounded-xl text-xs font-bold">
                {submissionStatus}
              </div>
            )}

            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 block">
                Select Club Athletes ({selectedAthleteIds.length} Selected):
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {clubAthletes.map(ath => {
                  const isSelected = selectedAthleteIds.includes(ath.id);
                  const eligibleCategories = KarateTechIntegrationService.suggestEligibleCategories(
                    ath as Member,
                    selectedTournament.tournamentDate
                  );
                  const selectedCat = selectedCategories[ath.id] || (eligibleCategories.length > 0 ? eligibleCategories[0].id : FALLBACK_CATEGORIES[0].id);

                  return (
                    <div key={ath.id} className={`p-3 rounded-2xl border text-xs space-y-2 ${isSelected ? 'bg-sky-50/60 border-[#0284C7]' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2.5 cursor-pointer">
                          <input type="checkbox" checked={isSelected} onChange={() => handleToggleAthlete(ath.id)} className="w-4 h-4 text-[#0284C7] rounded cursor-pointer" />
                          <span className="font-bold text-slate-900">{ath.fullName}</span>
                        </label>
                      </div>
                      {isSelected && (
                        <div className="pl-6 pt-1">
                          <select value={selectedCat} onChange={e => handleCategorySelect(ath.id, e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800">
                            {eligibleCategories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name} ({cat.gender})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button onClick={handleSubmitDraft} disabled={selectedAthleteIds.length === 0} className="py-2.5 px-6 rounded-xl font-bold text-sm text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 flex items-center space-x-2">
                <Send size={15} />
                <span>Submit to KarateTech 3.0</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
