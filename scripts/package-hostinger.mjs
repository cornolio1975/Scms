import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// git archive packages only committed source. An allowlist also excludes any
// accidentally tracked environment files, diagnostics, and local runtime data.
const entries = execFileSync('git', ['ls-tree', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split('\n');
const allowed = new Set(['src', 'public', 'scripts', 'docs', 'README.md', '.env.example', '.gitignore', 'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs', 'eslint.config.mjs']);
const paths = entries.filter(p => allowed.has(p));
if (!paths.includes('package-lock.json')) throw new Error('Commit the npm lockfile before packaging.');
mkdirSync('artifacts', { recursive: true });
const output = resolve('artifacts/scms-hostinger-source.zip');
const zip = execFileSync('git', ['archive', '--format=zip', 'HEAD', '--', ...paths], { maxBuffer: 50 * 1024 * 1024 });
writeFileSync(output, zip);
console.log(`Source ZIP: ${output}\nContains committed source only; Hostinger must build it with production environment values.`);
