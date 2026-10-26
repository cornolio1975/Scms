import { NextResponse } from 'next/server';
import { KarateTechSyncService } from '@/lib/integrations/karatetech-sync';
import { syncContext, sourceMembers, sourcePayload, IntegrationError } from '@/lib/integrations/scms-source';
export async function POST(request: Request) {
  try {
    let body;
    try { body = await request.json(); } catch { throw new IntegrationError('Invalid JSON.'); }
    if (!Array.isArray(body.memberIds) || !body.memberIds.length || body.memberIds.length > 100 || body.memberIds.some((id: unknown) => typeof id !== 'string')) throw new IntegrationError('Select between 1 and 100 athletes.');
    const context = await syncContext(body.clubId || '');
    const profiles = await sourceMembers(context);
    const participants = [...new Set<string>(body.memberIds)].map(id => {
      const profile = profiles.find(p => p.id === id);
      if (!profile) throw new IntegrationError('An athlete is outside your authorized club or branch.', 403);
      return sourcePayload(profile, context);
    });
    const result = await KarateTechSyncService.executeBulkSync(context.club.id, participants, context.user.id, context.db);
    return NextResponse.json(result, { status: result.success ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Transfer failed.' }, { status: error instanceof IntegrationError ? error.status : 503 });
  }
}
