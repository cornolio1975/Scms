'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          club_name: clubName
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create New Club</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign up to create and manage your own sports club. You will become the Club Admin.
          </p>
        </div>
        
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {success ? (
          <div className="rounded-md bg-green-50 p-4 text-center">
            <div className="text-sm text-green-700 font-medium mb-2">Club Registered successfully!</div>
            <p className="text-sm text-green-600">Please check your email to verify your account.</p>
            <Link href="/login" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">
              Return to Login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSignup}>
            <div className="space-y-4 rounded-md shadow-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="clubName">Club Name</label>
                <input
                  id="clubName"
                  type="text"
                  required
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="E.g. Kelab Karate Do Senshi"
                />
              </div>
              <hr className="my-4" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="fullName">Admin Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Your Full Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Admin Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Registering Club...' : 'Register New Club'}
              </button>
            </div>
          </form>
        )}

        {!success && (
          <div className="text-center text-sm">
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Already have an account? Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
