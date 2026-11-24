// HouseBets keno — the simulation CENSUS (KENO-20 Pass 1, KENO-21 Pass 2). A pure function of src/sim-config.ts and the
// shipped datasets (Pass 2 replays every revealed seed): counts and exact integer sums only, re-derived by the verifier, which
// re-runs this census in full.
//   npm run simulate        rewrite outputs/simulation-results.json (the pinned artifact) and print its sha256
//   npm run simulate:run    write outputs/run/simulation-results.json (a regeneration, compared by scripts/fresh-copy-check.mjs)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ballsOf, sha256Hex } from './rng.ts';
import { hitsOf, microOf, configOf, isRisk } from './rules.ts';
import { GRID, DRAWN, PICKS_MAX } from './spec.ts';
import { ROOT, load, PASS2_SETS } from './loader.ts';
import { xoshiro128ss } from './xoshiro.ts';
import { PASS1_SEEDS, PASS1_NONCES, pass1Seed, RUNS_HIGH_FROM, SIM_CONVERGENCE_MARKS, SIM_PASS2_NONCES, SIM_PASS2_EARLY_WINDOW,
  SIM_PASS2_STATISTIC, FRESH_SEED_RULE } from './sim-config.ts';
import type { Dataset } from './types.ts';

/** One Pass 2 window: per configuration "risk/picks", [slots, Σ micro] (integers; the exact mean and SD come from the paytable). */
export interface Window { slots: number; byConfig: Record<string, [number, number]> }

export interface Census {
  design: Record<string, unknown>;
  pass1: { rounds: number; streams: number; totalRounds: number; balls: number[]; firstBall: number[]; hits: number[][]; marks: { n: number; hits: number[][] }[];
           lag1: { n: number; sumXY: string; sumX: string; sumX2: string }; runs: { n: number; n1: number; runs: number; highFrom: number } };
  pass2: { epochs: { set: string; epoch: number; seedHash: string; early: Window; ref: Window }[] };
}

const fresh = (label: string): string => sha256Hex(label);

