'use client';

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import OnboardingModal from '@/components/Onboarding/OnboardingModal';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <OnboardingModal />
    </AuthProvider>
  );
}
