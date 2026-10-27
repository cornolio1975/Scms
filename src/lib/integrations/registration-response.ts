/** Guard the registration contract before a draft can be acknowledged. */
export async function readRegistrationJson(response: Response, service: 'SCMS' | 'KarateTech'): Promise<Record<string, any>> {
  if (response.redirected || !/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
    throw new Error(service === 'SCMS'
      ? 'SCMS registration API returned a web page instead of JSON. Its Node.js deployment or API routing must be checked. No registration has been confirmed.'
      : 'KarateTech tournament-registration receiver is unavailable or returned a web page instead of JSON. The /api/integration/scms/registration route must be deployed. No registration has been confirmed.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error(`${service} registration API returned invalid JSON. No registration has been confirmed.`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${service} registration API returned an invalid response. No registration has been confirmed.`);
  return data;
}

export function confirmedRegistration(data: Record<string, any>): boolean {
  return data.success === true && typeof data.acknowledgementId === 'string' && data.acknowledgementId.trim().length > 0;
}
