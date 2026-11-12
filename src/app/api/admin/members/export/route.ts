import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  generateAthleteWorkbook,
  mapDbMemberToWorkbookRow,
} from '@/lib/excel/athlete-workbook';
import {
  ScopeAuthorizationError,
  fetchAllScopedMembers,
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
        { error: 'Unauthorized: Please sign in to export athletes.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');
    const branchId = searchParams.get('branchId');
    const statusFilter = searchParams.get('status') || 'ALL';
    const searchQuery = searchParams.get('search') || '';

    const adminClient = getServiceAdminClient();
    const scope = await resolveAuthorizedScope({
      adminClient,
      userId: user.id,
      clubId,
      branchId,
    });

    const members = await fetchAllScopedMembers({
      adminClient,
      clubId: scope.targetClub.id,
      branchId: scope.targetBranch ? scope.targetBranch.id : null,
      statusFilter,
      searchQuery,
    });

    const clubMap = new Map([[scope.targetClub.id, scope.targetClub]]);
    const athleteRows = members.map((m) =>
      mapDbMemberToWorkbookRow(m, clubMap, scope.clubBranches)
    );

    const buffer = generateAthleteWorkbook({
      mode: 'export',
      club: scope.targetClub,
      selectedBranch: scope.targetBranch,
      authorizedBranches: scope.authorizedBranches,
      athletes: athleteRows,
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const clubSlug = slugifyFileNamePart(
      scope.targetClub.shortName || scope.targetClub.name
    );
    const branchSlug = scope.targetBranch
      ? `_${slugifyFileNamePart(scope.targetBranch.name)}`
      : '_All_Branches';
    const fileName = `SCMS_Athletes_Export_${clubSlug}${branchSlug}_${dateStr}.xlsx`;

    // Record export audit log in csv_history
    await adminClient.from('csv_history').insert({
      operation: 'EXPORT',
      module_name: 'ATHLETES_XLSX',
      user_id: scope.userId,
      club_id: scope.targetClub.id,
      branch_id: scope.targetBranch ? scope.targetBranch.id : null,
      filename: fileName,
      total_records: athleteRows.length,
      successful_records: athleteRows.length,
      error_records: 0,
      status: 'COMPLETED',
      summary: {
        statusFilter,
        searchQuery: searchQuery ? '[FILTERED]' : null,
        exportedCount: athleteRows.length,
      },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Export-Count': String(athleteRows.length),
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
      err instanceof Error ? err.message : 'Failed to export athlete records.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

