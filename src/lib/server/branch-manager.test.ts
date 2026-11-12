import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), admin: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/utils/supabase/server', () => ({ createClient: mocks.session }));
vi.mock('./athlete-data-scope', () => ({ getServiceAdminClient: mocks.admin }));
import { assignManager } from './branch-manager';

function query(result: any) {
  const chain: any = {};
  for (const key of ['select', 'eq', 'single', 'maybeSingle', 'insert', 'update', 'delete']) chain[key] = vi.fn(() => chain);
  chain.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return chain;
}
const params = { clubId: 'club', branchId: 'branch', managerEmail: ' Manager@example.com ', managerName: 'Manager' };
function setup({ caller = 'admin', roles = [{ role: 'CLUB_ADMIN', club_id: 'club' }], profile = null as any, branch = { id: 'branch', manager_id: 'old-manager' } as any } = {}) {
  mocks.session.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: caller ? { id: caller } : null } }) }, from: () => query({ data: roles, error: null }) });
  const calls: any[] = [];
  const admin = { from: vi.fn((table: string) => {
    const occurrence = calls.filter(c => c.table === table).length;
    const data = table === 'profiles' ? profile : table === 'club_branches' && occurrence === 0 ? branch : null;
    const q = query({ data, error: null }); calls.push({ table, q }); return q;
  }), auth: { admin: { createUser: vi.fn(async () => ({ data: { user: { id: 'new-manager' } }, error: null })), deleteUser: vi.fn(async () => ({ error: null })) } } };
  mocks.admin.mockReturnValue(admin);
  return { admin, calls };
}
beforeEach(() => vi.clearAllMocks());
describe('manager account provisioning', () => {
  it('creates a sign-in account with requested temporary password and reminder', async () => {
    const { admin } = setup();
    await expect(assignManager(params)).resolves.toEqual({ userId: 'new-manager', accountCreated: true });
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'manager@example.com', password: 'Password123!', email_confirm: true, user_metadata: { full_name: 'Manager', temp_password: true } }));
  });
  it('does not reset an existing account password', async () => {
    const { admin } = setup({ profile: { id: 'existing' } });
    await expect(assignManager(params)).resolves.toMatchObject({ accountCreated: false, userId: 'existing' });
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated callers before using service credentials', async () => {
    setup({ caller: '' });
    await expect(assignManager(params)).rejects.toThrow('Not authenticated');
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('rejects club admin from a different club', async () => {
    setup({ roles: [{ role: 'CLUB_ADMIN', club_id: 'other' }] });
    await expect(assignManager(params)).rejects.toThrow('Forbidden');
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('rejects branch managers assigning managers', async () => {
    setup({ roles: [{ role: 'BRANCH_MANAGER', club_id: 'club' }] });
    await expect(assignManager(params)).rejects.toThrow('Forbidden');
  });
  it('checks branch ownership before creating an auth account', async () => {
    const { admin } = setup({ branch: null });
    await expect(assignManager(params)).rejects.toThrow('Branch does not belong');
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });
  it('revokes the replaced manager only for the assigned branch', async () => {
    const { calls } = setup();
    await assignManager(params);
    const deletion = calls.find(c => c.q.delete.mock.calls.length);
    expect(deletion.q.eq).toHaveBeenCalledWith('branch_id', 'branch');
    expect(deletion.q.eq).toHaveBeenCalledWith('club_id', 'club');
    expect(deletion.q.eq).toHaveBeenCalledWith('user_id', 'old-manager');
  });
});
