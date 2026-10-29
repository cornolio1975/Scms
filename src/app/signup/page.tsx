'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Globe, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lang, setLang] = useState<'en' | 'ms'>('en');
  const router = useRouter();
  const supabase = createClient();

  const toggleLang = () => {
    const next = lang === 'en' ? 'ms' : 'en';
    setLang(next);
    localStorage.setItem('scms_language', next);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError(lang === 'en' ? 'Password must be at least 8 characters.' : 'Kata laluan mestilah sekurang-kurangnya 8 aksara.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            club_name: clubName.trim(),
            onboarding_completed: false,
          },
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        }
      });

      if (authError) throw authError;

      // Automatically sign in or indicate success
      setSuccess(true);
      if (data?.session) {
        setTimeout(() => {
          window.location.href = '/api/auth/route-dispatch';
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const t = {
    title: lang === 'en' ? 'Create New Sports Club' : 'Daftar Kelab Sukan Baharu',
    subtitle: lang === 'en' 
      ? 'Sign up to create and manage your sports club. You will become the primary Club Administrator.'
      : 'Daftar untuk mencipta dan mengurus kelab sukan anda. Anda akan dilantik sebagai Pentadbir Kelab utama.',
    clubName: lang === 'en' ? 'Club Name' : 'Nama Kelab',
    clubPlaceholder: lang === 'en' ? 'e.g. Kelab Karate Do Senshi' : 'cth. Kelab Karate Do Senshi',
    adminName: lang === 'en' ? 'Administrator Full Name' : 'Nama Penuh Pentadbir',
    emailLabel: lang === 'en' ? 'Administrator Email' : 'Emel Pentadbir',
    passLabel: lang === 'en' ? 'Secure Password' : 'Kata Laluan Selamat',
    submitBtn: lang === 'en' ? 'Register New Club' : 'Daftar Kelab Baharu',
    loadingBtn: lang === 'en' ? 'Registering Club...' : 'Sedang Mendaftar Kelab...',
    successTitle: lang === 'en' ? 'Club Registered Successfully!' : 'Kelab Berjaya Didaftarkan!',
    successSub: lang === 'en' 
      ? 'Account created. You will now be redirected to complete your profile onboarding.'
      : 'Akaun dicipta. Anda kini akan dialihkan untuk melengkapkan profil pendaftaran.',
    alreadyHaveAccount: lang === 'en' ? 'Already have an account? Sign in' : 'Sudah mempunyai akaun? Log masuk',
    langToggle: lang === 'en' ? 'Bahasa Malaysia' : 'English',
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 sm:p-10 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Building2 size={22} />
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            <Globe size={13} />
            <span>{t.langToggle}</span>
          </button>
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t.title}</h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t.subtitle}
          </p>
        </div>
        
        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
            <div className="text-xs sm:text-sm font-medium text-rose-700">{error}</div>
          </div>
        )}

        {success ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center space-y-3">
            <CheckCircle2 size={36} className="text-emerald-600 mx-auto" />
            <div className="text-base font-bold text-emerald-800">{t.successTitle}</div>
            <p className="text-xs sm:text-sm text-emerald-700 leading-relaxed">{t.successSub}</p>
            <Link 
              href="/login" 
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              <span>{lang === 'en' ? 'Continue to Sign In' : 'Teruskan ke Log Masuk'}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSignup}>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1" htmlFor="clubName">
                {t.clubName} *
              </label>
              <input
                id="clubName"
                type="text"
                required
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t.clubPlaceholder}
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1" htmlFor="fullName">
                {t.adminName} *
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Full Legal Name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1" htmlFor="email">
                {t.emailLabel} *
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="admin@yourclub.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1" htmlFor="password">
                {t.passLabel} *
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
              <p className="mt-1 text-[11px] text-slate-500">Minimum 8 characters with letters and numbers.</p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t.loadingBtn}</span>
                  </>
                ) : (
                  <>
                    <span>{t.submitBtn}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {!success && (
          <div className="text-center pt-2">
            <Link href="/login" className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              {t.alreadyHaveAccount}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
