// KENO-20 / KENO-22 tile screen — the without-replacement correction, and its false-alarm rate DECLARED here and re-checkable
// with `npm run false-alarm:tiles` (, 14 Oct 2026).
//
// Each round draws D = 10 different tiles of K = 40, so a tile's indicator has variance q(1 − q), q = D/K, and two tiles'
// indicators have covariance D(D − 1)/(K(K − 1)) − q² = −q(1 − q)/(K − 1). The count vector over N rounds therefore has
// covariance N·q(1 − q)·K/(K − 1)·(I − J/K), a projection of rank K − 1, and the plain Pearson sum
// X² = Σ (O − Nq)²/(Nq) has mean K(1 − q) = 30 and tends to (1 − q)·K/(K − 1)·χ²(K − 1). The corrected statistic is
//     X² · (K − 1) / (K (1 − q)) = X² · 39/30 ~ χ²(39).
// The false-alarm rate below is a plain Monte Carlo of the corrected screen at α/3 on uniform draws (fixed seed,
// xoshiro128**, partial Fisher-Yates over the 40 tiles): REPLICATES samples of ROUNDS rounds each. ROUNDS is far below the
// census's 1,000,000 rounds; the χ²(39) law is asymptotic in N, so this measures the calibration of the correction, and the
// rate at the census depth is α/3 under that law.
import { GRID, DRAWN } from './spec.ts';
import { ALPHA_SCREEN } from './sim-config.ts';
import { chiSquaredPValue } from './stats.ts';
import { xoshiro128ss } from './xoshiro.ts';

/** (K − 1)/(K(1 − q)) with q = D/K: 39/30 for 10 of 40. */
export const TILE_CHI2_FACTOR = (GRID - 1) / (GRID * (1 - DRAWN / GRID));
/** The corrected tile statistic from per-tile counts over N rounds. */
export function tileChi2(counts: readonly number[], rounds: number): { x2: number; chi2: number; df: number; p: number } {
  const e = rounds * DRAWN / GRID, x2 = counts.reduce((s, o) => s + (o - e) ** 2 / e, 0), chi2 = x2 * TILE_CHI2_FACTOR;
  return { x2, chi2, df: GRID - 1, p: chiSquaredPValue(chi2, GRID - 1) };
}

export const TILE_FALSE_ALARM = Object.freeze({
  rate: 0.00339,
  standardError: 0.00013,
  meanStatistic: 38.99,
  replicates: 200_000,
  rounds: 2_000,
  seed: 20261014,
  method: 'plain Monte Carlo: each replicate draws ROUNDS rounds of 10 different tiles of 40 (partial Fisher-Yates, xoshiro128**), corrected statistic X²·39/30, screen p < α/3',
});

export function simulateTileFalseAlarm(replicates: number, rounds: number, seed: number) {
  const rnd = xoshiro128ss(seed), tiles = new Int32Array(GRID), counts = new Array<number>(GRID);
  let rej = 0, sum = 0;
  for (let r = 0; r < replicates; r++) {
    counts.fill(0);
    for (let n = 0; n < rounds; n++) {
      for (let i = 0; i < GRID; i++) tiles[i] = i;
      for (let i = 0; i < DRAWN; i++) { const j = i + Math.floor(rnd() * (GRID - i)); const t = tiles[i]; tiles[i] = tiles[j]; tiles[j] = t; counts[tiles[i]]++; }
    }
    const { chi2, p } = tileChi2(counts, rounds); sum += chi2; if (p < ALPHA_SCREEN) rej++;
  }
  const rate = rej / replicates;
  return { rate: Number(rate.toFixed(5)), standardError: Number(Math.sqrt(rate * (1 - rate) / replicates).toPrecision(3)), meanStatistic: Number((sum / replicates).toFixed(2)), replicates, rounds, seed };
}

if (process.argv[1] && /false-alarm-tiles\.ts$/.test(process.argv[1])) {
  const r = simulateTileFalseAlarm(TILE_FALSE_ALARM.replicates, TILE_FALSE_ALARM.rounds, TILE_FALSE_ALARM.seed);
  const same = r.rate === TILE_FALSE_ALARM.rate && r.standardError === TILE_FALSE_ALARM.standardError && r.meanStatistic === TILE_FALSE_ALARM.meanStatistic;
  console.log(JSON.stringify(r), same ? '== the declaration' : '!= the declaration: update TILE_FALSE_ALARM');
  process.exitCode = same ? 0 : 1;
}
