import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/integrations/karatetech-sync.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
});
const { KarateTechApiClient: client } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let requests = 0;
try {
  process.env.NODE_ENV = 'production';
  delete process.env.KARATETECH_API_URL;
  delete process.env.NEXT_PUBLIC_KARATETECH_API_URL;
  delete process.env.KARATETECH_API_KEY;
  globalThis.fetch = async () => { requests++; throw new TypeError('fetch failed'); };
  await assert.rejects(client.syncParticipant({}, 'test'), /connection is not configured/);
  assert.equal(requests, 0);
  process.env.KARATETECH_API_URL = 'https://receiver.example';
  await assert.rejects(client.syncParticipant({}, 'test'), /authentication is not configured/);
  process.env.KARATETECH_API_KEY = 'test-only';
  await assert.rejects(client.syncParticipant({}, 'test'), /connection failed/);
  globalThis.fetch = async () => new Response('<html>Not found</html>', { status: 404, headers: { 'Content-Type': 'text/html' } });
  await assert.rejects(client.syncParticipant({}, 'test'), /athlete receiver is unavailable/);
  globalThis.fetch = async () => Response.json({ success: true });
  await assert.rejects(client.syncParticipant({}, 'test'), /did not return a participant ID/);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://receiver.example/api/integration/scms/participants');
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    assert.equal(JSON.parse(options.body).scms_participant_id, 'member-1');
    return Response.json({ karate_participant_id: 'kt-1' });
  };
  assert.equal((await client.syncParticipant({ id: 'member-1' }, 'test')).karatetechId, 'kt-1');
  globalThis.fetch = async () => Response.json({ error: 'Review duplicate' }, { status: 409 });
  assert.equal((await client.syncParticipant({}, 'test')).status, 'CONFLICT');
  console.log('KarateTech connection regression checks passed (7 scenarios).');
} finally {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
}
