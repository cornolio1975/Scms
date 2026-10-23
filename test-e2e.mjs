// Read-only anonymous-access smoke checks. No test-role impersonation headers.
import assert from 'node:assert/strict';
const base=process.env.SCMS_TEST_URL;
if(!base)throw Error('Set SCMS_TEST_URL to an explicitly selected test deployment');
for(const path of ['/api/workspace','/api/v1/clubs','/api/integration/karatetech/health']){const r=await fetch(new URL(path,base),{redirect:'manual'});assert.equal(r.status,401,`${path} must reject anonymous requests`)}
console.log('Anonymous endpoint protection passed. Run npm test for role, database and payment checks.');
