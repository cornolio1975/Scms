import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { EXCEL_LIMITS } from '@/lib/excel/xlsx-engine';
import {
  ScopeAuthorizationError,
  getServiceAdminClient,
  processAthleteWorkbookImport,
  resolveAuthorizedScope,
} from '@/lib/server/athlete-data-scope';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabaseServer = await createClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in.' },
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

    let query = adminClient
      .from('csv_history')
      .select(
        'id, operation, module_name, filename, total_records, successful_records, created_records, updated_records, unchanged_records, error_records, status, club_id, branch_id, created_at'
      )
      .eq('club_id', scope.targetClub.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (scope.targetBranch) {
      query = query.eq('branch_id', scope.targetBranch.id);
    }

    const { data: history, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ history: history || [] });
  } catch (err: unknown) {
    if (err instanceof ScopeAuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    const message =
      err instanceof Error ? err.message : 'Failed to load import history.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in to import athletes.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const clubId = formData.get('clubId') as string | null;
    const branchId = formData.get('branchId') as string | null;
    const rawMode = (formData.get('mode') as string | null) || 'preview';
    const mode: 'preview' | 'commit' =
      rawMode.toLowerCase() === 'commit' ? 'commit' : 'preview';
    const allowPartial =
      String(formData.get('allowPartial') || 'false').toLowerCase() === 'true';
    const idempotencyKey =
      (formData.get('idempotencyKey') as string | null) || null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Please select a valid Excel (.xlsx) workbook to upload.' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        {
          error:
            'Unsupported file format. Only Excel (.xlsx) workbooks are supported.',
          code: 'INVALID_FILE_EXTENSION',
        },
        { status: 400 }
      );
    }

    if (file.size > EXCEL_LIMITS.MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File size exceeds the ${
            EXCEL_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)
          } MB limit.`,
          code: 'FILE_TOO_LARGE',
        },
        { status: 400 }
      );
    }

    const adminClient = getServiceAdminClient();
    const scope = await resolveAuthorizedScope({
      adminClient,
      userId: user.id,
      clubId,
      branchId,
    });

    const arrayBuf = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuf);

    const { validation, commitResult } = await processAthleteWorkbookImport({
      adminClient,
      scope,
      fileBuffer,
      fileName: file.name,
      mode,
      allowPartial,
      idempotencyKey,
    });

    if (mode === 'preview') {
      return NextResponse.json({
        mode: 'preview',
        validation,
      });
    }

    const status = commitResult?.success ? 200 : 422;
    return NextResponse.json(
      {
        mode: 'commit',
        validation,
        commitResult,
      },
      { status }
    );
  } catch (err: unknown) {
    if (err instanceof ScopeAuthorizationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    const message =
      err instanceof Error ? err.message : 'Failed to process athlete import.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

