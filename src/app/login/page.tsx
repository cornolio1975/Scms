'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowRight, 
  Building2, 
  Check, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  Globe, 
  Layers3, 
  Loader2, 
  LockKeyhole, 
  ShieldCheck, 
  Trophy, 
  Users 
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import styles from './login.module.css';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<'en' | 'ms'>('en');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check saved language preference
    const saved = localStorage.getItem('scms_language') as 'en' | 'ms';
    if (saved) setLang(saved);

    // Check for error messages passed via query params
    const errCode = searchParams.get('error');
    if (errCode) {
      if (errCode === 'unauthorized_role') {
        setError(lang === 'en' 
          ? 'Your account role is being verified. Please contact your administrator.' 
          : 'Peranan akaun anda sedang disahkan. Sila hubungi pentadbir anda.');
      } else if (errCode === 'club_pending_or_inactive') {
        setError(lang === 'en' 
          ? 'Your club registration is pending administrator approval or is currently inactive.' 
          : 'Pendaftaran kelab anda sedang menunggu kelulusan pentadbir atau tidak aktif.');
      } else if (errCode === 'no_club_assigned') {
        setError(lang === 'en' 
          ? 'No club is assigned to your account. Please complete onboarding.' 
          : 'Tiada kelab yang ditetapkan untuk akaun anda. Sila lengkapkan pendaftaran.');
      } else if (errCode === 'dispatch_failed') {
        setError(lang === 'en' 
          ? 'Authentication routing failed. Please try signing in again.' 
          : 'Penghalaan pengesahan gagal. Sila cuba log masuk semula.');
      }
    }
  }, [searchParams, lang]);

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'ms' : 'en';
    setLang(nextLang);
    localStorage.setItem('scms_language', nextLang);
  };

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        throw new Error(lang === 'en' 
          ? 'Sign-in is temporarily unavailable. Please contact your administrator.' 
          : 'Perkhidmatan log masuk tidak tersedia buat sementara waktu. Sila hubungi pentadbir anda.');
      }

      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        let msg = authError.message;
        if (msg.toLowerCase().includes('invalid login credentials')) {
          msg = lang === 'en' 
            ? 'Invalid email or password. Please verify and try again.' 
            : 'Emel atau kata laluan tidak sah. Sila semak dan cuba lagi.';
        }
        throw new Error(msg);
      }

      if (data?.user?.user_metadata?.temp_password) {
        window.location.href = '/update-password';
        return;
      }

      // Fetch authoritative route destination from server
      const res = await fetch('/api/auth/route-dispatch', {
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        const body = await res.json();
        if (body?.destination) {
          window.location.href = body.destination;
          return;
        }
      }

      // Fallback direct navigation
      window.location.href = '/api/auth/route-dispatch';
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === 'en' ? 'Unable to sign in. Please try again.' : 'Gagal untuk log masuk. Sila cuba lagi.'));
      setLoading(false);
    }
  }

  const t = {
    brandSub: 'BY SP SPORTDATA SOLUTION',
    eyebrow: lang === 'en' ? 'CLUB TO COMPETITION' : 'DARI KELAB KE KEJOHANAN',
    heroH1: lang === 'en' ? <>Stronger clubs.<br />Seamless tournaments.<br /><span>Every point matters.</span></> : <>Kelab lebih kukuh.<br />Kejohanan lancar.<br /><span>Setiap mata penting.</span></>,
    intro: lang === 'en' ? 'Bring your club, athletes and competition day together with SCMS and KarateTech 3.0.' : 'Satukan kelab, atlet dan kejohanan anda dengan SCMS dan KarateTech 3.0.',
    scmsDesc: lang === 'en' ? 'Manage clubs, dojos, member profiles and approvals in one workspace.' : 'Urus kelab, dojo, profil ahli dan kelulusan dalam satu ruang kerja.',
    ktDesc: lang === 'en' ? 'Organize registrations, categories, draws, bouts and tatami operations.' : 'Urus pendaftaran, kategori, undian jadual, perlawanan dan operasi tatami.',
    competitionTag: lang === 'en' ? 'COMPETITION WORKSPACE' : 'RUANG KERJA PERTANDINGAN',
    competitionSub: lang === 'en' ? 'Scoring, bout timing and spectator displays' : 'Pemarkahan, masa perlawanan dan paparan penonton',
    exploreKt: lang === 'en' ? 'Explore KarateTech 3.0' : 'Terokai KarateTech 3.0',
    ecosystemTag: lang === 'en' ? 'ONE CONNECTED SPORTS ECOSYSTEM' : 'SATU EKOSISTEM SUKAN BERSEPADU',
    ecosystemSub: lang === 'en' ? 'Built for clubs. Ready for competition.' : 'Dibina untuk kelab. Bersedia untuk kejohanan.',
    portalTop: lang === 'en' ? 'SCMS PORTAL' : 'PORTAL SCMS',
    regClub: lang === 'en' ? 'Register your club' : 'Daftar kelab anda',
    formEyebrow: lang === 'en' ? 'YOUR CLUB. YOUR WORKSPACE.' : 'KELAB ANDA. RUANG KERJA ANDA.',
    welcome: lang === 'en' ? 'Welcome back.' : 'Selamat kembali.',
    welcomeSub: lang === 'en' ? 'Sign in to manage your club and prepare your athletes for their next competition.' : 'Log masuk untuk mengurus kelab anda dan menyediakan atlet anda untuk pertandingan.',
    emailLabel: lang === 'en' ? 'Email address' : 'Alamat emel',
    passLabel: lang === 'en' ? 'Password' : 'Kata laluan',
    forgotPass: lang === 'en' ? 'Forgot password?' : 'Lupa kata laluan?',
    signInBtn: lang === 'en' ? 'Sign in to your workspace' : 'Log masuk ke ruang kerja anda',
    signingIn: lang === 'en' ? 'Signing in…' : 'Sedang log masuk…',
    accessNote: lang === 'en' ? 'Access is based on your assigned club and role.' : 'Akses adalah berdasarkan kelab dan peranan yang ditetapkan.',
    startingClub: lang === 'en' ? 'Starting a new club?' : 'Memulakan kelab baharu?',
    createTeam: lang === 'en' ? 'Create a workspace for your team.' : 'Cipta ruang kerja untuk pasukan anda.',
    feature1: lang === 'en' ? 'Club & dojo management' : 'Pengurusan kelab & dojo',
    feature2: lang === 'en' ? 'Athlete coordination' : 'Penyelarasan atlet',
  };

  return (
    <main className={styles.page}>
      <section className={styles.story} aria-labelledby="platform-title">
        <Link href="/" className={styles.brand} aria-label="SCMS home">
          <span className={styles.brandMark}><Layers3 size={25} strokeWidth={1.7} /></span>
          <span>SCMS<span className={styles.brandSub}>{t.brandSub}</span></span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button" 
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition"
            title="Switch Language / Tukar Bahasa"
          >
            <Globe size={13} />
            <span>{lang === 'en' ? 'Bahasa Malaysia' : 'English'}</span>
          </button>
          <a className={styles.mobileSignIn} href="#sign-in-title">
            {lang === 'en' ? 'Sign in' : 'Log masuk'} <ArrowRight size={14} />
          </a>
        </div>
        <div className={styles.storyContent}>
          <p className={styles.eyebrow}><span /> {t.eyebrow}</p>
          <h1 id="platform-title">{t.heroH1}</h1>
          <p className={styles.intro}>{t.intro}</p>
          <div className={styles.products}>
            <article className={styles.product}>
              <span className={styles.productIcon}><Building2 size={21} /></span>
              <div>
                <h2>SCMS <span>{lang === 'en' ? 'CLUB MANAGEMENT' : 'PENGURUSAN KELAB'}</span></h2>
                <p>{t.scmsDesc}</p>
              </div>
            </article>
            <article className={styles.product}>
              <span className={styles.productIcon}><Trophy size={21} /></span>
              <div>
                <h2>KarateTech 3.0 <span>{lang === 'en' ? 'TOURNAMENT MANAGEMENT' : 'PENGURUSAN KEJOHANAN'}</span></h2>
                <p>{t.ktDesc}</p>
              </div>
            </article>
          </div>
          <div className={styles.competition}>
            <div className={styles.competitionHeader}>
              <span><span className={styles.statusDot} /> {t.competitionTag}</span>
              <span>WKF SCORING WORKFLOWS</span>
            </div>
            <div className={styles.competitionBody}>
              <div><span className={styles.aka}>AKA</span><span className={styles.ao}>AO</span></div>
              <p>Kata & Kumite<span>{t.competitionSub}</span></p>
              <ShieldCheck size={26} aria-hidden="true" />
            </div>
          </div>
          <a className={styles.explore} href="https://karatetech3.spsportdatasolution.org" target="_blank" rel="noopener noreferrer">
            {t.exploreKt} <ArrowRight size={16} /><span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <footer className={styles.storyFooter}>
          <span>{t.ecosystemTag}</span>
          <span>{t.ecosystemSub}</span>
        </footer>
      </section>

      <section className={styles.signIn} aria-labelledby="sign-in-title">
        <div className={styles.topline}>
          <span><LockKeyhole size={14} /> {t.portalTop}</span>
          <Link href="/register-club">{t.regClub} <ChevronRight size={15} /></Link>
        </div>
        <div className={styles.formWrap}>
          <div className={styles.welcomeIcon}><Users size={25} strokeWidth={1.6} /></div>
          <p className={styles.formEyebrow}>{t.formEyebrow}</p>
          <h2 id="sign-in-title">{t.welcome}</h2>
          <p className={styles.formIntro}>{t.welcomeSub}</p>

          {error && <div id="login-error" role="alert" className={styles.error}>{error}</div>}

          <form onSubmit={handleLogin} className={styles.form} aria-describedby={error ? 'login-error' : undefined} aria-busy={loading}>
            <div>
              <label htmlFor="email">{t.emailLabel}</label>
              <input 
                id="email" 
                name="email" 
                type="email" 
                autoComplete="username" 
                placeholder="you@yourclub.com" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                disabled={loading} 
              />
            </div>
            <div>
              <div className={styles.passwordLabel}>
                <label htmlFor="password">{t.passLabel}</label>
                <Link href="/forgot-password">{t.forgotPass}</Link>
              </div>
              <div className={styles.passwordInput}>
                <input 
                  id="password" 
                  name="password" 
                  type={showPassword ? 'text' : 'password'} 
                  autoComplete="current-password" 
                  placeholder={lang === 'en' ? 'Enter your password' : 'Masukkan kata laluan'} 
                  required 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  disabled={loading} 
                />
                <button 
                  type="button" 
                  aria-label={showPassword ? 'Hide password' : 'Show password'} 
                  aria-pressed={showPassword} 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>
            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? (
                <><Loader2 size={19} className="animate-spin" /> {t.signingIn}</>
              ) : (
                <>{t.signInBtn} <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div className={styles.accessNote}>
            <ShieldCheck size={17} />
            <span>{t.accessNote}</span>
          </div>
          <div className={styles.newClub}>
            <div>
              <h3>{t.startingClub}</h3>
              <p>{t.createTeam}</p>
            </div>
            <Link href="/register-club" aria-label="Register a new club">
              <ArrowRight size={21} />
            </Link>
          </div>
          <div className={styles.formBenefits}>
            <span><Check size={13} /> {t.feature1}</span>
            <span><Check size={13} /> {t.feature2}</span>
          </div>
        </div>
        <footer className={styles.signInFooter}>
          <span>© {new Date().getFullYear()} SP SportData Solution</span>
          <span>SCMS × KarateTech 3.0</span>
        </footer>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className={styles.loginContainer}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0f1d' }}>
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
