'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      password,
      data: { temp_password: null }, // Remove the flag
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Password updated, redirect to dashboard
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Update Your Password
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          You are using a temporary password. Please set a new password to continue.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleUpdatePassword}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-semibold border border-red-200">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700">New Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-[#0284C7] focus:border-[#0284C7] sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Confirm New Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-[#0284C7] focus:border-[#0284C7] sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0284C7] disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
