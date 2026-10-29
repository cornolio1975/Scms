const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/integrations/scms-source.ts', 'utf8');

function fixture(tables, user = { id: 'admin' }) {
  const calls = [];
  const db = {
    auth: { getUser: async () => ({ data: { user } }) },
    from(table) {
      let filters = [];
      const q = {
        select() { return q; },
        eq(key, value) { filters.push([key, [value]]); return q; },
        in(key, values) { filters.push([key, values]); return q; },
        order() { return q; },
        maybeSingle() { q.single = true; return q; },
        then(resolve) {
          calls.push({ table, filters });
          const rows = (tables[table] || []).filter(row => filters.every(([key, values]) => values.includes(row[key])));
          return Promise.resolve({ data: q.single ? rows[0] || null : rows, error: null }).then(resolve);
        },
      };
      return q;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, process: { env: {} },
    require(name) {
      if (name.includes('karatetech-sync')) return {};
      if (name === '@supabase/supabase-js') return { createClient: () => db };
      return { createClient: async () => db };
    },
  });
  return { api: module.exports, db, calls };
}

test('athlete without Auth account is listed with genuine measurements', async () => {
  const f = fixture({ members: [{ id: 'athlete-1', club_id: 'club-a', full_name: 'Athlete', date_of_birth: '2000-01-01', ic_passport: 'ID', sport_data: { weightKg: 60, heightCm: 170 } }], user_roles: [] });
  const rows = await f.api.sourceMembers({ db: f.db, club: { id: 'club-a' }, branches: null });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'athlete-1');
  assert.equal(rows[0].dob, '2000-01-01');
  assert.equal(rows[0].weight, 60);
  assert.equal(rows[0].height, 170);
  assert.equal(rows[0].passport_ic, 'ID');
});

test('branch and club filters exclude athletes outside permitted context', async () => {
  const f = fixture({ members: [
    { id: 'ok', club_id: 'a', branch_id: 'one' },
    { id: 'wrong-branch', club_id: 'a', branch_id: 'two' },
    { id: 'wrong-club', club_id: 'b', branch_id: 'one' },
  ] });
  const rows = await f.api.sourceMembers({ db: f.db, club: { id: 'a' }, branches: ['one'] });
  assert.deepEqual(Array.from(rows, r => r.id), ['ok']);
});

test('linked user profile does not duplicate canonical member athlete', async () => {
  const f = fixture({
    members: [{ id: 'member', club_id: 'a', profile_id: 'user', full_name: 'Member' }],
    user_roles: [{ user_id: 'user', club_id: 'a', role: 'ATHLETE' }],
    profiles: [{ id: 'user', full_name: 'Profile' }],
  });
  const rows = await f.api.sourceMembers({ db: f.db, club: { id: 'a' }, branches: null });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'member');
});

test('unauthenticated and unrelated users cannot load transfer source', async () => {
  const anonymous = fixture({}, null);
  await assert.rejects(() => anonymous.api.syncContext('a'), error => error.status === 401);
  const outsider = fixture({ user_roles: [{ user_id: 'admin', club_id: 'b', role: 'CLUB_ADMIN' }] });
  await assert.rejects(() => outsider.api.syncContext('a'), error => error.status === 403);
});
