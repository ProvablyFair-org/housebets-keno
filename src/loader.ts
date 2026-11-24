// Dataset pins and the population of record, stated as CODE next to the pin (the framework's G-BIND rule: a dataset
// that agrees with its own header proves nothing; the scored steps compare against these constants, never meta).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import type { Dataset } from './types.ts';

/** The package root: the nearest folder above this module holding package.json "housebets-keno-audit" (works from src/
 *  under Node and from the bundled verify.js at the root). */
function findRoot(): string {
  let d = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const p = join(d, 'package.json');
    if (existsSync(p) && /"name":\s*"housebets-keno-audit"/.test(readFileSync(p, 'utf8'))) return d;
    d = dirname(d);
  }
  throw new Error('package root not found');
}
export const ROOT = findRoot();
export const DATA = join(ROOT, 'data');

// Phase A primary: the 133 whole epochs of the 12 Oct 2026 capture (as-captured file split by scripts/split-whole-epochs.mjs)
export const PRIMARY_FILE = 'housebets-keno-phaseA-6650bets.json';
export const PRIMARY_SHA256 = '6b2d29f0d155deb79639e35f8307d39b11d1e1d308b9939bc451b70673ffff6f';
export const TAIL_FILE = 'housebets-keno-phaseA-tail-28bets.json';
export const TAIL_SHA256 = '4922dcd5549517197f54137e60faf2864f89c896ad594185bc43b0107cc50633';
export const AS_CAPTURED_FILE = 'as-captured/housebets-keno2-sp1-6678bets.json';
export const AS_CAPTURED_SHA256 = '0cd3d3d46e62e28ba9b3b23d31851cbedc7f6e3ce9ea80019b2ced082f548c6e';
// Supplementary phases (13 Oct 2026), each its own dataset and evidence id (audit-rules §2.5)
export const PHASE_C_FILE = 'supplementary/housebets-keno2-phaseC-200bets.json';
export const PHASE_C_SHA256 = '8d2f195ee18b0a9764fd290507add154793026de9fdeb005b51d01fc9be67890';
export const PHASE_C10_FILE = 'supplementary/housebets-keno2-phaseC-10usd-200bets.json';
export const PHASE_C10_SHA256 = '30c0ba41ccccc6dce8b2fdc56ee1c141ccee0e23cb90e7bc0a25cc07181bb99f';
export const PHASE_D_FILE = 'supplementary/housebets-keno2-phaseD-200bets.json';
export const PHASE_D_SHA256 = '81d019879bd07cd0d100d849127f0247605375acd214ea1081679e32c5fda8f0';

// the excluded same-engine capture (12 Oct 2026, first capture, NOT shipped; src/pilot.ts recomputes it from the workshop copy)
export const PILOT_FILE = 'housebets-keno2-sp1-480bets.json';
export const PILOT_SHA256 = '2a50f91545de5ed006664d387dd23f71cefa3827313f3058ecbc33b1c78dfd95';

/** Evidence exhibits (all pinned, scripts/make-evidence.py). */
export const EVIDENCE_PINS: readonly (readonly [string, string])[] = [
  ['evidence/E01-keno-fairness-spec-2026-10-12.json', '436bffa0079e597c02a2f7ea1c7e5eeb0e3b8ee9c21e80b33e36ccddb2b35856'],
  ['evidence/E02-keno-rules-panel-2026-10-10.json', 'bbba31e18bf9eba15cdf3b8d3bd4ec1a8b9ca0d4676a37c7048f6aef22ec4366'],
  ['evidence/E03-keno-limits-2026-10-12.json', '81c0207b17125750e2479a0998043ec6795d6f9b4ad5161b4cf9679d3eb7b9ec'],
  ['evidence/E04-keno-bet-history-2026-10-13.json', '96c3b39195302dbf212b5a9b979144add73e1a493ef176cad68207dc44d58c63'],
  ['evidence/E05-account-reconcile-2026-10-13.txt', 'edbda5cf5231e917b212f3d075550f2470f667b343d35365424d02b52b94df39'],
  ['evidence/E06-keno-empty-seed-control-2026-10-13.json', '058833a396fecd85d04c5465097b3add9ef50882b53d8fca8b3659d8380343da'],
  ['evidence/E07-keno-bundle-paytable-autopick-2026-10-10.json', '913d827bee18301a08cc19a6ce8caddf4be0259b98463dd366995f59a726fd13'],
  ['evidence/E08-keno-rules-panel-live-2026-10-19.json', 'afbd2330c9f04a3d2985016be066fc799a3e9565dfd81bae57e4434d9935bd23'],
];

// The population of record (G-BIND)
export const EXPECTED_BETS = 6650;
export const EXPECTED_SEEDS = 133;
export const EXPECTED_EPOCHS = 133;
export const EXPECTED_EPOCH_SIZE = 50;
export const EXPECTED_TAIL_BETS = 28;
export const EXPECTED_PHASE_C_BETS = 200;      // 4 epochs × 50, low risk, 1 pick, stake = 100 × minimum
export const EXPECTED_PHASE_C10_BETS = 200;    // 4 epochs × 50, low risk, 1 pick, stake 10
export const EXPECTED_PHASE_D_BETS = 200;      // 4 epochs × 50, one player-set client seed per epoch
/** Phase C config: the one with the highest exact P(non-zero payout) (KENO-12 recomputes the ranking from the paytable). */
export const PHASE_C_RISK = 'low';
export const PHASE_C_PICKS = 1;
export const PHASE_C_STAKE = '1.000311';       // 100 × E03 minimum 0.01000311
export const PHASE_C10_STAKE = '10';
export const PHASE_D_SEEDS = ['provablyfair-1', 'provablyfair-2', 'player-seed-abc', '1234567890'] as const;
export const NONCE_BASE = 1;   // HouseBets nonces start at 1 on a fresh pair (every epoch of the capture)
/** Pass 2 (KENO-21) replays EVERY revealed seed of the shipped datasets, in this order: Phase A 133, its tail 1, C 4, C $10 4,
 *  D 4 = 146. */
export const PASS2_SETS: readonly (readonly [string, string])[] = [['A', PRIMARY_FILE], ['tail', TAIL_FILE], ['C', PHASE_C_FILE],
  ['C10', PHASE_C10_FILE], ['D', PHASE_D_FILE]];
export const EXPECTED_REVEALED_SEEDS = 146;
/** KENO-15: every (risk, picks) configuration ≥ the floor in Phase A, against the capture plan below. */
export const COVERAGE_FLOOR = 50;
/** Phase A capture plan (as-captured meta.planDoc): "4 risks × spots 1..10 × 12", repeated 14 times, each class named
 *  "<risk>-<picks>"; the pick sets a CSPRNG sample of 0..39. */
export const PLAN_CLASSES: readonly string[] = ['classic', 'low', 'medium', 'high'].flatMap((r) => Array.from({ length: 10 }, (_, i) => `${r}-${i + 1}`));

export const sha256Bytes = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
export const sha256File = (rel: string): string => sha256Bytes(readFileSync(join(ROOT, rel.startsWith('evidence/') || rel.startsWith('outputs/') ? rel : join('data', rel))));
export const load = (rel: string): Dataset => JSON.parse(readFileSync(join(DATA, rel), 'utf8')) as Dataset;
export const readJson = (rel: string): any => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
