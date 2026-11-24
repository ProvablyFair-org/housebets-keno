#!/usr/bin/env node
// The falsifiability battery (<GAME>-29; same script in plinko, roulette and keno): every mutation in tests/mutations.json is
// applied to a throwaway copy of the package, verify runs there, and the mutation is KILLED only when the status of the check
// it names differs from that check's status in an unmutated copy (the baseline): PASS → FAIL / FLAG / GAP / ABSENT, or,
// for a check that is already a disclosed capture-origin FLAG ("FLAG*"), FLAG* → operator FLAG or FAIL. A check whose row is
// missing from the output (verify aborted before printing anything) or a harness error is a SURVIVOR.
// Writes outputs/mutation-results.json (shipped, pinned in RELEASE-MANIFEST.json, regenerated only by this script). The
// record carries no time, host or path, so a re-run on the same package writes the same bytes. Runs PF_MUT_JOBS copies at a
// time (default 6). `node scripts/mutate.mjs M04 M11` runs a subset and writes outputs/run/mutation-results.json instead.
// (14 Oct 2026): the record carries the code fingerprint it ran against (scripts/fingerprint.mjs; KENO-29 rejects any other,
// A mutation may name expectExit and expectVerdict, and a kill then also requires them. 'also'
// applies further text edits to other files, each re-pinned when it says repin. 'regen' is one step or a list, run in order:
// 'rtp-table' (npm run rtp-claim:write in the copy, re-pinned), 'simulate' (the census, re-pinned), then 'record' (the committed
// record regenerated and re-pinned, verify.js rebuilt), always in that order. The scored list comes from the vendored framework profile (profile/profile.json).
// 'repinPackage': the mutated file's sha256 is also replaced in the copy's RELEASE-MANIFEST.json, MANIFEST.md and README.md
// (with 'repin': every place that holds it follows the forgery).
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { codeFingerprint } from './fingerprint.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODE = codeFingerprint(ROOT);   // taken before anything runs; the record is valid only for this code and data
const reg = JSON.parse(readFileSync(join(ROOT, 'tests', 'mutations.json'), 'utf8'));
const only = process.argv.slice(2);
const list = reg.mutations.filter((m) => !only.length || only.includes(m.id));
const JOBS = Number(process.env.PF_MUT_JOBS || 6);
const TAG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).name.split('-')[1];   // housebets-<game>-audit
const sha = (b) => createHash('sha256').update(b).digest('hex');
const NODE = ['--experimental-strip-types', '--no-warnings', '--import', './scripts/ts-resolve.mjs'];

function walk(obj, path) {   // "bets[7]._raw.round.payout" -> [parent, key]
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let o = obj; for (const p of parts.slice(0, -1)) o = o[p];
  return [o, parts[parts.length - 1]];
}
const addDec = (x, d) => { const s = typeof x === 'string'; const v = Math.round((Number(x) + d) * 1e8) / 1e8; return s ? v.toFixed(8) : v; };
// 'rm' deletes 'file' from the copy (an artifact of record that is simply absent). 'truncate' keeps the first
// floor(n * value) records of the array at 'path' and, with 'coherent', sets every other count in the file that equalled n to
// the new length (a population shrink with a header that agrees). 'null' sets each of 'keys' to null in every record of the
// array at 'path' (every reveal withheld). Added 30 Oct 2026: a verifier that throws on one of these prints no row for the
// check it names, and this battery scores that as a survivor.
function truncateAt(root, arr, value, coherent) {
  if (!Array.isArray(arr)) throw new Error('truncate: path is not an array');
  const n0 = arr.length, n1 = Math.floor(n0 * value); arr.length = n1;
  if (coherent) (function fix(o) { if (!o || typeof o !== 'object' || o === arr) return; for (const q of Object.keys(o)) { if (o[q] === n0) o[q] = n1; else if (o[q] === String(n0)) o[q] = String(n1); else fix(o[q]); } })(root);
}
function nullKeys(arr, keys) {
  if (!Array.isArray(arr)) throw new Error('null: path is not an array');
  let n = 0; for (const r of arr) for (const q of keys) if (r && typeof r === 'object' && q in r) { r[q] = null; n++; }
  if (!n) throw new Error('null: no record carries ' + keys.join('/'));
}
function repinAll(dir, oldSha, newSha) {
  for (const f of readdirSync(join(dir, 'src'))) { const p = join(dir, 'src', f); const t = readFileSync(p, 'utf8'); if (t.includes(oldSha)) writeFileSync(p, t.split(oldSha).join(newSha)); }
}
const run = (dir, args, env) => new Promise((res) => { const c = spawn(process.execPath, [...NODE, ...args], { cwd: dir, env: { ...process.env, ...(env || {}) } }); let out = ''; c.stdout.on('data', (d) => out += d); c.stderr.on('data', (d) => out += d); c.on('close', (code) => res({ code, out })); });
const statusOf = (out, id) => { const row = out.split('\n').find((l) => l.trim().startsWith(id + ' ')); return row ? row.trim().split(/\s+/)[1] : 'MISSING'; };

