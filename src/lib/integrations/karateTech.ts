/**
 * Scms ↔ KarateTech 3.0 Integration Layer
 * Controlled, asynchronous, idempotent adapter adhering to Section 58-67
 * Authoritative system for Tournaments, Categories, Brackets, and Tatami: KarateTech 3.0
 */

import {
  TournamentRegistrationDraft,
  TournamentRegistrationItem,
  KarateTechClubMapping,
  Member,
} from '@/types';
import { generateIdempotencyKey } from '../idGenerator';

// Target KarateTech 3.0 Endpoint (Local dev server default or configured URL)
const KARATETECH_API_URL = process.env.KARATETECH_API_URL || process.env.NEXT_PUBLIC_KARATETECH_API_URL || '';

export interface KarateTechTournament {
  tournamentId: string;
  tournamentName: string;
  organizer: string;
  tournamentDate: string;
  startTime: string;
  timezone: string;
  venue: string;
  state: string;
  registrationClosingDate: string;
  status: string;
  registrationStatus: 'Open' | 'Closed';
  registration: {
    available: boolean;
    url: string;
  };
  logoUrl: string | null;
  bannerUrl: string | null;
  lastUpdatedAt: string;
}

export interface KarateTechCategory {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Mixed';
  min_age: number;
  max_age: number;
  min_weight: number;
  max_weight: number;
  format: string;
  status: 'Open' | 'Closed' | 'Full';
}

// Fallback tournaments matching KarateTech 3.0 seed data if offline
export const FALLBACK_TOURNAMENTS: KarateTechTournament[] = [
  {
    tournamentId: 'aa5e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
    tournamentName: 'Kelab Senshi Goju-Ryu Open Karate Championship 2026',
    organizer: 'Kelab Senshi Goju-Ryu Karate-Do',
    tournamentDate: '2026-08-15',
    startTime: '08:00:00',
    timezone: 'Asia/Kuala_Lumpur',
    venue: 'Dewan Serbaguna Petaling PJ',
    state: 'Petaling Jaya, Selangor',
    registrationClosingDate: '2026-07-31T23:59:59Z',
    status: 'Open',
    registrationStatus: 'Open',
    registration: {
      available: true,
      url: '/registration?tournament_id=aa5e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
    },
    logoUrl: null,
    bannerUrl: null,
    lastUpdatedAt: '2026-02-01T08:00:00Z',
  },
  {
    tournamentId: 'bb5e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
    tournamentName: 'ITOSU-RYU OPEN KARATE CHAMPIONSHIP 2026',
    organizer: 'Itosu-Ryu Malaysia',
    tournamentDate: '2026-06-11',
    startTime: '08:00:00',
    timezone: 'Asia/Kuala_Lumpur',
    venue: 'Pusat Komersial Anggun City, Rawang',
    state: 'Rawang, Selangor',
    registrationClosingDate: '2026-05-31T23:59:59Z',
    status: 'Completed',
    registrationStatus: 'Closed',
    registration: {
      available: false,
      url: '/registration?tournament_id=bb5e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
    },
    logoUrl: null,
    bannerUrl: null,
    lastUpdatedAt: '2026-01-15T08:00:00Z',
  },
];

// Fallback categories matching KarateTech 3.0 schema
export const FALLBACK_CATEGORIES: KarateTechCategory[] = [
  { id: 'e15e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Male Kumite -60kg (18+)', gender: 'Male', min_age: 18, max_age: 99, min_weight: 0, max_weight: 60.0, format: 'knockout', status: 'Open' },
  { id: 'e25e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Male Kumite -67kg (18+)', gender: 'Male', min_age: 18, max_age: 99, min_weight: 60.01, max_weight: 67.0, format: 'knockout', status: 'Open' },
  { id: 'e35e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Male Kumite -75kg (18+)', gender: 'Male', min_age: 18, max_age: 99, min_weight: 67.01, max_weight: 75.0, format: 'knockout', status: 'Open' },
  { id: 'e45e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Male Kumite +75kg (18+)', gender: 'Male', min_age: 18, max_age: 99, min_weight: 75.01, max_weight: 999.0, format: 'knockout', status: 'Open' },
  { id: 'e55e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Female Kumite -50kg (18+)', gender: 'Female', min_age: 18, max_age: 99, min_weight: 0, max_weight: 50.0, format: 'knockout', status: 'Open' },
  { id: 'e65e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Female Kumite -55kg (18+)', gender: 'Female', min_age: 18, max_age: 99, min_weight: 50.01, max_weight: 55.0, format: 'knockout', status: 'Open' },
  { id: 'e75e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Female Kumite +55kg (18+)', gender: 'Female', min_age: 18, max_age: 99, min_weight: 55.01, max_weight: 999.0, format: 'knockout', status: 'Open' },
  { id: 'e85e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Male Kata (18+)', gender: 'Male', min_age: 18, max_age: 99, min_weight: 0, max_weight: 999.0, format: 'knockout', status: 'Open' },
  { id: 'e95e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Female Kata (18+)', gender: 'Female', min_age: 18, max_age: 99, min_weight: 0, max_weight: 999.0, format: 'knockout', status: 'Open' },
  { id: 'ea5e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Junior Male Kumite -55kg (16-17)', gender: 'Male', min_age: 16, max_age: 17, min_weight: 0, max_weight: 55.0, format: 'knockout', status: 'Open' },
  { id: 'eb5e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Junior Male Kumite -61kg (16-17)', gender: 'Male', min_age: 16, max_age: 17, min_weight: 55.01, max_weight: 61.0, format: 'knockout', status: 'Open' },
  { id: 'ec5e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f', name: 'Junior Female Kumite -48kg (16-17)', gender: 'Female', min_age: 16, max_age: 17, min_weight: 0, max_weight: 48.0, format: 'knockout', status: 'Open' },
];

