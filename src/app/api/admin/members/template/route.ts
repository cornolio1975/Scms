import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateAthleteWorkbook } from '@/lib/excel/athlete-workbook';
import {
  ScopeAuthorizationError,
  getServiceAdminClient,
  resolveAuthorizedScope,
} from '@/lib/server/athlete-data-scope';

export const dynamic = 'force-dynamic';

function slugifyFileNamePart(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'SCMS'
  );
}

export async function GET(request: Request) {
  try {
    const supabaseServer = await createClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in to download the template.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');
    const branchId = searchParams.get('branchId');

    const adminClient = getServiceAdminClient();
    const scope = await resolveAuthorizedScope({
      adminClient,
      userId: user.id,
      clubId,
      branchId,
    });

    const buffer = generateAthleteWorkbook({
      mode: 'template',
      club: scope.targetClub,
      selectedBranch: scope.targetBranch,
      authorizedBranches: scope.authorizedBranches,
    });

    const clubSlug = slugifyFileNamePart(
      scope.targetClub.shortName || scope.targetClub.name
    );
    const branchSlug = scope.targetBranch
      ? `_${slugifyFileNamePart(scope.targetBranch.name)}`
      : '';
    const fileName = `SCMS_Athlete_Bulk_Template_${clubSlug}${branchSlug}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    if (err instanceof ScopeAuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    const message =
      err instanceof Error ? err.message : 'Failed to generate Excel template.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

