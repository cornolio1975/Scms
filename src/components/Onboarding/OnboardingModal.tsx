'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';
import {
  User,
  ShieldCheck,
  Camera,
  Upload,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Building,
  Phone,
  Home,
  CreditCard,
  HeartHandshake,
  Lock,
  Sparkles,
} from 'lucide-react';

interface OnboardingModalProps {
  forceOpen?: boolean;
  onComplete?: () => void;
}

export default function OnboardingModal({ forceOpen = false, onComplete }: OnboardingModalProps) {
  const { currentUser, refreshSession } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'ms'>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [icPassport, setIcPassport] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [requestedRole, setRequestedRole] = useState('MEMBER');
  const [photoVisibility, setPhotoVisibility] = useState<'PUBLIC' | 'CLUB_ONLY' | 'ADMIN_ONLY' | 'PRIVATE'>('CLUB_ONLY');
  const [otherInfo, setOtherInfo] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Camera capture state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MALAYSIAN_STATES = [
    'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
    'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
    'Sarawak', 'Selangor', 'Terengganu', 'Wilayah Persekutuan Kuala Lumpur',
    'Wilayah Persekutuan Labuan', 'Wilayah Persekutuan Putrajaya'
  ];

  // Check whether modal should display
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    if (currentUser) {
      // Check if onboarding is incomplete
      if (currentUser.onboardingCompleted === false) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }
  }, [currentUser, forceOpen]);

  // Load existing data or saved draft
  useEffect(() => {
    if (!currentUser) return;

    // Load language preference
    const savedLang = localStorage.getItem('scms_language') as 'en' | 'ms';
    if (savedLang) setLang(savedLang);

    // Check localStorage draft first
    const draftKey = `scms_onboarding_draft_${currentUser.id}`;
    const savedDraft = localStorage.getItem(draftKey);
    let draftData: any = null;
    if (savedDraft) {
      try {
        draftData = JSON.parse(savedDraft);
      } catch (e) {
        console.warn('Failed to parse draft', e);
      }
    }

    setFullName(draftData?.fullName || currentUser.fullName || '');
    setPhone(draftData?.phone || currentUser.phone || '');
    setIcPassport(draftData?.icPassport || currentUser.icPassport || '');
    setResidentialAddress(draftData?.residentialAddress || currentUser.residentialAddress || '');
    setCity(draftData?.city || '');
    setState(draftData?.state || '');
    setPostcode(draftData?.postcode || '');
    setEmergencyContactName(draftData?.emergencyContactName || currentUser.emergencyContactName || '');
    setEmergencyContactPhone(draftData?.emergencyContactPhone || currentUser.emergencyContactPhone || '');
    setRequestedRole(draftData?.requestedRole || currentUser.activeRole || 'MEMBER');
    setPhotoVisibility(draftData?.photoVisibility || currentUser.photoVisibility || 'CLUB_ONLY');
    setOtherInfo(draftData?.otherInfo || currentUser.otherInfo || '');
    setAvatarUrl(draftData?.avatarUrl || currentUser.avatarUrl || '');
  }, [currentUser]);

  // Auto-save draft on changes
  const saveDraft = () => {
    if (!currentUser) return;
    const draftKey = `scms_onboarding_draft_${currentUser.id}`;
    const draft = {
      fullName,
      phone,
      icPassport,
      residentialAddress,
      city,
      state,
      postcode,
      emergencyContactName,
      emergencyContactPhone,
      requestedRole,
      photoVisibility,
      otherInfo,
      avatarUrl,
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  };

  useEffect(() => {
    if (isOpen && currentUser) {
      saveDraft();
    }
  }, [
    fullName, phone, icPassport, residentialAddress, city, state,
    postcode, emergencyContactName, emergencyContactPhone,
    requestedRole, photoVisibility, otherInfo, avatarUrl
  ]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setIsCameraActive(false);
      setError(lang === 'en' ? 'Unable to access camera. Please upload an image file instead.' : 'Gagal mengakses kamera. Sila muat naik fail gambar.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 400, 400);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setAvatarUrl(dataUrl);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError(lang === 'en' ? 'Photo size exceeds 5MB limit.' : 'Saiz gambar melebihi had 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleLanguage = () => {
    const next = lang === 'en' ? 'ms' : 'en';
    setLang(next);
    localStorage.setItem('scms_language', next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    // Validation
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError(lang === 'en' ? 'Please provide your full legal name.' : 'Sila masukkan nama penuh yang sah.');
      return;
    }

    if (!icPassport.trim() || icPassport.trim().length < 4) {
      setError(lang === 'en' ? 'Please enter a valid IC or Passport number.' : 'Sila masukkan nombor Kad Pengenalan / Pasport yang sah.');
      return;
    }

    if (!residentialAddress.trim() || residentialAddress.trim().length < 5) {
      setError(lang === 'en' ? 'Please provide your full residential address.' : 'Sila masukkan alamat kediaman yang lengkap.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 7) {
      setError(lang === 'en' ? 'Please enter a valid contact phone number.' : 'Sila masukkan nombor telefon yang sah.');
      return;
    }

    if (!emergencyContactName.trim()) {
      setError(lang === 'en' ? 'Emergency contact name is required.' : 'Nama waris kecemasan diperlukan.');
      return;
    }

    if (!emergencyContactPhone.trim() || emergencyContactPhone.trim().length < 7) {
      setError(lang === 'en' ? 'Emergency contact phone number is required.' : 'Nombor telefon waris kecemasan diperlukan.');
      return;
    }

    setLoading(true);

    try {
      let finalAvatarUrl = avatarUrl;

      // If avatar is a base64 string and user is authenticated, upload to Supabase storage
      if (avatarUrl && avatarUrl.startsWith('data:') && currentUser) {
        try {
          const supabase = createClient();
          const res = await fetch(avatarUrl);
          const blob = await res.blob();
          const fileName = `${currentUser.id}/avatar_${Date.now()}.jpg`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, {
              upsert: true,
              contentType: 'image/jpeg',
            });

          if (!uploadErr && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(uploadData.path);
            if (publicUrlData?.publicUrl) {
              finalAvatarUrl = publicUrlData.publicUrl;
            }
          }
        } catch (uploadException) {
          console.warn('Storage upload fallback:', uploadException);
        }
      }

      // Submit to Onboarding API
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          icPassport,
          residentialAddress,
          city,
          state,
          postcode,
          phone,
          emergencyContactName,
          emergencyContactPhone,
          requestedRole,
          avatarUrl: finalAvatarUrl,
          photoVisibility,
          otherInfo,
          language: lang,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || (lang === 'en' ? 'Failed to save profile' : 'Gagal menyimpan profil'));
      }

      // Clear draft
      if (currentUser) {
        localStorage.removeItem(`scms_onboarding_draft_${currentUser.id}`);
      }

      setSuccess(true);
      await refreshSession();

      setTimeout(() => {
        setIsOpen(false);
        if (onComplete) onComplete();
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === 'en' ? 'Submission error' : 'Ralat penghantaran'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const t = {
    title: lang === 'en' ? 'Complete Your Registration' : 'Lengkapkan Pendaftaran Anda',
    subtitle: lang === 'en' 
      ? 'Please provide your required information to activate your sports club workspace and tournament eligibility.'
      : 'Sila lengkapkan maklumat wajib ini untuk mengaktifkan ruang kerja kelab dan kelayakan pertandingan anda.',
    langSwitch: lang === 'en' ? 'Bahasa Malaysia' : 'English',
    personalSection: lang === 'en' ? '1. Personal Information' : '1. Maklumat Peribadi',
    fullName: lang === 'en' ? 'Full Name (as per IC/Passport)' : 'Nama Penuh (seperti dalam MyKad/Pasport)',
    icPassport: lang === 'en' ? 'IC / Passport Number' : 'Nombor MyKad / Pasport',
    phone: lang === 'en' ? 'Contact Phone Number' : 'Nombor Telefon Hubungan',
    addressSection: lang === 'en' ? '2. Residential Address' : '2. Alamat Kediaman',
    address: lang === 'en' ? 'Full Residential Address' : 'Alamat Kediaman Lengkap',
    city: lang === 'en' ? 'City' : 'Bandar',
    state: lang === 'en' ? 'State' : 'Negeri',
    postcode: lang === 'en' ? 'Postcode' : 'Poskod',
    emergencySection: lang === 'en' ? '3. Emergency Contact' : '3. Hubungan Kecemasan / Waris',
    emergencyName: lang === 'en' ? 'Emergency Contact Name' : 'Nama Waris Kecemasan',
    emergencyPhone: lang === 'en' ? 'Emergency Contact Phone' : 'Nombor Telefon Waris Kecemasan',
    roleSection: lang === 'en' ? '4. Primary Role in Club' : '4. Peranan Utama dalam Kelab',
    userRole: lang === 'en' ? 'Your Primary Role' : 'Peranan Utama Anda',
    photoSection: lang === 'en' ? '5. Profile Photo & Visibility' : '5. Gambar Profil & Keizinan',
    uploadPhoto: lang === 'en' ? 'Upload Photo' : 'Muat Naik Gambar',
    takePhoto: lang === 'en' ? 'Use Camera' : 'Guna Kamera',
    snapPhoto: lang === 'en' ? 'Take Snapshot' : 'Ambil Gambar',
    cancelCamera: lang === 'en' ? 'Cancel Camera' : 'Batal Kamera',
    photoVisibilityLabel: lang === 'en' ? 'Photograph Visibility Preference' : 'Pilihan Keterlihatan Gambar',
    visClubOnly: lang === 'en' ? 'Club Members & Coaches Only' : 'Ahli Kelab & Jurulatih Sahaja',
    visPublic: lang === 'en' ? 'Public (Tournament Spectators & Display)' : 'Awam (Paparan Kejohanan & Penonton)',
    visAdminOnly: lang === 'en' ? 'Administrators Only' : 'Pentadbir Sahaja',
    visPrivate: lang === 'en' ? 'Strictly Private' : 'Peribadi Sahaja',
    otherSection: lang === 'en' ? '6. Additional Information' : '6. Maklumat Tambahan',
    otherInfoPlaceholder: lang === 'en' ? 'Dietary notes, medical alerts, existing belt grade, or dojo branch...' : 'Nota perubatan, alergi, gred tali pinggang sedia ada, atau dojo pilihan...',
    draftNotice: lang === 'en' ? 'Incomplete onboarding drafts are saved automatically on this device.' : 'Draf pendaftaran anda disimpan secara automatik pada peranti ini.',
    submitBtn: lang === 'en' ? 'Save & Complete Onboarding' : 'Simpan & Selesaikan Pendaftaran',
    savingBtn: lang === 'en' ? 'Saving Information…' : 'Menyimpan Maklumat…',
    successMsg: lang === 'en' ? 'Onboarding completed successfully! Refreshing workspace...' : 'Pendaftaran berjaya dilengkapkan! Mengemas kini ruang kerja...',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div 
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-labelledby="onboarding-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 sm:p-8">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-semibold border border-indigo-400/30">
              <Sparkles size={14} />
              <span>SP SPORTDATA SOLUTION</span>
            </div>
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition border border-white/15"
            >
              <Globe size={13} />
              <span>{t.langSwitch}</span>
            </button>
          </div>
          <h2 id="onboarding-modal-title" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {t.title}
          </h2>
          <p className="mt-2 text-sm text-indigo-100/90 leading-relaxed max-w-2xl">
            {t.subtitle}
          </p>
        </div>

        {/* Content & Form */}
        <div className="p-6 sm:p-8 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 mt-0.5 text-rose-600" />
              <div className="text-sm font-medium">{error}</div>
            </div>
          )}

          {success ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{t.successMsg}</h3>
              <p className="text-sm text-slate-500">Redirecting to your dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Section 1: Personal Info */}
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <User size={18} className="text-indigo-600" />
                  <span>{t.personalSection}</span>
                </h3>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.fullName} *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g. Ahmad bin Muhammad / Tan Wei Meng"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.icPassport} *
                    </label>
                    <input
                      type="text"
                      required
                      value={icPassport}
                      onChange={e => setIcPassport(e.target.value)}
                      placeholder="e.g. 980102-14-5567 / A12345678"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.phone} *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="e.g. +60123456789"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Residential Address */}
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Home size={18} className="text-indigo-600" />
                  <span>{t.addressSection}</span>
                </h3>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.address} *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={residentialAddress}
                      onChange={e => setResidentialAddress(e.target.value)}
                      placeholder="No. 12, Jalan Kemboja, Taman Melati..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.city}
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="Petaling Jaya"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.state}
                    </label>
                    <select
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                    >
                      <option value="">-- Select State --</option>
                      {MALAYSIAN_STATES.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.postcode}
                    </label>
                    <input
                      type="text"
                      value={postcode}
                      onChange={e => setPostcode(e.target.value)}
                      placeholder="47301"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Emergency Contact */}
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <HeartHandshake size={18} className="text-indigo-600" />
                  <span>{t.emergencySection}</span>
                </h3>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.emergencyName} *
                    </label>
                    <input
                      type="text"
                      required
                      value={emergencyContactName}
                      onChange={e => setEmergencyContactName(e.target.value)}
                      placeholder="e.g. Siti Aminah (Parent / Spouse)"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.emergencyPhone} *
                    </label>
                    <input
                      type="tel"
                      required
                      value={emergencyContactPhone}
                      onChange={e => setEmergencyContactPhone(e.target.value)}
                      placeholder="e.g. +60198765432"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Primary Role in Club */}
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Building size={18} className="text-indigo-600" />
                  <span>{t.roleSection}</span>
                </h3>
                <div className="mt-4 max-w-md">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    {t.userRole} *
                  </label>
                  <select
                    value={requestedRole}
                    onChange={e => setRequestedRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white font-medium"
                  >
                    <option value="MEMBER">Member / Ahli Biasa</option>
                    <option value="ATHLETE">Athlete / Atlet Karate</option>
                    <option value="COACH">Coach / Jurulatih</option>
                    <option value="PARENT">Parent / Guardian (Ibu Bapa / Penjaga)</option>
                    <option value="VOLUNTEER">Volunteer / Sukarelawan</option>
                    <option value="CLUB_ADMIN">Club Administrator / Pentadbir Kelab</option>
                    <option value="BRANCH_MANAGER">Branch Manager / Pengurus Cawangan</option>
                  </select>
                </div>
              </div>

              {/* Section 5: Profile Photo & Visibility */}
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Camera size={18} className="text-indigo-600" />
                  <span>{t.photoSection}</span>
                </h3>
                <div className="mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    {/* Avatar Preview */}
                    <div className="relative w-28 h-28 rounded-full border-4 border-white shadow-md bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={48} className="text-slate-400" />
                      )}
                    </div>

                    {/* Camera / Upload Controls */}
                    <div className="flex-1 w-full space-y-3">
                      {isCameraActive ? (
                        <div className="space-y-3">
                          <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-black max-w-sm">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover" />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={capturePhoto}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition flex items-center gap-1.5"
                            >
                              <Camera size={14} />
                              <span>{t.snapPhoto}</span>
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-300 transition"
                            >
                              {t.cancelCamera}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-2"
                          >
                            <Upload size={14} />
                            <span>{t.uploadPhoto}</span>
                          </button>
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition flex items-center gap-2"
                          >
                            <Camera size={14} />
                            <span>{t.takePhoto}</span>
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </div>
                      )}
                      <p className="text-xs text-slate-500">
                        {lang === 'en' ? 'JPG, PNG or WebP up to 5MB. Clear headshot recommended for tournament accreditation.' : 'JPG, PNG atau WebP hingga 5MB. Gambar berwajah jelas disyorkan untuk akreditasi kejohanan.'}
                      </p>
                    </div>
                  </div>

                  {/* Photo Visibility */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Lock size={13} className="text-slate-400" />
                      <span>{t.photoVisibilityLabel}</span>
                    </label>
                    <select
                      value={photoVisibility}
                      onChange={e => setPhotoVisibility(e.target.value as any)}
                      className="w-full sm:w-auto px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                    >
                      <option value="CLUB_ONLY">{t.visClubOnly}</option>
                      <option value="PUBLIC">{t.visPublic}</option>
                      <option value="ADMIN_ONLY">{t.visAdminOnly}</option>
                      <option value="PRIVATE">{t.visPrivate}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 6: Additional Info */}
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <CreditCard size={18} className="text-indigo-600" />
                  <span>{t.otherSection}</span>
                </h3>
                <div className="mt-4">
                  <textarea
                    rows={2}
                    value={otherInfo}
                    onChange={e => setOtherInfo(e.target.value)}
                    placeholder={t.otherInfoPlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Footer Notice & Submit */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-400 text-center sm:text-left">
                  {t.draftNotice}
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{t.savingBtn}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>{t.submitBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
