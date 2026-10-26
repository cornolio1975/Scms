'use client';
import { useEffect, useState } from 'react';
import { Activity, RefreshCw, Send, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type Athlete = { id: string; full_name: string; gender: string; dob: string; passport_ic: string; weight: string | number; height: string | number };
type Outcome = { id: string; name: string; success: boolean; message: string };

export default function KarateTechSyncPanel() {
  const { activeClub } = useAuth();
  const [members, setMembers] = useState<Athlete[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connection, setConnection] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    setMembers([]); setSelected([]); setOutcomes([]); setError('');
    if (!activeClub?.id) return;
    setLoading(true);
    fetch(`/api/integration/karatetech/participants?clubId=${encodeURIComponent(activeClub.id)}`, { signal: controller.signal })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Unable to load athletes.'); return data; })
      .then(data => setMembers(data.members || []))
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeClub?.id]);
  async function test() {
    setTesting(true);
    try {
      const { testKarateTechConnection } = await import('@/app/actions/karatetech');
      const result = await testKarateTechConnection();
      setConnection(result.success && result.isHealthy ? 'Connected — athlete receiver is ready.' : result.error || 'Receiver is unavailable.');
    } catch { setConnection('Connection test failed. Please try again.'); }
    finally { setTesting(false); }
  }
  function edit(id: string, field: keyof Athlete, value: string) {
    setMembers(current => current.map(m => m.id === id ? { ...m, [field]: value } : m));
  }
  async function send() {
    if (!activeClub || sending) return;
    setSending(true); setError(''); setOutcomes([]);
    const results: Outcome[] = [];
    try {
      for (const member of members.filter(m => selected.includes(m.id))) {
        try {
          const res = await fetch('/api/integration/karatetech/participants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clubId: activeClub.id, memberId: member.id, details: { ...member, weight: Number(member.weight), height: Number(member.height) } }) });
          const result = await res.json();
          results.push({ id: member.id, name: member.full_name, success: res.ok && result.success, message: result.success ? 'Transfer confirmed by KarateTech.' : result.error || result.message || 'Transfer failed.' });
        } catch { results.push({ id: member.id, name: member.full_name, success: false, message: 'Connection interrupted. Retry when the receiver is available.' }); }
        setOutcomes([...results]);
      }
      setSelected(current => current.filter(id => !results.some(r => r.id === id && r.success)));
    } finally { setSending(false); }
  }
  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60';
  return (
    <section className="space-y-6 pb-12">
      <header><p className="mb-2 text-xs font-bold uppercase tracking-widest text-sky-700">Integrations / KarateTech 3.0</p><h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Athlete transfers</h1><p className="mt-2 text-sm text-slate-500">Send your club’s athletes to the tournament configured by your KarateTech administrator.</p></header>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><Activity className="text-sky-600" /><div><p className="text-sm font-bold">KarateTech 3.0 receiver</p><a className="break-all text-xs text-slate-500 underline" href="https://karatetech3.spsportdatasolution.org" target="_blank" rel="noopener noreferrer">karatetech3.spsportdatasolution.org</a></div></div><button onClick={test} disabled={testing || sending} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw size={15} className={testing ? 'animate-spin' : ''} />{testing ? 'Checking…' : 'Test connection'}</button>{connection && <p role="status" className="w-full text-sm text-slate-700">{connection}</p>}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold"><Users size={19} />{activeClub?.name || 'Select a club'}</h2><span className="text-xs text-slate-500">{selected.length} selected</span></div>
        <p className="mb-5 text-xs leading-relaxed text-slate-500">Check each athlete’s details before sending. Complete any missing fields using their real information. Edits here apply to this transfer only. Existing competition scores and draws are preserved.</p>
        {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {loading ? <p role="status" className="py-10 text-center text-sm text-slate-500">Loading club athletes…</p> : !members.length ? <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">{activeClub ? 'No accessible athlete or member profiles were found for this club.' : 'Choose a club in your workspace to load athletes.'}</p> : <div className="space-y-3">{members.map(m => <article key={m.id} className="rounded-xl border border-slate-200 p-4"><label className="mb-4 flex cursor-pointer items-center gap-3 text-sm font-bold"><input type="checkbox" disabled={sending} checked={selected.includes(m.id)} onChange={e => setSelected(current => e.target.checked ? [...current, m.id] : current.filter(id => id !== m.id))} className="h-4 w-4 accent-sky-700" />{m.full_name || 'Unnamed athlete'}</label><fieldset disabled={sending} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"><legend className="sr-only">Transfer details for {m.full_name}</legend><label className="space-y-1 text-[11px] text-slate-600">Gender<select aria-label={`Gender for ${m.full_name}`} value={m.gender} onChange={e => edit(m.id,'gender',e.target.value)} className={inputClass}><option value="">Select</option><option>Male</option><option>Female</option></select></label><label className="space-y-1 text-[11px] text-slate-600">Date of birth<input type="date" value={m.dob} onChange={e => edit(m.id,'dob',e.target.value)} className={inputClass} /></label><label className="space-y-1 text-[11px] text-slate-600">IC / Passport<input value={m.passport_ic} maxLength={50} onChange={e => edit(m.id,'passport_ic',e.target.value)} className={inputClass} /></label><label className="space-y-1 text-[11px] text-slate-600">Weight (kg)<input type="number" min="0.01" max="999" step="0.01" value={m.weight} onChange={e => edit(m.id,'weight',e.target.value)} className={inputClass} /></label><label className="space-y-1 text-[11px] text-slate-600">Height (cm)<input type="number" min="0.01" max="999" step="0.01" value={m.height} onChange={e => edit(m.id,'height',e.target.value)} className={inputClass} /></label></fieldset></article>)}</div>}
        <button onClick={send} disabled={!selected.length || sending || loading} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}{sending ? 'Sending athletes…' : `Send ${selected.length || ''} ${selected.length === 1 ? 'athlete' : 'athletes'} to KarateTech`}</button>
      </div>
      {!!outcomes.length && <div aria-live="polite" className="space-y-2"><h2 className="text-sm font-bold">Transfer results</h2>{outcomes.map(r => <div key={r.id} className={`rounded-xl border p-4 text-sm ${r.success ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}><strong>{r.name}</strong><p className="mt-1 text-xs">{r.message}</p></div>)}</div>}
      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500"><ShieldCheck size={17} className="shrink-0" />Only authorized club administrators and branch managers can transfer their athletes. Duplicate identities require review.</p>
    </section>
  );
}