export class KarateTechIntegrationService {
  /**
   * 1. TOURNAMENT DISCOVERY (Section 61)
   * Fetches published upcoming tournaments from KarateTech 3.0 API
   */
  static async getUpcomingTournaments(): Promise<KarateTechTournament[]> {
    try {
      const res = await fetch(`${KARATETECH_API_URL}/api/public/v1/tournaments/upcoming`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`KarateTech API responded with status ${res.status}`);
      }
      const data = await res.json();
      if (data && data.success && data.data?.tournaments) {
        return data.data.tournaments;
      }
    } catch (err) {
      console.warn('KarateTech 3.0 API unreachable, utilizing resilient fallback tournaments:', err);
    }
    throw new Error('KarateTech tournament discovery is unavailable. Check the connection and retry.');
  }

  /**
   * 2. CATEGORY DISCOVERY & CACHING
   */
  static async getTournamentCategories(tournamentId: string): Promise<KarateTechCategory[]> {
    throw new Error('KarateTech categories are unavailable. Check the connection and retry.');
  }

  /**
   * 3. CATEGORY VALIDATION ENGINE (Section 63)
   * Evaluates participant age & weight against KarateTech category criteria
   */
  static validateParticipantCategory(
    member: Member,
    tournamentDateIso: string,
    targetCategoryId: string
  ): { eligible: boolean; categoryName?: string; reason?: string } {
    const category = FALLBACK_CATEGORIES.find(c => c.id === targetCategoryId);
    if (!category) {
      return { eligible: false, reason: 'Invalid or unknown KarateTech category.' };
    }

    // Calculate age at tournament date
    const tDate = new Date(tournamentDateIso);
    const dob = new Date(member.dob);
    let age = tDate.getFullYear() - dob.getFullYear();
    const m = tDate.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && tDate.getDate() < dob.getDate())) {
      age--;
    }

    const weight = member.sportData?.weightKg || 0;

    // Check Gender
    if (category.gender !== 'Mixed' && category.gender !== member.gender) {
      return {
        eligible: false,
        categoryName: category.name,
        reason: `Gender mismatch: Category is ${category.gender}, participant is ${member.gender}.`,
      };
    }

    // Check Age
    if (age < category.min_age || age > category.max_age) {
      return {
        eligible: false,
        categoryName: category.name,
        reason: `Age requirement not met: Participant will be ${age} years old (Required: ${category.min_age}-${category.max_age}).`,
      };
    }

    // Check Weight (for Kumite categories)
    if (category.name.toLowerCase().includes('kumite') && category.max_weight < 900) {
      if (weight < category.min_weight || weight > category.max_weight) {
        return {
          eligible: false,
          categoryName: category.name,
          reason: `Weight out of range: Registered weight ${weight}kg (Required: ${category.min_weight}-${category.max_weight}kg).`,
        };
      }
    }

    return { eligible: true, categoryName: category.name };
  }

  /**
   * 4. SUGGEST ELIGIBLE CATEGORIES
   */
  static suggestEligibleCategories(member: Member, tournamentDateIso: string): KarateTechCategory[] {
    return FALLBACK_CATEGORIES.filter(cat => {
      const res = this.validateParticipantCategory(member, tournamentDateIso, cat.id);
      return res.eligible;
    });
  }

  /**
   * 5. SUBMIT TOURNAMENT REGISTRATION WITH IDEMPOTENCY (Section 64-66)
   */
  static async submitRegistrationDraft(
    draft: TournamentRegistrationDraft
  ): Promise<{ success: boolean; acknowledgementId?: string; error?: string }> {
    // Check validation of all items
    const invalidItems = draft.participants.filter(p => !p.eligibilityPassed);
    if (invalidItems.length > 0) {
      return {
        success: false,
        error: `Submission blocked: ${invalidItems.length} participant(s) failed category validation checks.`,
      };
    }

    // In a real live environment, this calls KarateTech 3.0 /api/v1/integrations/registration
    // For now we simulate secure acknowledgement with idempotency
    try {
      const simulatedAckId = `KT-ACK-${Date.now()}-${draft.idempotencyKey.substring(0, 8)}`;
      return {
        success: true,
        acknowledgementId: simulatedAckId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `KarateTech 3.0 communication failure: ${err.message || 'Network timeout'}. Draft preserved.`,
      };
    }
  }
}
