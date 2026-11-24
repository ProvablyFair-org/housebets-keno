// KENO-21 Pass 2 — its false-alarm rate on honest data, DECLARED here and re-checkable with `npm run false-alarm:pass2`.
// Pass 2 rejects when the standardized early-window return of the played configurations (each slot's multiplier minus its
// configuration's exact mean, over its exact SD, summed and divided by √slots) has a one-sided normal lower-tail p below
// 0.01. Each term is bounded below (a loss is at most mean/SD under the mean) and heavy above (2,000× at 1 in 847,660,528),
// so the sum's true lower tail at the normal 1 % point can differ from 1 %. No closed form; this is a plain Monte Carlo over
// the played bets of every revealed seed (the 7,278 of the shipped datasets since the widening of 27 Oct 2026; fixed seed,
// xoshiro128**): each replicate draws every slot's hit count from its exact
// hypergeometric law, and the rate is the share of replicates the rule rejects.
import { load, PASS2_SETS } from './loader.ts';
import { normalLowerTailP } from './stats.ts';
import { SIM_PASS2_ALPHA } from './sim-config.ts';
import { D, hitWeight, microOf, moments, isRisk } from './rules.ts';
import { xoshiro128ss } from './xoshiro.ts';

export const PASS2_FALSE_ALARM = Object.freeze({
  rate: 0.00622,
  standardError: 0.000176,
  replicates: 200_000,
  seed: 20261013,
  method: 'plain Monte Carlo over the played bets of every revealed seed, all shipped datasets (hits ~ the exact hypergeometric of the bet\'s pick count, term = (micro − mean)/sd of its configuration), rule applied to each replicate',
});

export function simulatePass2FalseAlarm(replicates: number, seed: number) {
  const bets = PASS2_SETS.flatMap(([, f]) => load(f).bets);
  const cache = new Map<string, { cdf: Float64Array; term: Float64Array }>();
  const slots = bets.map((b) => {
    const risk = b.request.risk, n = b.request.spots.length; if (!isRisk(risk)) throw new Error(`bet ${b.idx}: risk ${risk}`);
    const key = `${risk}/${n}`; let c = cache.get(key);
    if (!c) {
      const { meanD, varD2 } = moments(risk, n); const mean = Number(meanD) / Number(D), sd = Math.sqrt(Number(varD2)) / Number(D);
      const cdf = new Float64Array(n + 1), term = new Float64Array(n + 1); let acc = 0n;
      for (let k = 0; k <= n; k++) { acc += hitWeight(n, k); cdf[k] = Number(acc) / Number(D); term[k] = (microOf(risk, n, k) / 1e6 - mean / 1e6) / (sd / 1e6); }
      cdf[n] = 1; c = { cdf, term }; cache.set(key, c);
    }
    return c;
  });
  const rnd = xoshiro128ss(seed), root = Math.sqrt(slots.length);
  let rej = 0;
  for (let r = 0; r < replicates; r++) {
    let s = 0;
    for (const t of slots) { const u = rnd(); let k = 0; while (u >= t.cdf[k]) k++; s += t.term[k]; }
    if (normalLowerTailP(s / root) < SIM_PASS2_ALPHA) rej++;
  }
  const rate = rej / replicates;
  return { rate: Number(rate.toFixed(5)), standardError: Number(Math.sqrt(rate * (1 - rate) / replicates).toPrecision(3)), replicates, seed, slots: slots.length };
}

if (process.argv[1] && /false-alarm-pass2\.ts$/.test(process.argv[1])) {
  const r = simulatePass2FalseAlarm(PASS2_FALSE_ALARM.replicates, PASS2_FALSE_ALARM.seed);
  const same = r.rate === PASS2_FALSE_ALARM.rate && r.standardError === PASS2_FALSE_ALARM.standardError;
  console.log(JSON.stringify(r), same ? '== the declaration' : '!= the declaration: update PASS2_FALSE_ALARM');
  process.exitCode = same ? 0 : 1;
}
