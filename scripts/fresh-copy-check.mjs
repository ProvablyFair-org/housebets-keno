#!/usr/bin/env node
// <GAME>-28 release gate (same script in plinko, roulette and keno), as far as a working copy allows: copy the package (no
// outputs/run, no node_modules) to a fresh temporary folder, run the full test there (RNG vectors + verify) and the standalone
// verify.js, regenerate the census into outputs/run/, compare it with the committed one field by field (integers and strings
// exact, other numbers within 1e-14 + 1e-12·max|·|), and check that no pinned artifact or dataset changed.
// Writes outputs/fresh-copy.json (shipped, pinned in RELEASE-MANIFEST.json, regenerated only by this script; no time,
// host or path in it, so a re-run on the same package and Node writes the same bytes) and outputs/run/diff.json.
// A git clone + `npm ci` is the release-time form of this check.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, mkdtempSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { gateFailures } from './fresh-copy-gate.mjs';
import { codeFingerprint } from './fingerprint.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NODE = ['--experimental-strip-types', '--no-warnings', '--import', './scripts/ts-resolve.mjs'];
const CODE = codeFingerprint(ROOT);   // the record names the code and data it ran against; KENO-28 rejects any other
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const files = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : [p]; });
const TAG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).name.split('-')[1];   // housebets-<game>-audit
const dir = mkdtempSync(join(tmpdir(), `hb${TAG}-fresh-`));
cpSync(ROOT, dir, { recursive: true, filter: (s) => !s.includes(join('outputs', 'run')) && !s.includes('node_modules') });
const tracked = [...files(join(dir, 'data')), ...files(join(dir, 'evidence')),
  ...['simulation-results.json', 'rtp-claim-table.json', 'verification-results.json', 'mutation-results.json', 'fresh-copy.json'].map((f) => join(dir, 'outputs', f)).filter((p) => existsSync(p))];
const before = new Map(tracked.map((p) => [p, sha(p)]));

const t0 = Date.now();
const rng = spawnSync(process.execPath, [...NODE, '--test', 'tests/rng.test.ts', 'tests/independent.test.ts'], { cwd: dir, encoding: 'utf8' });
const ver = spawnSync(process.execPath, [...NODE, 'tests/verify.ts'], { cwd: dir, encoding: 'utf8' });
const std = existsSync(join(dir, 'verify.js')) ? spawnSync(process.execPath, ['verify.js'], { cwd: dir, encoding: 'utf8' }) : null;
const sim = spawnSync(process.execPath, [...NODE, 'src/simulate.ts'], { cwd: dir, encoding: 'utf8' });

function diff(a, b, path = '', out = []) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isInteger(a) && Number.isInteger(b) ? a !== b : Math.abs(a - b) > 1e-14 + 1e-12 * Math.max(Math.abs(a), Math.abs(b))) out.push({ path, committed: a, run: b });
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], path ? `${path}.${k}` : k, out);
  } else if (a !== b) out.push({ path, committed: a, run: b });
  return out;
}
const regen = join(dir, 'outputs', 'run', 'simulation-results.json');
const d = existsSync(regen) ? diff(JSON.parse(readFileSync(join(dir, 'outputs', 'simulation-results.json'), 'utf8')), JSON.parse(readFileSync(regen, 'utf8'))) : [{ path: '(no regeneration)' }];
const changed = tracked.filter((p) => sha(p) !== before.get(p)).map((p) => relative(dir, p));
const verdict = (ver.stdout.match(/VERDICT: (.+)/) || [])[1] || null;
const stdVerdict = std ? (std.stdout.match(/VERDICT: (.+)/) || [])[1] || null : null;
// the gate expects the committed record's verdict with that verdict's exit code
// (rtpClaimVerdict's map), not exit 0 only, so a Conditional Pass (2) or RTP FIGURE OVERSTATED (5) package can pass its gate
const exitOf = (v) => !v ? null : v.startsWith('NOT PROVABLY FAIR') ? 1 : v.startsWith('INCOMPLETE') ? 3 : v.startsWith('RTP FIGURE OVERSTATED') ? 5
  : v === 'PROVABLY FAIR — Conditional Pass' ? 2 : v === 'PROVABLY FAIR — Full Pass' ? 0 : null;
const committedVerdict = JSON.parse(readFileSync(join(ROOT, 'outputs', 'verification-results.json'), 'utf8')).verdict;
const expectedExit = exitOf(committedVerdict);
const result = { codeSha256: CODE, committedVerdict, expectedExit, node: process.versions.node, rngTestsExit: rng.status, exit: ver.status, verdict, standaloneExit: std ? std.status : null, standaloneVerdict: stdVerdict,
  reproduced: /REPRODUCED/.test(ver.stdout), standaloneReproduced: std ? /REPRODUCED/.test(std.stdout) : null, simulateExit: sim.status, beyondTolerance: d.length,
  pinnedUnchanged: changed.length === 0, changed };
mkdirSync(join(ROOT, 'outputs', 'run'), { recursive: true });
writeFileSync(join(ROOT, 'outputs', 'run', 'diff.json'), JSON.stringify({ node: process.versions.node, artifact: 'outputs/simulation-results.json', fieldsBeyondTolerance: d }, null, 2) + '\n');
// The pass rule is scripts/fresh-copy-gate.mjs: both verifiers ran, each with the committed record's verdict, its exit code
// and a confirmed reproduction. Only a passing run replaces the committed record; a failed run is kept in outputs/run/.
const EXPECTED_VERDICT = JSON.parse(readFileSync(join(ROOT, 'outputs', 'verification-results.json'), 'utf8')).verdict;
const failures = gateFailures({ ...result, standaloneVerdict: stdVerdict, standaloneReproduced: std ? /REPRODUCED/.test(std.stdout) : null }, EXPECTED_VERDICT);
if (failures.length === 0) writeFileSync(join(ROOT, 'outputs', 'fresh-copy.json'), JSON.stringify(result, null, 2) + '\n');
else writeFileSync(join(ROOT, 'outputs', 'run', 'fresh-copy-failed.json'), JSON.stringify({ failures, expectedVerdict: EXPECTED_VERDICT, result }, null, 2) + '\n');
rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify(result, null, 2));
if (failures.length === 0) console.log(`wrote outputs/fresh-copy.json sha256 ${sha(join(ROOT, 'outputs', 'fresh-copy.json'))} (${Math.round((Date.now() - t0) / 1000)} s)`);
if (failures.length) console.error(`fresh-copy gate FAILED: outputs/fresh-copy.json left as it was, this run kept in outputs/run/fresh-copy-failed.json\n  - ${failures.join('\n  - ')}`);
process.exitCode = failures.length ? 1 : 0;
