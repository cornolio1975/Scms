'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Building2, Check, ChevronRight, Eye, EyeOff, Layers3, Loader2, LockKeyhole, ShieldCheck, Trophy, Users } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        throw new Error('Sign-in is temporarily unavailable. Please contact your administrator.');
      }
      const { data, error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (data?.user?.user_metadata?.temp_password) {
        router.push('/update-password');
        return;
      }
      // Authorization and destination are resolved on the server.
      router.push('/api/auth/route-dispatch');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.story} aria-labelledby="platform-title">
        <Link href="/" className={styles.brand} aria-label="SCMS home">
          <span className={styles.brandMark}><Layers3 size={25} strokeWidth={1.7} /></span>
          <span>SCMS<span className={styles.brandSub}>BY SP SPORTDATA SOLUTION</span></span>
        </Link>
        <a className={styles.mobileSignIn} href="#sign-in-title">Sign in <ArrowRight size={14} /></a>
        <div className={styles.storyContent}>
          <p className={styles.eyebrow}><span /> CLUB TO COMPETITION</p>
          <h1 id="platform-title">Stronger clubs.<br />Seamless tournaments.<br /><span>Every point matters.</span></h1>
          <p className={styles.intro}>Bring your club, athletes and competition day together with SCMS and KarateTech 3.0.</p>
          <div className={styles.products}>
            <article className={styles.product}>
              <span className={styles.productIcon}><Building2 size={21} /></span>
              <div><h2>SCMS <span>CLUB MANAGEMENT</span></h2><p>Manage clubs, dojos, member profiles and approvals in one workspace.</p></div>
            </article>
            <article className={styles.product}>
              <span className={styles.productIcon}><Trophy size={21} /></span>
              <div><h2>KarateTech 3.0 <span>TOURNAMENT MANAGEMENT</span></h2><p>Organize registrations, categories, draws, bouts and tatami operations.</p></div>
            </article>
          </div>
          <div className={styles.competition}>
            <div className={styles.competitionHeader}><span><span className={styles.statusDot} /> COMPETITION WORKSPACE</span><span>WKF SCORING WORKFLOWS</span></div>
            <div className={styles.competitionBody}>
              <div><span className={styles.aka}>AKA</span><span className={styles.ao}>AO</span></div>
              <p>Kata & Kumite<span>Scoring, bout timing and spectator displays</span></p>
              <ShieldCheck size={26} aria-hidden="true" />
            </div>
          </div>
          <a className={styles.explore} href="https://karatetech3.spsportdatasolution.org" target="_blank" rel="noopener noreferrer">Explore KarateTech 3.0 <ArrowRight size={16} /><span className="sr-only"> (opens in a new tab)</span></a>
        </div>
        <footer className={styles.storyFooter}><span>ONE CONNECTED SPORTS ECOSYSTEM</span><span>Built for clubs. Ready for competition.</span></footer>
      </section>

      <section className={styles.signIn} aria-labelledby="sign-in-title">
        <div className={styles.topline}><span><LockKeyhole size={14} /> SCMS PORTAL</span><Link href="/register-club">Register your club <ChevronRight size={15} /></Link></div>
        <div className={styles.formWrap}>
          <div className={styles.welcomeIcon}><Users size={25} strokeWidth={1.6} /></div>
          <p className={styles.formEyebrow}>YOUR CLUB. YOUR WORKSPACE.</p>
          <h2 id="sign-in-title">Welcome back.</h2>
          <p className={styles.formIntro}>Sign in to manage your club and prepare your athletes for their next competition.</p>
          {error && <div id="login-error" role="alert" className={styles.error}>{error}</div>}
          <form onSubmit={handleLogin} className={styles.form} aria-describedby={error ? 'login-error' : undefined} aria-busy={loading}>
            <div><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" placeholder="you@yourclub.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={loading} /></div>
            <div><div className={styles.passwordLabel}><label htmlFor="password">Password</label><Link href="/forgot-password">Forgot password?</Link></div>
              <div className={styles.passwordInput}><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={e => setPassword(e.target.value)} disabled={loading} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
            </div>
            <button className={styles.submit} type="submit" disabled={loading}>{loading ? <><Loader2 size={19} className="animate-spin" /> Signing in…</> : <>Sign in to your workspace <ArrowRight size={18} /></>}</button>
          </form>
          <div className={styles.accessNote}><ShieldCheck size={17} /><span>Access is based on your assigned club and role.</span></div>
          <div className={styles.newClub}><div><h3>Starting a new club?</h3><p>Create a workspace for your team.</p></div><Link href="/register-club" aria-label="Register a new club"><ArrowRight size={21} /></Link></div>
          <div className={styles.formBenefits}><span><Check size={13} /> Club & dojo management</span><span><Check size={13} /> Athlete coordination</span></div>
        </div>
        <footer className={styles.signInFooter}><span>© {new Date().getFullYear()} SP SportData Solution</span><span>SCMS × KarateTech 3.0</span></footer>
      </section>
    </main>
  );
}
