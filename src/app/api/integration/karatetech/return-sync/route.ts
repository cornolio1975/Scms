import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { gatewayDb } from '@/lib/payments/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const equal = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
const reply = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
function digest(actor: string, remote: unknown) { return createHash('sha256').update(JSON.stringify({actor, remote})).digest('hex'); }
export async function POST(req: Request) {
  try {
    const secret = process.env.KARATETECH_RETURN_SYNC_KEY;
    if (!secret || secret.length < 32) return reply({error: 'Return sync is not configured'}, 503);
    if (!equal(req.headers.get('authorization') || '', `Bearer ${secret}`)) return reply({error: 'Unauthorized'}, 401);
    if (!req.headers.get('content-type')?.includes('application/json')) return reply({error: 'JSON required'}, 415);
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 64000) return reply({error: 'Request too large'}, 413);
    let body; try { body = JSON.parse(raw); } catch { return reply({error: 'Invalid JSON'}, 400); }
    const {actor, remote, action, confirmation} = body || {};
    if (!/^[a-f0-9-]{36}$/i.test(actor || '') || !remote || !['preview', 'confirm'].includes(action)) return reply({error: 'Invalid request'}, 400);
    let expected: string | null = null;
    if (action === 'confirm') {
      if (typeof confirmation !== 'string' || confirmation.length > 2000) return reply({error: 'Review and confirm the changes first'}, 409);
      const [encoded, signature, extra] = confirmation.split('.');
      if (extra || !signature || !equal(signature, createHmac('sha256', secret).update(encoded).digest('hex'))) return reply({error: 'Invalid confirmation'}, 409);
      let claims; try { claims = JSON.parse(Buffer.from(encoded, 'base64url').toString()); } catch { return reply({error: 'Invalid confirmation'}, 409); }
      if (!Number.isFinite(claims.expires) || claims.expires < Date.now() || claims.digest !== digest(actor, remote) || typeof claims.revision !== 'string') return reply({error: 'Data changed or confirmation expired. Review again.'}, 409);
      expected = claims.revision;
    }
    const {data, error} = await gatewayDb().rpc('scms_receive_karatetech', {p_remote: remote, p_actor: actor, p_apply: action === 'confirm', p_expected: expected});
    if (error) return reply({error: ['40001','23505','P0002'].includes(error.code) ? 'Athlete data or mapping changed. Review and reconcile before updating.' : 'Return sync database is not ready'}, ['40001','23505','P0002'].includes(error.code) ? 409 : 503);
    if (!data?.success) return reply({...data, error: 'Both systems changed the same fields. Reconcile these changes first.'}, 409);
    if (action === 'preview') {
      const encoded = Buffer.from(JSON.stringify({digest: digest(actor, remote), revision: data.member_revision, expires: Date.now() + 300000})).toString('base64url');
      return reply({...data, confirmation: encoded + '.' + createHmac('sha256', secret).update(encoded).digest('hex')});
    }
    return reply(data);
  } catch { return reply({error: 'Unable to update SCMS. No success has been confirmed.'}, 503); }
}
