// HouseBets keno — FROZEN SIMULATION DESIGN, single-sourced so the producer (src/simulate.ts) and the verifier
// (tests/verify.ts, KENO-20 / KENO-21) cannot pin different experiments. Every seed of the experiment is a fixed string or
// number, so the census (ball counts, hit histograms, sums, per-epoch returns) is a deterministic function of this file and
// the dataset: a re-run reproduces it byte for byte; the verifier re-runs it in full and never trusts a statistic the
// artifact reports.

// ── The KENO profile's floors (games/keno/profile.json, -20 / -21), held apart from the design so a cheaper design cannot
// lower them: the verifier compares the census against THESE, not against the design's own constants.
//   -20: "1,000,000 rounds per config"      -21: "10,000 nonces per revealed seed"
export const FLOOR_ROUNDS_PER_CONFIG = 1_000_000;
export const FLOOR_PASS2_NONCES = 10_000;

export const ALPHA = 0.01;
export const ALPHA_SCREENS = 3;
export const ALPHA_SCREEN = ALPHA / ALPHA_SCREENS;

// ── Pass 1: one stream per pick count (1 … 10), each on its own 100 fresh seeds × nonces 1..10,000 = 1,000,000 rounds:
// 10 streams, 10,000,000 rounds, no round shared between two pick counts. In the stream of n picks every round draws a
// uniformly random pick set of n different tiles from an independent generator (xoshiro128**, seeded per fresh seed
// below). The draw does not depend on the risk (KENO-17), so the four risk levels of a pick count settle on that pick
// count's stream: every one of the 40 configurations has 1,000,000 rounds. The tile and serial screens run on the balls
// of all 10,000,000 rounds, in stream order.
export const PASS1_SEEDS = 100;
export const PASS1_NONCES = 10_000;
export const SIM_ROUNDS = PASS1_SEEDS * PASS1_NONCES;              // per stream: ≥ FLOOR_ROUNDS_PER_CONFIG, for every configuration
export const pass1Seed = (picks: number, i: number): { server: string; client: string; picks: number } =>
  ({ server: `housebets-keno-audit/sim/pass1/picks-${picks}/server/${i}`, client: `housebets-keno-audit/sim/pass1/picks-${picks}/client/${i}`, picks: 20261013 + 1000 * picks + i });
/** Serial screens run on the first ball of each round; "high" = a first ball of 20..39 (20 of the 40 tiles). */
export const RUNS_HIGH_FROM = 20;
/** Convergence marks of the census (not quoted in MANIFEST; KENO-20 prints the converged RTP per configuration). */
export const SIM_CONVERGENCE_MARKS: readonly number[] = Object.freeze([10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]);
/** Band tolerance: |observed − expected| ≤ 5σ + 1 on a count (exact binomial false alarm), 5·SE + 1e-4 on an RTP (printed). */
export const EDGE_SIGMAS = 5;
export const EDGE_BUFFER = 1e-4;

// ── Pass 2, cherry-pick: every revealed seed of every shipped dataset (146: Phase A 133, its tail, C, C $10, D)
// × nonces 1..10,000; early window = the epoch's captured nonce range
// (1..50 for a whole epoch, SIM_PASS2_EARLY_WINDOW; 1..28 for the tail), reference window = the rest; each slot replays the bet the capture played at that position of the epoch (its
// risk and its picks; cycled over the window). Statistic, chosen from the paytable (the build notes say before it was
// computed on the live data; no artifact orders the two, MANIFEST DL-4):
// the STANDARDIZED return — each slot's multiplier minus its configuration's exact mean, divided by its exact SD, summed and
// divided by √slots — one-sided lower tail at ALPHA. Keno returns run from SD 0.50 (low, 1 pick) to SD 16.7 (high, 6 picks);
// the raw return sum is dominated by the high-risk tables and detects only a large deficit, so it is printed, not scored.
export const SIM_PASS2_NONCES = 10_000;
export const SIM_PASS2_EARLY_WINDOW = 50;
export const SIM_PASS2_ALPHA = ALPHA;
export const SIM_PASS2_STATISTIC = 'standardized return: Σ (micro − mean)/sd over the slots, ÷ √slots, exact mean and sd per configuration';

/** The fresh-seed server seeds are the sha256 hex of these strings (64 hex chars, the platform's seed shape). */
export const FRESH_SEED_RULE = 'serverSeed = sha256(label) as lowercase hex; clientSeed = label; pick order = xoshiro128**(picks seed), partial Fisher-Yates over 0..39';
