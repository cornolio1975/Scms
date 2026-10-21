'use client';

/**
 * Scms Public Landing Page & Registered Club Directory
 * Sections 7 & 8: Professional public landing page, interactive directory, "Enter Club" modal flow
 */

import React, { useState } from 'react';
import Image from 'next/image';
import { store } from '@/lib/store';
import { Club } from '@/types';
import {
  Building2,
  Search,
  Filter,
  Trophy,
  Users,
  Shield,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ExternalLink,
  MapPin,
  CheckCircle2,
  Phone,
  Mail,
  Lock,
  Globe,
  Award,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';

interface LandingPageProps {
  onEnterApp: () => void;
  onOpenClubRegistration: () => void;
}

export default function LandingPage({ onEnterApp, onOpenClubRegistration }: LandingPageProps) {
  const { login } = useAuth();
  const [selectedSport, setSelectedSport] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Login Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedClubForLogin, setSelectedClubForLogin] = useState<Club | null>(null);
  const [loginEmail, setLoginEmail] = useState('kannan@senshikarate.org');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [requestedRole, setRequestedRole] = useState('MEMBER');

  const clubs = store.getClubs('Active');

  const filteredClubs = clubs
    .filter(c => {
      const matchesSport = selectedSport === 'All' || c.sport.toLowerCase() === selectedSport.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSport && matchesSearch;
    })
    .sort((a, b) => {
      return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });

  const handleEnterClub = (club: Club) => {
    setSelectedClubForLogin(club);
    // Pre-fill primary admin email for smooth demo experience
    if (club.primaryAdminEmail) {
      setLoginEmail(club.primaryAdminEmail);
    }
    setIsSignUp(false);
    setLoginError('');
    setIsLoginModalOpen(true);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const supabase = createClient();

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: loginEmail,
        password: loginPassword,
        options: {
          data: { 
            full_name: fullName,
            requested_role: requestedRole
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      if (error) {
        setLoginError(error.message);
      } else {
        setLoginError('Account created successfully! You can now sign in.');
      }
    } else {
      const cleanEmail = loginEmail.replace(/\s+/g, '').toLowerCase();
      const cleanPassword = loginPassword.trim();
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!error) {
        setIsLoginModalOpen(false);
        onEnterApp();
      } else {
        // Fallback to mock auth for demo personas
        const success = await login(loginEmail, loginPassword);
        if (success) {
          setIsLoginModalOpen(false);
          onEnterApp();
        } else {
          setLoginError("Auth error: " + error.message);
        }
      }
    }
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setLoginError(error.message);
  };

  const handleQuickDemoSuperAdmin = async () => {
    await login('superadmin@spsportdata.org', 'admin');
    onEnterApp();
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      {/* 1. TOP ANNOUNCEMENT BANNER */}
      <div className="bg-gradient-to-r from-sky-600 to-blue-700 text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center space-x-2">
        <Sparkles size={14} className="shrink-0 animate-pulse text-sky-200" />
        <span>Official Launch: Integrated with KarateTech 3.0 Platform for Tournament Management</span>
        <button
          onClick={handleQuickDemoSuperAdmin}
          className="ml-3 underline font-bold hover:text-sky-100 transition-colors"
        >
          SuperAdmin One-Click Demo
        </button>
      </div>

      {/* 2. PUBLIC HEADER NAVIGATION */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center overflow-hidden h-full py-1">
          <Image
            src="/logo.jpg"
            alt="SP SportData Solution"
            width={220}
            height={44}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>

        <nav className="hidden md:flex items-center space-x-6 text-sm font-semibold text-slate-600">
          <a href="#about" className="hover:text-[#0284C7] transition-colors">About</a>
          <a href="#directory" className="hover:text-[#0284C7] transition-colors">Club Directory</a>
          <a href="#sports" className="hover:text-[#0284C7] transition-colors">Supported Sports</a>
          <a href="#karatetech" className="hover:text-[#0284C7] transition-colors">KarateTech 3.0</a>
          <a href="#features" className="hover:text-[#0284C7] transition-colors">Features</a>
        </nav>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setSelectedClubForLogin(null);
              setLoginEmail('superadmin@spsportdata.org');
              setIsSignUp(false);
              setLoginError('');
              setIsLoginModalOpen(true);
            }}
            className="px-6 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] shadow-md shadow-sky-500/20 transition-all touch-target"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F0F9FF] via-white to-white py-16 sm:py-24 px-4 sm:px-8 border-b border-slate-100">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-100/80 border border-sky-200 text-[#0284C7] text-xs font-bold tracking-wide uppercase shadow-xs">
            <Shield size={14} />
            <span>Multi-Club • Multi-Branch • Multi-Sport SaaS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-950 tracking-tight leading-tight">
            Welcome to <span className="text-[#0284C7]">SCMS</span>
          </h1>

          <p className="text-xl sm:text-2xl font-bold text-slate-700">
            Sports Club Management System
          </p>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Enterprise sports administration platform engineered for high-performance clubs, branches, coaches, volunteers, and athletes. Powered by <strong className="text-slate-900">SP SportData Solution</strong>.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#directory"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] shadow-lg shadow-sky-600/25 flex items-center justify-center space-x-2 transition-all touch-target"
            >
              <span>Explore Registered Clubs</span>
              <ArrowRight size={18} />
            </a>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-3xl mx-auto">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">4+</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Clubs</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center">
              <span className="text-2xl sm:text-3xl font-black text-[#0284C7] block">7+</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dojos & Branches</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">300+</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Athletes</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 block">100%</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Isolated Tenants</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. REGISTERED CLUB DIRECTORY (Section 8) */}
      <section id="directory" className="py-16 px-4 sm:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
              <Building2 size={14} />
              <span>Public Directory</span>
            </div>
            <h2 className="text-3xl font-black text-slate-950 tracking-tight">
              Registered Sports Clubs
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Select your sports club to access your club dashboard, dojo schedule, and member portal.
            </p>
          </div>

          {/* Directory Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search club name, city..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
              />
            </div>

            {/* Sport Filter */}
            <select
              value={selectedSport}
              onChange={e => setSelectedSport(e.target.value)}
              className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="All">All Sports</option>
              <option value="Karate">Karate 🥋</option>
              <option value="Kabaddi">Kabaddi 🤼</option>
            </select>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Sort {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
            </button>
          </div>
        </div>

        {/* Club Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClubs.map(club => (
            <div
              key={club.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group hover:border-[#BAE6FD]"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center font-black text-xl text-[#0284C7] shadow-xs">
                    {club.name.charAt(0)}
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-[#0284C7] border border-sky-200">
                    {club.sport}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 group-hover:text-[#0284C7] transition-colors leading-snug">
                    {club.name}
                  </h3>
                  <span className="text-xs font-mono text-slate-400 block mt-0.5">{club.id}</span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {club.description || 'Dedicated sports training club committed to community development.'}
                </p>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                  <div className="flex items-center space-x-2">
                    <MapPin size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{club.city}, {club.state}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Branches / Dojos:</span>
                    <span className="font-bold text-slate-800">{club.branchCount || 1}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Registered Members:</span>
                    <span className="font-bold text-slate-800">{club.memberCount || 0}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleEnterClub(club)}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0284C7] hover:bg-[#0369A1] transition-all flex items-center justify-center space-x-2 shadow-xs group-hover:shadow-md"
                >
                  <span>Enter Club</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. SUPPORTED SPORTS & SPORT CONFIGURATION ENGINE (Section 22) */}
      <section id="sports" className="py-16 px-4 sm:px-8 bg-slate-50 border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-3xl font-black text-slate-950 tracking-tight">
              Configurable Sport Engine
            </h2>
            <p className="text-sm text-slate-600">
              SCMS core remains strictly sport-neutral. Dynamic sport configurations allow tailored belts, categories, and positions without rewriting core architecture.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="text-4xl block">🥋</span>
              <h3 className="font-black text-lg text-slate-900">Karate</h3>
              <p className="text-xs text-slate-500">
                WKF Kata & Kumite rules, Kyu/Dan belt ladders, official weigh-in limits, and direct KarateTech 3.0 tournament sync.
              </p>
              <span className="inline-block text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Full KT 3.0 Bridge
              </span>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="text-4xl block">🤼</span>
              <h3 className="font-black text-lg text-slate-900">Kabaddi</h3>
              <p className="text-xs text-slate-500">
                Raider and Corner Defender role tracking, official weigh-in checks, and tournament bracket eligibility.
              </p>
              <span className="inline-block text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. KARATETECH 3.0 INTEGRATION SHOWCASE (Section 58-67) */}
      <section id="karatetech" className="py-16 px-4 sm:px-8 max-w-6xl mx-auto w-full">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-bold tracking-wide uppercase">
              <Trophy size={14} />
              <span>Controlled Integration</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Seamless KarateTech 3.0 Tournament Integration
            </h2>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Karate clubs managed in SCMS seamlessly discover official tournaments, automatically evaluate category criteria, and submit idempotent registration rosters directly to KarateTech 3.0 without duplicate identities.
            </p>

            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-200">
              <li className="flex items-center space-x-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>Authoritative Bracket, Bout & Tatami Management preserved in KarateTech 3.0</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>Idempotent registration submissions with zero duplicate entries</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>Volunteers assigned tournament duties without granting unauthorized official roles</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="mt-auto bg-slate-950 text-slate-400 text-xs py-10 px-4 sm:px-8 border-t border-slate-900">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#0284C7] flex items-center justify-center text-white font-extrabold text-sm">
              S
            </div>
            <div>
              <span className="font-extrabold text-white text-sm block">SCMS</span>
              <span className="text-[10px] text-slate-500">Powered by SP SportData Solution</span>
            </div>
          </div>

          <div className="text-center md:text-right space-y-1">
            <p>© {new Date().getFullYear()} SP SportData Solution. All rights reserved.</p>
            <p className="text-slate-500 text-[11px]">
              Multi-Club • Multi-Branch • KarateTech 3.0 Ready • Mobile-First SaaS Architecture
            </p>
          </div>
        </div>
      </footer>

      {/* 8. SECURE LOGIN MODAL ("Enter Club") */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center text-[#0284C7] font-black">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900">Enter Club Portal</h3>
                  <span className="text-xs text-slate-500">
                    {selectedClubForLogin ? selectedClubForLogin.shortName : 'SCMS Unified Sign-In'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-3 text-slate-400" size={16} />
                    <input
                      type="text"
                      required={isSignUp}
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  >
                    {showLoginPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Requested Role
                  </label>
                  <select
                    value={requestedRole}
                    onChange={(e) => setRequestedRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                  >
                    <option value="MEMBER">Athlete / Member</option>
                    <option value="CLUB_ADMIN">Club Manager</option>
                    <option value="BRANCH_MANAGER">Branch Manager</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="italic text-[11px]">Role is automatically resolved.</span>
                {!isSignUp && (
                  <a href="/forgot-password" className="text-[#0284C7] font-semibold hover:underline">
                    Forgot?
                  </a>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-[#0284C7] hover:bg-[#0369A1] transition-all shadow-md shadow-sky-600/20"
              >
                {isSignUp ? 'Create Account' : 'Authenticate & Enter Dashboard'}
              </button>
            </form>

            <div className="text-center mt-4">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-400">Or</span>
                </div>
              </div>
              
              <button
                onClick={handleGoogleLogin}
                className="w-full py-2.5 mb-4 flex items-center justify-center space-x-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm font-semibold text-[#0284C7] hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