/** sets: [label, dataset] in PASS2_SETS order; Pass 1 reads none of them, Pass 2 replays every revealed seed of every set. */
export function census(sets: readonly (readonly [string, Dataset])[], onProgress?: (s: string) => void): Census {
  // ── Pass 1: one stream of rounds per pick count, each on its own seeds. Tile counts, first-ball counts, lag-1 sums and
  // runs on the first ball over every round of every stream; the hit histogram of a pick count from its own stream (with
  // snapshots at the marks)
  const balls = new Array(GRID).fill(0), firstBall = new Array(GRID).fill(0);
  const hits = Array.from({ length: PICKS_MAX }, (_, i) => new Array(i + 2).fill(0));
  const marks: { n: number; hits: number[][] }[] = SIM_CONVERGENCE_MARKS.map((m) => ({ n: m, hits: [] }));
  let sx = 0n, sx2 = 0n, sxy = 0n, prev = -1, n = 0, n1 = 0, runs = 0, last: boolean | null = null;
  const drawn = new Uint8Array(GRID), order = new Array(GRID);
  for (let pk = 1; pk <= PICKS_MAX; pk++) { let sn = 0; const row = hits[pk - 1];
  for (let i = 0; i < PASS1_SEEDS; i++) {
    const { server, client, picks } = pass1Seed(pk, i); const S = fresh(server); const rnd = xoshiro128ss(picks);
    for (let nonce = 1; nonce <= PASS1_NONCES; nonce++) {
      const b = ballsOf(S, client, nonce);
      drawn.fill(0); for (const x of b) { balls[x]++; drawn[x] = 1; }
      const f = b[0]; firstBall[f]++; n++;
      const F = BigInt(f); sx += F; sx2 += F * F; if (prev >= 0) sxy += BigInt(prev) * F; prev = f;
      const hi = f >= RUNS_HIGH_FROM; if (hi) n1++; if (hi !== last) { runs++; last = hi; }
      for (let k = 0; k < GRID; k++) order[k] = k;
      let h = 0;
      for (let k = 0; k < pk; k++) {                    // partial Fisher-Yates: this round's pk different picks
        const j = k + Math.floor(rnd() * (GRID - k)); const t = order[k]; order[k] = order[j]; order[j] = t;
        h += drawn[order[k]];
      }
      row[h]++; sn++;
      const mi = SIM_CONVERGENCE_MARKS.indexOf(sn); if (mi >= 0) marks[mi].hits.push([...row]);
    }
  }
  onProgress?.(`pass 1 stream ${pk} picks: ${sn} rounds`); }

  // ── Pass 2: every revealed epoch of every shipped dataset × nonces 1..10,000, the epoch's played bets (risk + picks)
  // cycled over the window; the early window is the epoch's captured nonce range (1..its bet count: 50, or 28 for the tail)
  const epochs: Census['pass2']['epochs'] = [];
  for (const [set, ds] of sets) for (const sd of ds.seeds) {
    const e = Number(sd.epoch);
    const played = ds.bets.filter((b) => b.epoch === e).sort((a, b) => a.nonce - b.nonce);
    const earlyN = played.length;
    const z = (): Window => ({ slots: 0, byConfig: {} });
    const acc = { early: z(), ref: z() };
    for (let nonce = 1; nonce <= SIM_PASS2_NONCES; nonce++) {
      const p = played[(nonce - 1) % played.length]; const risk = p.request.risk, picks = p.request.spots;
      if (!isRisk(risk)) throw new Error(`bet ${p.idx}: risk ${risk}`);
      const m = microOf(risk, picks.length, hitsOf(picks, ballsOf(sd.revealedServerSeed, sd.clientSeed, nonce)));
      const w = nonce <= earlyN ? acc.early : acc.ref; const c = configOf(risk, picks.length);
      w.slots++; const cell = (w.byConfig[c] ??= [0, 0]); cell[0]++; cell[1] += m;
    }
    const sorted = (w: Window): Window => ({ slots: w.slots, byConfig: Object.fromEntries(Object.entries(w.byConfig).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) });
    epochs.push({ set, epoch: e, seedHash: sd.hashedServerSeed, early: sorted(acc.early), ref: sorted(acc.ref) });
  }
  onProgress?.(`pass 2: ${epochs.length} epochs × ${SIM_PASS2_NONCES}`);

  return {
    design: { freshSeedRule: FRESH_SEED_RULE, pass1: { streams: 'one per pick count, each on its own seed labels', seedsPerStream: PASS1_SEEDS, nonces: PASS1_NONCES, drawn: DRAWN, runsHighFrom: RUNS_HIGH_FROM, marks: SIM_CONVERGENCE_MARKS,
        hits: 'hits[n − 1][k] = rounds of the n-pick stream that hit k; balls, firstBall, lag1 and runs count every round of every stream' },
      pass2: { nonces: SIM_PASS2_NONCES, earlyWindow: 'the epoch\'s captured nonce range, 1..its bet count', wholeEpoch: SIM_PASS2_EARLY_WINDOW, datasets: PASS2_SETS.map(([s, f]) => `${s} ${f}`), statistic: SIM_PASS2_STATISTIC,
        units: 'byConfig["risk/picks"] = [slots, Σ micro-multiplier]' } },
    pass1: { rounds: PASS1_SEEDS * PASS1_NONCES, streams: PICKS_MAX, totalRounds: n, balls, firstBall, hits, marks, lag1: { n, sumXY: String(sxy), sumX: String(sx), sumX2: String(sx2) }, runs: { n, n1, runs, highFrom: RUNS_HIGH_FROM } },
    pass2: { epochs },
  };
}

export const censusText = (c: Census): string => JSON.stringify(c, null, 2) + '\n';

if (process.argv[1] && /simulate\.ts$/.test(process.argv[1])) {
  const t0 = Date.now();
  const c = census(PASS2_SETS.map(([s, f]) => [s, load(f)] as const), (s) => console.log(`  ${s}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`));
  const text = censusText(c);
  const emit = process.env.PF_EMIT === '1';
  const dir = emit ? join(ROOT, 'outputs') : join(ROOT, 'outputs', 'run'); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'simulation-results.json'), text);
  console.log(`wrote ${emit ? 'outputs' : 'outputs/run'}/simulation-results.json sha256 ${createHash('sha256').update(text).digest('hex')}`);
}
