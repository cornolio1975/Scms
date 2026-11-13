import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readPlatformKpis } from './platform-kpis';

function database(values: Record<string, number> = {}, failedTable?: string) {
  const requests: URL[] = [];
  const db = createClient('https://metrics.example.test', 'test-key', {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      requests.push(url);
      expect(init?.method).toBe('HEAD');
      const table = url.pathname.split('/').pop()!;
      const failed = table === failedTable;
      return new Response(null, { status: failed ? 500 : 200,
        headers: { 'content-range': `*/${values[table] ?? 0}` } });
    } },
  });
  return { db, requests };
}

describe('persisted platform metrics', () => {
  it('preserves real zeroes without sample clubs, branches, users or 142 synced athletes', async () => {
    const { db } = database();
    const kpis = await readPlatformKpis(db);
    expect(Object.values(kpis).every(value => value === 0)).toBe(true);
  });

  it('returns decreased database counts on the next refresh and excludes archived branches', async () => {
    const first = database({ club_branches: 4 });
    expect((await readPlatformKpis(first.db)).totalBranches).toBe(4);
    const next = database({ club_branches: 3 });
    expect((await readPlatformKpis(next.db)).totalBranches).toBe(3);
    expect(next.requests.find(url => url.pathname.endsWith('/club_branches'))?.searchParams.get('or'))
      .toBe('(status.is.null,status.not.in.(Archived,ARCHIVED))');
    expect(next.requests.find(url => url.pathname.endsWith('/approval_requests'))?.searchParams.get('status'))
      .toBe('eq.PENDING_APPROVAL');
  });

  it('reports core database failures instead of successful zero or local totals', async () => {
    const { db } = database({}, 'club_branches');
    await expect(readPlatformKpis(db)).rejects.toThrow('totalBranches');
  });

  it('keeps core counts available when optional sync tracking is missing', async () => {
    const { db } = database({ club_branches: 3 }, 'sync_jobs');
    expect(await readPlatformKpis(db)).toMatchObject({ totalBranches: 3, pendingSyncJobs: null });
  });
});
