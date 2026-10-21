'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterClubPage() {
  const [formData, setFormData] = useState({
    clubName: '',
    scoreboardAbbreviation: '',
    registrationNo: '',
    address: '',
    state: '',
    country: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/public/register-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit registration');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg space-y-8 rounded-2xl bg-white p-10 shadow-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-black text-slate-900">Registration Submitted</h2>
          <p className="mt-2 text-sm text-slate-600 font-medium">
            Your club registration has been submitted successfully and is waiting for SuperAdmin approval.
          </p>
          <div className="mt-8">
            <Link href="/login" className="font-bold text-[#0284C7] hover:text-[#0369A1]">
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8 rounded-3xl bg-white p-8 sm:p-12 shadow-2xl border border-slate-100">
        <div className="text-center">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Create New Club</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">Register your club with the SCMS network.</p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-200">
            <div className="text-sm font-semibold text-red-700">{error}</div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider border-b pb-2">Club Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Club Name *</label>
                <input required type="text" name="clubName" value={formData.clubName} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0284C7] focus:ring-[#0284C7]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Scoreboard Abbr (KarateTech) *</label>
                <input required type="text" name="scoreboardAbbreviation" maxLength={30} value={formData.scoreboardAbbreviation} onChange={handleChange} placeholder="e.g. Senshi Karate, SGR" className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0284C7] focus:ring-[#0284C7] uppercase" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Registration No.</label>
                <input type="text" name="registrationNo" value={formData.registrationNo} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0284C7] focus:ring-[#0284C7]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">State *</label>
                <input required type="text" name="state" value={formData.state} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0284C7] focus:ring-[#0284C7]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Country *</label>
                <input required type="text" name="country" value={formData.country} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0284C7] focus:ring-[#0284C7]" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Address *</label>
                <textarea required rows={2} name="address" value={formData.address} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0284C7] focus:ring-[#0284C7] resize-none"></textarea>
              </div>
            </div>

            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider border-b pb-2 pt-4">Club Admin Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Admin Full Name *</label>
                <input required type="text" name="adminName" value={formData.adminName} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0284C7] focus:ring-[#0284C7]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Admin Email *</label>
                <input required type="email" name="adminEmail" value={formData.adminEmail} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0284C7] focus:ring-[#0284C7]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Admin Mobile *</label>
                <input required type="text" name="adminPhone" value={formData.adminPhone} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0284C7] focus:ring-[#0284C7]" />
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#0284C7] px-4 py-3 text-sm font-bold text-white hover:bg-[#0369A1] focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:ring-offset-2 disabled:opacity-50 transition-colors shadow-md"
            >
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>
            <div className="text-center text-sm">
              <Link href="/login" className="font-bold text-slate-500 hover:text-slate-700 transition-colors">
                Cancel & Return to Login
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