async function one(m) {
  const dir = mkdtempSync(join(tmpdir(), `hb${TAG}-${m.id}-`));
  try {
    cpSync(ROOT, dir, { recursive: true, filter: (s) => !s.includes(join('outputs', 'run')) && !s.includes('node_modules') });
    if (m.baseline) return await run(dir, ['tests/verify.ts']);
    const fp = join(dir, m.file); const before = readFileSync(fp);
    if (m.op === 'rm') rmSync(fp);
    else if (m.op === 'text') {
      const t = before.toString('utf8'); if (!t.includes(m.find)) throw new Error(`${m.id}: text not found`);
      writeFileSync(fp, t.replace(m.find, m.replace));
    } else {
      const obj = JSON.parse(before.toString('utf8'));
      for (const [i, p] of (m.paths || [m.path]).entries()) {
        const [o, k] = walk(obj, p);
        if (m.op === 'set') o[k] = m.values ? m.values[i] : m.value; else if (m.op === 'add') o[k] = addDec(o[k], m.value); else if (m.op === 'delete') o.splice(Number(k), 1); else if (m.op === 'truncate') truncateAt(obj, o[k], m.value, m.coherent); else if (m.op === 'null') nullKeys(o[k], m.keys);
        else if (m.op === 'copy') { const [fo, fk] = walk(obj, m.from); o[k] = JSON.parse(JSON.stringify(fo[fk])); }
      }
      writeFileSync(fp, JSON.stringify(obj, null, 2) + (before.toString('utf8').endsWith('\n') ? '\n' : ''));
    }
    if (m.repin) repinAll(dir, sha(before), sha(readFileSync(fp)));
    if (m.repinPackage) {   // the forgery follows the file's sha256 outside src/ too: the manifest pin and the two documents that quote it
      for (const f of ['RELEASE-MANIFEST.json', 'MANIFEST.md', 'README.md']) {
        const pp = join(dir, f); const pt = readFileSync(pp, 'utf8');
        if (!pt.includes(sha(before))) throw new Error(`${m.id}: the sha256 of ${m.file} is not in ${f}`);
        writeFileSync(pp, pt.split(sha(before)).join(sha(readFileSync(fp))));
      }
    }
    for (const a of m.also || []) {
      const ap = join(dir, a.file); const b0 = readFileSync(ap); const t = b0.toString('utf8'); if (!t.includes(a.find)) throw new Error(`${m.id}: also-text not found in ${a.file}`);
      writeFileSync(ap, t.replace(a.find, a.replace)); if (a.repin) repinAll(dir, sha(b0), sha(readFileSync(ap)));
    }
    const regen = [].concat(m.regen || []);
    if (regen.includes('rtp-table')) {
      const tf = join(dir, 'outputs', 'rtp-claim-table.json'); const old = sha(readFileSync(tf));
      const w = await run(dir, ['src/rtp-settings.ts']); if (w.code !== 0) throw new Error(`${m.id}: rtp-claim:write failed: ${w.out.slice(-300)}`);
      repinAll(dir, old, sha(readFileSync(tf)));
    }
    if (regen.includes('simulate')) {
      const old = sha(readFileSync(join(dir, 'outputs', 'simulation-results.json')));
      const r = await run(dir, ['src/simulate.ts'], { PF_EMIT: '1' });
      if (r.code !== 0) throw new Error(`${m.id}: simulate failed`);
      repinAll(dir, old, sha(readFileSync(join(dir, 'outputs', 'simulation-results.json'))));
    }
    if (regen.includes('record')) {
      // the committed record regenerated and re-pinned (npm run record) and verify.js rebuilt, the package's own workflow after a
      // change, so a stale record (-27) cannot be what catches the mutation
      const rf = join(dir, 'outputs', 'verification-results.json'); const old = sha(readFileSync(rf));
      await run(dir, ['tests/verify.ts']);
      writeFileSync(rf, readFileSync(join(dir, 'outputs', 'run', 'verification-results.json')));
      repinAll(dir, old, sha(readFileSync(rf)));
      const built = await new Promise((res) => { const c = spawn(process.execPath, ['scripts/build-standalone.mjs'], { cwd: dir }); c.on('close', res); });
      if (built !== 0) throw new Error(`${m.id}: build:standalone failed`);
    }
    const { code, out } = await run(dir, ['tests/verify.ts']);
    const status = statusOf(out, m.kills);
    const verdict = (out.match(/VERDICT: (.+)/) || [])[1] || 'none';
    const base = BASE.get(m.kills) ?? 'MISSING';
    const verdictOk = !m.expectVerdict || verdict.startsWith(m.expectVerdict), exitOk = m.expectExit === undefined || code === m.expectExit;
    return { id: m.id, kills: m.kills, what: m.what, baseline: base, status, killed: status !== base && status !== 'MISSING' && base !== 'MISSING' && verdictOk && exitOk, verdict, exit: code, ...(m.expectExit !== undefined ? { expectExit: m.expectExit } : {}) };
  } catch (e) { return { id: m.id, kills: m.kills, what: m.what, status: 'ERROR', killed: false, error: String(e.message) }; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

// the scored checks of the profile (HARD_FAIL / FLAG): each must have at least one killing mutation
const profJson = JSON.parse(readFileSync(join(ROOT, 'profile', 'profile.json'), 'utf8'));
const scored = profJson.checks.filter((c) => c.policy === 'HARD_FAIL' || c.policy === 'FLAG').map((c) => c.id);
// the baseline: every check's status token in an unmutated copy (outputs/run excluded, exactly as for a mutant), except the two
// package checks that read this record and the fresh-copy record (named in the profile "Fresh-clone reproduction" and
// "Mutation battery"), so the record does not depend on itself; no mutation may name those two.
const selfRead = profJson.checks.filter((c) => c.name === 'Fresh-clone reproduction' || c.name === 'Mutation battery').map((c) => c.id);
if (list.some((m) => selfRead.includes(m.kills))) throw new Error(`a mutation names ${selfRead.join('/')}, which read the battery's own record`);
const baseRun = await one({ id: 'BASE', baseline: true });
const BASE = new Map(baseRun.out.split('\n').map((l) => l.trim().split(/\s+/)).filter((t) => /^[A-Z]+-\d+$/.test(t[0]) && !selfRead.includes(t[0])).map((t) => [t[0], t[1]]));
console.log(`baseline (unmutated copy): exit ${baseRun.code}; ${BASE.size} checks read (${selfRead.join(', ')} left out); ${[...BASE.entries()].filter(([, v]) => v !== 'PASS').map(([k, v]) => `${k} ${v}`).join(', ') || 'every check PASS'}`);
const results = []; let next = 0;
await Promise.all(Array.from({ length: Math.min(JOBS, list.length) }, async () => { while (next < list.length) { const m = list[next++]; const r = await one(m); results.push(r); console.log(`  ${r.id.padEnd(5)} ${r.kills}  ${r.killed ? 'KILLED' : 'SURVIVED'} (${r.baseline ?? '?'} → ${r.status}; ${r.verdict ?? r.error}; exit ${r.exit ?? '-'}${r.expectExit !== undefined ? ` (expected ${r.expectExit})` : ''})  ${r.what}`); } }));
results.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const uncoveredSteps = only.length ? [] : scored.filter((id) => !results.some((r) => r.kills === id && r.killed));
const out = { codeSha256: CODE, registrySha256: sha(readFileSync(join(ROOT, 'tests', 'mutations.json'))), baseline: Object.fromEntries([...BASE.entries()].sort()), total: results.length,
  killed: results.filter((r) => r.killed).length, survivors: results.filter((r) => !r.killed).map((r) => ({ id: r.id, kills: r.kills, status: r.status, limitation: null })), uncoveredSteps, results };
const target = only.length ? join(ROOT, 'outputs', 'run', 'mutation-results.json') : join(ROOT, 'outputs', 'mutation-results.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`mutations: ${out.killed}/${out.total} killed; survivors ${out.survivors.length}; scored checks with no killing mutation: ${uncoveredSteps.join(', ') || 'none'}`);
console.log(`wrote ${only.length ? 'outputs/run' : 'outputs'}/mutation-results.json sha256 ${sha(readFileSync(target))}`);
process.exitCode = out.survivors.length || uncoveredSteps.length ? 1 : 0;
