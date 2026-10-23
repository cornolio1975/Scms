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
  | 'TREG';

export function generateImmutableId(prefix:IdPrefix,_parentClubId?:string,_branchNumber?:number):string {
  return `Scms-${prefix}-${crypto.randomUUID()}`;
}
export function generateIdempotencyKey():string{return crypto.randomUUID()}
