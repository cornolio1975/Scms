/**
 * Scms Immutable ID Generator
 * Generates structured, permanent, non-colliding human-readable identifiers
 * Compliant with Rule 6: Never use names as permanent identifiers.
 */

export type IdPrefix =
  | 'CLUB'
  | 'BRANCH'
  | 'MEM'
  | 'VOL'
  | 'TSK'
  | 'INV'
  | 'REC'
  | 'EVT'
  | 'DOC'
  | 'APP'
  | 'TREG'
  | 'PCON'
  | 'AGR';

let inMemoryCounters: Record<string, number> = {
  CLUB: 100,
  MEM: 1000,
  VOL: 500,
  TSK: 300,
  INV: 2000,
  REC: 2000,
  EVT: 100,
  DOC: 500,
  APP: 100,
  TREG: 50,
  PCON: 100,
  AGR: 100
};

if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('scms_id_counters');
  if (saved) {
    try {
      inMemoryCounters = { ...inMemoryCounters, ...JSON.parse(saved) };
    } catch (e) {}
  }
}

export function generateImmutableId(prefix: IdPrefix, parentClubId?: string, branchNumber?: number): string {
  if (prefix === 'BRANCH' && parentClubId && branchNumber !== undefined) {
    const branchPad = String(branchNumber).padStart(3, '0');
    return `${parentClubId}-B${branchPad}`;
  }

  const current = (inMemoryCounters[prefix] || 1) + 1;
  inMemoryCounters[prefix] = current;
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('scms_id_counters', JSON.stringify(inMemoryCounters));
  }
  
  const pad = String(current).padStart(6, '0');
  return `Scms-${prefix}-${pad}`;
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
}
