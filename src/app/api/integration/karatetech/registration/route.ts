import { NextResponse } from 'next/server';
import { syncContext, sourceMembers, IntegrationError } from '@/lib/integrations/scms-source';
import { readRegistrationJson, confirmedRegistration } from '@/lib/integrations/registration-response';

export async function POST(request: Request) {
  let draft;
  try { draft = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid registration JSON.' }, { status: 400 });
  }
  try {
    if (!draft || typeof draft !== 'object' || !Array.isArray(draft.participants) || !draft.participants.length || draft.participants.length > 100 || typeof draft.tournamentId !== 'string' || !draft.tournamentId.trim() || typeof draft.idempotencyKey !== 'string' || !draft.idempotencyKey.trim()) {
      throw new IntegrationError('A tournament, idempotency key, and between 1 and 100 athletes are required.');
    }
    const context = await syncContext(draft.clubId || '');
    const members = await sourceMembers(context);
    if (draft.participants.some((p: any) => !p || !members.some(m => m.id === p.scmsMemberId))) {
      throw new IntegrationError('An athlete is outside your authorized club or branch.', 403);
    }
    if (draft.participants.some((p: any) => !p.targetCategoryId || p.eligibilityPassed !== true)) {
      throw new IntegrationError('Every athlete needs a valid tournament category.', 422);
    }
    const rawUrl = process.env.KARATETECH_API_URL?.trim() || process.env.NEXT_PUBLIC_KARATETECH_API_URL?.trim();
    const key = process.env.KARATETECH_API_KEY?.trim();
    if (!rawUrl || !key) return NextResponse.json({ success: false, error: 'KarateTech registration is not configured. No registration has been confirmed.' }, { status: 503 });
    let base: URL;
    try { base = new URL(rawUrl); } catch { throw new IntegrationError('KarateTech registration server URL is invalid.', 503); }
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new IntegrationError('KarateTech registration server URL is invalid.', 503);
    const response = await fetch(`${base.toString().replace(/\/$/, '')}/api/integration/scms/registration`, {
      method: 'POST', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${key}`, 'Idempotency-Key': draft.idempotencyKey },
      body: JSON.stringify(draft),
    });
    if ([301,302,303,307,308,404,405].includes(response.status)) throw new IntegrationError('KarateTech tournament-registration receiver is unavailable. Deploy /api/integration/scms/registration on its Node.js server.', 502);
    const data = await readRegistrationJson(response, 'KarateTech');
    if (!response.ok || !confirmedRegistration(data)) {
      const message = typeof data.error === 'string' ? data.error : typeof data.message === 'string' ? data.message : 'KarateTech did not acknowledge this tournament registration.';
      return NextResponse.json({ success: false, error: message }, { status: [400,401,403,409,422,429].includes(response.status) ? response.status : 502 });
    }
    return NextResponse.json({ success: true, acknowledgementId: data.acknowledgementId });
  } catch (error) {
    const timeout = error instanceof Error && ['TimeoutError','AbortError'].includes(error.name);
    return NextResponse.json({ success: false, error: timeout ? 'KarateTech registration timed out. No registration has been confirmed; retry with the same draft.' : error instanceof Error ? error.message : 'Registration failed. No registration has been confirmed.' }, { status: error instanceof IntegrationError ? error.status : timeout ? 504 : 502 });
  }
}
