// The independent cross-check of the draw, the settlement and the RTP: tests/independent/keno-rebuild.py, a byte copy of the
// rebuild written in Python on 14 Oct 2026, independently of this package's code, from HouseBets' published spec (E01) and the
// exhibits (its header: no package code; it imports only Python's standard library). It recomputes every shipped bet's ten
// balls, hits, paytable cell and payout and every paytable's exact RTP with its own code, not src/rng.ts. This test runs it on
// the package and requires every count it prints to be complete. It needs python3; without it the test is SKIPPED and says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'tests', 'independent', 'keno-rebuild.py');
/** sha256 of the rebuild as written on 14 Oct 2026; the shipped copy must be byte-identical. */
const REBUILD_SHA256 = '69bd9fcb578ddb41e75dc913b3a9f545f8ff79215c488327a0a26067cb4ef4ef';
const py = spawnSync('python3', ['--version'], { encoding: 'utf8' });

test('the independent rebuild is the file as written, byte for byte', () => {
  assert.equal(createHash('sha256').update(readFileSync(FILE)).digest('hex'), REBUILD_SHA256);
});

test('the independent rebuild reproduces every shipped bet and every paytable RTP', { skip: py.status === 0 ? false : 'python3 not found: the independent cross-check did not run' }, () => {
  const r = spawnSync('python3', ['-I', FILE, ROOT], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  assert.match(out, /paytable E01 == E07 \(40 rows, cell for cell\): True/);
  assert.match(out, /E01 examples recomputed: 4\/4/);
  assert.match(out, /E01 payout examples \(cell == multiplier\): 8\/8/);
  const files = [...out.matchAll(/^(data\/\S+\.json): bets (\d+), seeds (\d+), commitments (\d+)\/(\d+)/gm)];
  assert.equal(files.length, 6, 'the five shipped datasets and the as-captured file');
  for (const [, f, , , c, s] of files) assert.equal(c, s, `${f}: commitments ${c}/${s}`);
  const counts = [...out.matchAll(/\b([a-z0-9]+) (\d+)\/(\d+)\b/g)].filter(([, k]) => /^(balls|rawballs|hits|rawhits|micro|rawmicro|payout|rawpayout|roundpayout|mult|rawnonce|rawseed|e04)$/.test(k));
  assert.equal(counts.length, 13 * 6, 'thirteen counters for each of the six files');
  for (const [m, , a, b] of counts) assert.equal(a, b, m);
  assert.match(out, /RTP exact == E01 stated fraction: 40\/40; rtpFloat agrees: 40\/40; inside \[99\/100 - 1e-6, 99\/100\]: 40\/40/);
  assert.match(out, /configs beyond 0\.1 pp: 0/);
});
