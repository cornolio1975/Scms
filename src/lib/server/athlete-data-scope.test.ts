import { describe, it, expect } from 'vitest';
import { resolveAuthorizedScope } from './athlete-data-scope';
const clubId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
function client(roles = [{ role: 'BRANCH_MANAGER', club_id: clubId, branch_id: branchId }]) {
  return { from(table: string) {
    const result = { data: table === 'user_roles' ? roles : table === 'clubs' ? [{ id: clubId, name: 'Club' }] : [{ id: branchId, club_id: clubId, name: 'Assigned' }, { id: otherId, club_id: clubId, name: 'Other' }], error: null };
    const query: any = { select: () => query, eq: () => query, then: (resolve: any) => Promise.resolve(result).then(resolve) };
    return query;
  } } as any;
}
describe('branch manager server authorization', () => {
  it('returns only assigned branch', async () => {
    const scope = await resolveAuthorizedScope({ adminClient: client(), userId: 'manager', clubId, branchId });
    expect(scope.authorizedBranches.map(b => b.id)).toEqual([branchId]);
  });
  it('rejects another branch in same club', async () => {
    await expect(resolveAuthorizedScope({ adminClient: client(), userId: 'manager', clubId, branchId: otherId })).rejects.toMatchObject({ status: 403, code: 'UNAUTHORIZED_BRANCH_ACCESS' });
  });
  it.each([undefined, '', 'ALL'])('rejects club wide scope: %s', async (requestedBranch) => {
    await expect(resolveAuthorizedScope({ adminClient: client(), userId: 'manager', clubId, branchId: requestedBranch })).rejects.toMatchObject({ status: 403, code: 'BRANCH_SCOPE_REQUIRED' });
  });
  it('rejects unassigned manager', async () => {
    await expect(resolveAuthorizedScope({ adminClient: client([]), userId: 'manager', clubId, branchId })).rejects.toMatchObject({ status: 403 });
  });
  it('rejects anonymous access', async () => {
    await expect(resolveAuthorizedScope({ adminClient: client(), userId: '', clubId, branchId })).rejects.toMatchObject({ status: 401 });
  });
});
