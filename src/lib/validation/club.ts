/**
 * Club & Branch Profile Validation Rules
 * Shared between client forms and server actions.
 */

export interface DisplayNameValidationResult {
  valid: boolean;
  value: string;
  error?: string;
}

/**
 * Validates club display name according to strict business rules:
 * - 1 to 30 characters, including spaces and legitimate punctuation.
 * - Non-empty and not only whitespace.
 * - No HTML / script injection.
 */
export function validateDisplayName(raw: string): DisplayNameValidationResult {
  if (typeof raw !== 'string') {
    return { valid: false, value: '', error: 'Display Name must be a string.' };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { valid: false, value: '', error: 'Display Name cannot be empty or whitespace only.' };
  }

  if (trimmed.length > 30) {
    return {
      valid: false,
      value: trimmed,
      error: `Display Name exceeds the maximum limit of 30 characters (${trimmed.length}/30).`
    };
  }

  // Prevent HTML or script injection
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return { valid: false, value: trimmed, error: 'Display Name contains disallowed HTML or markup tags.' };
  }

  return { valid: true, value: trimmed };
}
