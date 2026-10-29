'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';
import {
  User as UserIcon,
  Mail,
  Phone,
  Home,
  Shield,
  KeyRound,
  Camera,
  Upload,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Globe,
  Building,
  Save,
  Check,
  CreditCard,
  HeartHandshake,
} from 'lucide-react';

export default function ProfilePage() {
  const { currentUser, updateProfile, refreshSession } = useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'photo' | 'security'>('info');
  const [lang, setLang] = useState<'en' | 'ms'>('en');

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [icPassport, setIcPassport] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [preferredNadiCentre, setPreferredNadiCentre] = useState('');
  const [photoVisibility, setPhotoVisibility] = useState<'PUBLIC' | 'CLUB_ONLY' | 'ADMIN_ONLY' | 'PRIVATE'>('CLUB_ONLY');
  const [otherInfo, setOtherInfo] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status / Feedback
  const [loading, setLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Camera State
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

  const NADI_CENTRES = [
    'NADI Pusat Komuniti Desa (PKD) Bandar',
    'NADI Cyberjaya Community Centre',
    'NADI Daerah Petaling',
    'NADI Taman Medan',
    'NADI Georgetown Youth Hub',
    'NADI Johor Bahru Digital Centre',
    'NADI Kuantan Sports & Digital Hub',
    'NADI Kota Kinabalu Community',
    'NADI Kuching Digital Centre',
    'Other / Lain-lain',
  ];

  useEffect(() => {
    const savedLang = localStorage.getItem('scms_language') as 'en' | 'ms';
    if (savedLang) setLang(savedLang);

    if (currentUser) {
      setFullName(currentUser.fullName || '');
      setPhone(currentUser.phone || '');
      setIcPassport(currentUser.icPassport || '');
      setResidentialAddress(currentUser.residentialAddress || '');
      setEmergencyContactName(currentUser.emergencyContactName || '');
      setEmergencyContactPhone(currentUser.emergencyContactPhone || '');
      setPreferredNadiCentre(currentUser.preferredNadiCentre || NADI_CENTRES[0]);
      setPhotoVisibility(currentUser.photoVisibility || 'CLUB_ONLY');
      setOtherInfo(currentUser.otherInfo || '');
      setAvatarUrl(currentUser.avatarUrl || '');
    }
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const toggleLanguage = () => {
    const next = lang === 'en' ? 'ms' : 'en';
    setLang(next);
    localStorage.setItem('scms_language', next);
  };

  // Camera Handlers
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
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
      setFeedback({
        type: 'error',
        message: lang === 'en' ? 'Camera access unavailable. Please upload a file instead.' : 'Kamera tidak dapat diakses. Sila muat naik fail.',
      });
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
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({
        type: 'error',
        message: lang === 'en' ? 'File size exceeds 5MB limit.' : 'Saiz fail melebihi had 5MB.',
      });
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setFeedback(null);

    try {
      let finalAvatarUrl = avatarUrl;

      // If photo was changed to a data URL, upload to storage
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
        } catch (uploadErr) {
          console.warn('Storage upload error:', uploadErr);
        }
      }

      const success = await updateProfile({
        fullName,
        phone,
        icPassport,
        residentialAddress,
        emergencyContactName,
        emergencyContactPhone,
        preferredNadiCentre,
        photoVisibility,
        otherInfo,
        avatarUrl: finalAvatarUrl,
        onboardingCompleted: true,
      });

      if (!success) {
        throw new Error(lang === 'en' ? 'Failed to update profile. Please try again.' : 'Gagal mengemas kini profil. Sila cuba lagi.');
      }

      await refreshSession();
      setFeedback({
        type: 'success',
        message: lang === 'en' ? 'Profile details saved successfully.' : 'Maklumat profil berjaya disimpan.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error updating profile',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdLoading) return;
    setFeedback(null);

    if (newPassword.length < 8) {
      setFeedback({
        type: 'error',
        message: lang === 'en' ? 'Password must be at least 8 characters long.' : 'Kata laluan mestilah sekurang-kurangnya 8 aksara.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        type: 'error',
        message: lang === 'en' ? 'Passwords do not match.' : 'Kata laluan tidak sepadan.',
      });
      return;
    }

    setPwdLoading(true);
    try {
      const supabase = createClient();
      const { error: pwdErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (pwdErr) throw pwdErr;

      setNewPassword('');
      setConfirmPassword('');
      setFeedback({
        type: 'success',
        message: lang === 'en' ? 'Password updated successfully.' : 'Kata laluan berjaya dikemas kini.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Password update failed',
      });
    } finally {
      setPwdLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Loading profile details...
      </div>
    );
  }

  const t = {
    title: lang === 'en' ? 'Account & Profile Settings' : 'Tetapan Akaun & Profil',
    subtitle: lang === 'en' ? 'Manage your personal details, profile photograph, and account credentials.' : 'Urus maklumat peribadi, gambar profil, dan keselamatan akaun anda.',
    tabInfo: lang === 'en' ? 'Personal Information' : 'Maklumat Peribadi',
    tabPhoto: lang === 'en' ? 'Profile Photo' : 'Gambar Profil',
    tabSecurity: lang === 'en' ? 'Security & Password' : 'Keselamatan & Kata Laluan',
    emailNote: lang === 'en' ? 'Email address is your verified system identifier and cannot be modified.' : 'Alamat emel ialah pengenalpasti akaun anda dan tidak boleh diubah.',
    fullName: lang === 'en' ? 'Full Name' : 'Nama Penuh',
    icPassport: lang === 'en' ? 'IC / Passport Number' : 'Nombor MyKad / Pasport',
    phone: lang === 'en' ? 'Contact Phone Number' : 'Nombor Telefon',
    address: lang === 'en' ? 'Residential Address' : 'Alamat Kediaman',
    city: lang === 'en' ? 'City' : 'Bandar',
    state: lang === 'en' ? 'State' : 'Negeri',
    postcode: lang === 'en' ? 'Postcode' : 'Poskod',
    emergencyName: lang === 'en' ? 'Emergency Contact Name' : 'Nama Waris Kecemasan',
    emergencyPhone: lang === 'en' ? 'Emergency Contact Phone' : 'Telefon Waris Kecemasan',
    nadiCentre: lang === 'en' ? 'Preferred NADI Centre' : 'Pusat NADI Pilihan',
    otherInfo: lang === 'en' ? 'Additional Notes / Medical Alerts' : 'Nota Tambahan / Alergi Perubatan',
    saveBtn: lang === 'en' ? 'Save Profile Changes' : 'Simpan Perubahan Profil',
    savingBtn: lang === 'en' ? 'Saving...' : 'Sedang Menyimpan...',
    photoTitle: lang === 'en' ? 'Profile Photograph & Consent' : 'Gambar Profil & Keizinan',
    uploadBtn: lang === 'en' ? 'Upload Image' : 'Muat Naik Gambar',
    cameraBtn: lang === 'en' ? 'Take Photo with Camera' : 'Ambil Gambar dengan Kamera',
    snapBtn: lang === 'en' ? 'Snap Picture' : 'Ambil Gambar',
    cancelBtn: lang === 'en' ? 'Cancel' : 'Batal',
    visibilityLabel: lang === 'en' ? 'Photo Visibility Preference' : 'Pilihan Keterlihatan Gambar',
    visClub: lang === 'en' ? 'Club Members & Coaches Only' : 'Ahli Kelab & Jurulatih Sahaja',
    visPublic: lang === 'en' ? 'Public (Tournament Spectator Displays)' : 'Awam (Paparan Kejohanan & Penonton)',
    visAdmin: lang === 'en' ? 'Administrators Only' : 'Pentadbir Sahaja',
    visPrivate: lang === 'en' ? 'Private' : 'Peribadi',
    secTitle: lang === 'en' ? 'Change Password' : 'Tukar Kata Laluan',
    secDesc: lang === 'en' ? 'Ensure your new password uses at least 8 characters with upper, lower, numbers, and symbols.' : 'Pastikan kata laluan baharu mempunyai sekurang-kurangnya 8 aksara dengan huruf besar, huruf kecil, nombor dan simbol.',
    newPass: lang === 'en' ? 'New Password' : 'Kata Laluan Baharu',
    confirmPass: lang === 'en' ? 'Confirm New Password' : 'Sahkan Kata Laluan Baharu',
    updatePassBtn: lang === 'en' ? 'Update Password' : 'Kemas Kini Kata Laluan',
    roleAffiliation: lang === 'en' ? 'System Roles & Affiliation' : 'Peranan Sistem & Gabungan',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleLanguage}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-300"
        >
          <Globe size={14} />
          <span>{lang === 'en' ? 'Bahasa Malaysia' : 'English'}</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle size={18} className="shrink-0 text-rose-600 mt-0.5" />
          )}
          <div className="text-sm font-semibold">{feedback.message}</div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-sm transition ${
            activeTab === 'info'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserIcon size={16} />
          <span>{t.tabInfo}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('photo')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-sm transition ${
            activeTab === 'photo'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Camera size={16} />
          <span>{t.tabPhoto}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-sm transition ${
            activeTab === 'security'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound size={16} />
          <span>{t.tabSecurity}</span>
        </button>
      </div>

      {/* Tab 1: Personal Information */}
      {activeTab === 'info' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Identity & Account Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Mail size={18} className="text-indigo-600" />
              <span>{t.roleAffiliation}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Email Address (Read-Only)
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-100 border border-slate-300 text-sm font-medium text-slate-700">
                  <Lock size={14} className="text-slate-400" />
                  <span>{currentUser.email}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{t.emailNote}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Active Role & Permissions
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                    {currentUser.activeRole}
                  </span>
                  {currentUser.activeClubId && (
                    <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium">
                      Club: {currentUser.activeClubId}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personal Details Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <UserIcon size={18} className="text-indigo-600" />
              <span>{t.tabInfo}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t.fullName} *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
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
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
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
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t.nadiCentre}
                </label>
                <select
                  value={preferredNadiCentre}
                  onChange={e => setPreferredNadiCentre(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
                >
                  {NADI_CENTRES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t.address}
                </label>
                <textarea
                  rows={2}
                  value={residentialAddress}
                  onChange={e => setResidentialAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t.emergencyName}
                </label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={e => setEmergencyContactName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t.emergencyPhone}
                </label>
                <input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={e => setEmergencyContactPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t.otherInfo}
                </label>
                <textarea
                  rows={2}
                  value={otherInfo}
                  onChange={e => setOtherInfo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{loading ? t.savingBtn : t.saveBtn}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Profile Photo */}
      {activeTab === 'photo' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Camera size={18} className="text-indigo-600" />
            <span>{t.photoTitle}</span>
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-8 p-6 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="relative w-36 h-36 rounded-full border-4 border-white shadow-lg bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={56} className="text-slate-400" />
              )}
            </div>

            <div className="flex-1 space-y-4 text-center sm:text-left">
              {isCameraActive ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-black max-w-sm mx-auto sm:mx-0">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-52 object-cover" />
                  </div>
                  <div className="flex justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5"
                    >
                      <Camera size={14} />
                      <span>{t.snapBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 transition"
                    >
                      {t.cancelBtn}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2"
                  >
                    <Upload size={15} />
                    <span>{t.uploadBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition flex items-center gap-2"
                  >
                    <Camera size={15} />
                    <span>{t.cameraBtn}</span>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t.visibilityLabel}
                </label>
                <select
                  value={photoVisibility}
                  onChange={e => setPhotoVisibility(e.target.value as any)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                >
                  <option value="CLUB_ONLY">{t.visClub}</option>
                  <option value="PUBLIC">{t.visPublic}</option>
                  <option value="ADMIN_ONLY">{t.visAdmin}</option>
                  <option value="PRIVATE">{t.visPrivate}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{loading ? t.savingBtn : t.saveBtn}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Password */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <KeyRound size={18} className="text-indigo-600" />
              <span>{t.secTitle}</span>
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
              {t.secDesc}
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t.newPass} *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t.confirmPass} *
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={pwdLoading}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                {pwdLoading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                <span>{pwdLoading ? 'Updating…' : t.updatePassBtn}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
