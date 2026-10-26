import { NextResponse } from 'next/server';
import { KarateTechSyncService } from '@/lib/integrations/karatetech-sync';
import { syncContext, sourceMembers, sourcePayload, IntegrationError } from '@/lib/integrations/scms-source';

function failure(error: unknown) {
  return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Transfer failed.' }, { status: error instanceof IntegrationError ? error.status : 503 });
}

export async function GET(request: Request) {
  try {
    const context = await syncContext(new URL(request.url).searchParams.get('clubId') || '');
    const members = await sourceMembers(context);
    return NextResponse.json({ success: true, members: members.map(m => ({ id: m.id, full_name: m.full_name, gender: m.gender || '', dob: m.dob || m.date_of_birth || '', passport_ic: m.passport_ic || '', weight: m.weight || '', height: m.height || '' })) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    let body;
    try { body = await request.json(); } catch { throw new IntegrationError('Invalid JSON.'); }
    const context = await syncContext(body.clubId || '');
    const profile = (await sourceMembers(context)).find(m => m.id === body.memberId);
    if (!profile) throw new IntegrationError('Athlete not found in your authorized club or branch.', 404);
    const payload = sourcePayload(profile, context, body.details || body);
    const result = await KarateTechSyncService.executeSync(payload, context.user.id, context.db);
    return NextResponse.json(result, { status: result.success ? 200 : result.status === 'CONFLICT' ? 409 : 503 });
  } catch (error) { return failure(error); }
}
