'use client';

/**
 * Scms Club Registration Wizard Component
 * Section 9: Step-by-step multi-field registration wizard, immutable Club ID generation, SuperAdmin approval queue
 */

import React, { useState } from 'react';
import { store } from '@/lib/store';
import { Club } from '@/types';
import {
  Building2,
  User,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  ShieldAlert,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Globe,
} from 'lucide-react';

interface ClubRegistrationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (club: Club) => void;
}

export default function ClubRegistrationWizard({
  isOpen,
  onClose,
  onSuccess,
}: ClubRegistrationWizardProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdClub, setCreatedClub] = useState<Club | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [scoreboardAbbreviation, setScoreboardAbbreviation] = useState('');
  const [sport, setSport] = useState('Karate');
  const [registrationNo, setRegistrationNo] = useState('');
  const [establishedYear, setEstablishedYear] = useState(new Date().getFullYear());
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Selangor');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('Malaysia');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');

  // Primary Admin State
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const club = store.registerClub(
        {
          name,
          shortName: shortName || name,
          scoreboardAbbreviation,
          sport,
          registrationNo,
          establishedYear,
          address,
          city,
          state,
          postcode,
          country,
          phone,
          email,
          website,
          description,
        },
        {
          name: adminName,
          email: adminEmail,
          phone: adminPhone,
        }
      );

      setCreatedClub(club);
      setStep(3); // Success step
      onSuccess(club);
    } catch (err) {
      console.error('Club registration error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Wizard Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-[#0284C7] font-black">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900">Club Registration Wizard</h3>
              <span className="text-xs text-slate-500">
                Step {step} of 3: {step === 1 ? 'Club Information' : step === 2 ? 'Primary Administrator' : 'Submission Completed'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5 my-4 rounded-full overflow-hidden">
          <div
            className="bg-[#0284C7] h-full transition-all duration-300"
            style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
          />
        </div>

        {/* STEP 1: Club Information */}
        {step === 1 && (
          <form
            onSubmit={e => {
              e.preventDefault();
              setStep(2);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Full Club Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kelab Karate Do Senshi Goju-Ryu"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Short Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senshi Karate"
                  value={shortName}
                  onChange={e => setShortName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Scoreboard Abbreviation (KarateTech) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  placeholder="e.g. Senshi Karate, MAS"
                  value={scoreboardAbbreviation}
                  onChange={e => setScoreboardAbbreviation(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Primary Sport *
                </label>
                <select
                  value={sport}
                  onChange={e => setSport(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                >
                  <option value="Karate">Karate (WKF / KarateTech Integrated) 🥋</option>
                  <option value="Football">Football / Soccer ⚽</option>
                  <option value="Swimming">Swimming 🏊</option>
                  <option value="Kabaddi">Kabaddi 🤼</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Registration / ROS / SSM No. *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. C SGR-13884"
                  value={registrationNo}
                  onChange={e => setRegistrationNo(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Established Year
                </label>
                <input
                  type="number"
                  value={establishedYear}
                  onChange={e => setEstablishedYear(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. No. 23, Jalan SP8/14, Saujana Puchong"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Puchong"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  State *
                </label>
                <input
                  type="text"
                  required
                  value={state}
                  onChange={e => setState(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-sm rounded-xl flex items-center space-x-2 transition-all shadow-xs"
              >
                <span>Continue to Administrator Info</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Primary Administrator Information */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-sky-50 p-3.5 rounded-xl border border-sky-200 text-xs text-sky-800 space-y-1">
              <span className="font-bold block">Administrator Role Notice:</span>
              <p>
                The primary administrator will receive default <strong>Club Admin</strong> privileges once this club registration is reviewed and approved by Platform SuperAdmin.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Primary Administrator Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shihan Kannan / Coach Alex"
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Administrator Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@senshikarate.org"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Administrator Mobile Phone *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +6012-3456789"
                  value={adminPhone}
                  onChange={e => setAdminPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Set Initial Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-sm rounded-xl flex items-center space-x-2 transition-all shadow-xs disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Registering...' : 'Submit Club Registration'}</span>
                <CheckCircle2 size={16} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Success Confirmation */}
        {step === 3 && createdClub && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>

            <h4 className="text-2xl font-black text-slate-900">
              Club Registration Submitted!
            </h4>

            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Your club application has been successfully submitted to the Platform SuperAdmin approval queue.
            </p>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-sm mx-auto text-left space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Immutable ID:</span>
                <span className="font-mono font-bold text-[#0284C7]">{createdClub.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Club Name:</span>
                <span className="font-bold text-slate-800">{createdClub.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sport:</span>
                <span className="font-bold text-slate-800">{createdClub.sport}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Initial Status:</span>
                <span className="font-bold text-amber-600">Pending Approval</span>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all shadow-xs"
              >
                Return to Directory
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
