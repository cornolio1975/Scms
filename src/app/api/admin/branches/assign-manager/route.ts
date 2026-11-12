import { NextResponse } from 'next/server';
import { assignBranchManagerAction } from '@/app/actions/multi-club';
export async function POST(request: Request) {
  try {
    const { clubId, branchId, email, fullName } = await request.json();
    const result = await assignBranchManagerAction({ clubId, branchId, targetUserId: '', managerEmail: email, managerName: fullName });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch {
    return NextResponse.json({ error: 'Unable to assign manager' }, { status: 400 });
  }
}
