// The game as HouseBets publishes it — the only source of every declared number this package holds the data to.
//   E01  GET /housegames/keno2/fairness, answered to the capture 12 Oct 2026 17:07:28Z (RNG, tiles, rules, the 40
//        paytables in micro-multipliers with their exact RTP, hit chances, 4 draw examples, 8 payout examples)
//   E02  the keno game page's rules panel (English), in the bundle the live page loads
//        (bundles/platform-housegames-keno2-game.js, sha256 7afa2e0b…, checked on the live page 10 Oct 2026)
//   E03  GET /housegames/limits/keno2 (min/max bet, max win, wallet decimals)
//   E07  the same bundle's own paytable (Af) and auto-pick code
// Nothing here is read from the captured bets. A number that is not in E01-E03 / E07 is not declared.

/** E01 tiles: "Numbers are the tiles 0 to 39 … shown as 1 to 40"; rules[1]: "ten different numbers are drawn". */
export const GRID = 40;
export const DRAWN = 10;
/** E01 rules[0]: "pick 1 to 10 numbers and a risk (classic, low, medium or high)". */
export const PICKS_MIN = 1;
export const PICKS_MAX = 10;
export const RISKS = ['classic', 'low', 'medium', 'high'] as const;
export type Risk = (typeof RISKS)[number];

/** E01 "paytables": micro-multipliers (× 1e6), [risk][picks − 1][hits]. Multiplier = micro / 10^6. */
export const MICRO_SCALE = 1_000_000;
export const PAYTABLE: Readonly<Record<Risk, readonly (readonly number[])[]>> = {
  classic: [[0, 3960000],
    [0, 1899000, 4500000],
    [0, 999586, 3100000, 10400000],
    [0, 800000, 1800000, 5000000, 22671904],
    [0, 250000, 1400000, 4100003, 16500000, 36370000],
    [0, 0, 1001042, 3680000, 7000000, 16500000, 40000000],
    [0, 0, 470536, 3000000, 4500000, 14000000, 31000000, 60000000],
    [0, 0, 0, 2198973, 4000000, 13000000, 22000000, 55000000, 70000000],
    [0, 0, 0, 1550946, 3000000, 8000000, 15000000, 44000000, 60000000, 85000000],
    [0, 0, 0, 1398703, 2250000, 4500000, 8000000, 17000000, 50000000, 80000000, 100000000]],
  low: [[700000, 1860000],
    [0, 2000001, 3826660],
    [0, 1100000, 1380000, 26110000],
    [0, 0, 2199984, 7900000, 90340000],
    [0, 0, 1500000, 4200006, 13000000, 302530000],
    [0, 0, 1099739, 2000000, 6200000, 100000000, 700000000],
    [0, 0, 1101780, 1600000, 3500000, 15000000, 225000000, 700000000],
    [0, 0, 1099879, 1500000, 2000000, 5500000, 39000000, 100000000, 800000000],
    [0, 0, 1097944, 1300000, 1700000, 2500000, 7500000, 50000000, 250000000, 1000000000],
    [0, 0, 1107732, 1200000, 1300000, 1800000, 3500000, 13000000, 50000000, 250000000, 1000000000]],
  medium: [[400000, 2760000],
    [0, 1800000, 5160000],
    [0, 0, 2800000, 50010000],
    [0, 0, 1700000, 9999750, 100950000],
    [0, 0, 1400000, 4000000, 14000000, 391460000],
    [0, 0, 0, 3000000, 9000000, 180000000, 740220000],
    [0, 0, 0, 2000000, 7000000, 30000000, 400000000, 859370000],
    [0, 0, 0, 2003434, 4000000, 11000000, 67000000, 400000000, 900000000],
    [0, 0, 0, 2002225, 2500000, 5000000, 15000000, 100000000, 500000000, 1000000000],
    [0, 0, 0, 1600891, 2000000, 4000000, 7000000, 26000000, 100000000, 500000000, 1000000000]],
  high: [[0, 3960000],
    [0, 0, 17160000],
    [0, 0, 0, 81510000],
    [0, 0, 0, 10000000, 259410000],
    [0, 0, 0, 4499993, 48000000, 452890000],
    [0, 0, 0, 0, 10793609, 350000000, 800000000],
    [0, 0, 0, 0, 7200000, 88290498, 400000000, 1000000000],
    [0, 0, 0, 0, 5003386, 20000000, 270000000, 600000000, 1200000000],
    [0, 0, 0, 0, 4003080, 11000000, 56000000, 500000000, 800000000, 1500000000],
    [0, 0, 0, 0, 3499426, 8000000, 13000000, 63000000, 500000000, 800000000, 2000000000]],
};

// The published return has no constant here: src/exhibits.ts reads E01 "return", its row
// figures, E02 (and E08) rulesReturn and rulesReturnLine at run time and src/rtp-settings.ts builds the RTP-CLAIM claim from them.

/** E01 rules, verbatim. */
export const RULES_TEXT = [
  'pick 1 to 10 numbers and a risk (classic, low, medium or high) before the bet; the ten numbers drawn are fixed by the seed pair and the nonce at the bet',
  'ten different numbers are drawn; the bet pays by how many of the picks are among them, from the paytable of the risk and the number of picks',
  'a payout is the stake × the multiplier, rounded down to the wallet\'s smallest unit (1e-8) once',
  'a stake whose top prize (every pick drawn) would pay more than the max win above it is refused before the draw',
  'the round settles in the request that places it: there is no round to leave open',
] as const;

/** E03 wallet: the platform minimum and maximum stake in the audited wallet (USDT), the max win, decimals. KENO-26 asserts at
 *  run time that MIN_STAKE, MAX_STAKE and MAX_WIN equal E03. */
export const MIN_STAKE = '0.01000311';
export const MAX_STAKE = '20006.20192259';
export const MAX_WIN = '1000310.0961298';
export const WALLET_DECIMALS = 8;

/** E01 "examples": the published worked draws (balls in draw order, tiles 0..39). */
export const SPEC_VECTORS = [
  { serverSeed: 'housebets-demo-server-seed-0001', clientSeed: 'demo-client', nonce: 1, balls: [28, 7, 15, 11, 22, 3, 8, 38, 0, 34] },
  { serverSeed: 'housebets-demo-server-seed-0001', clientSeed: 'demo-client', nonce: 2, balls: [32, 34, 38, 36, 15, 25, 13, 2, 35, 20] },
  { serverSeed: '5a1f7d2c9e4b8a3f6d0c2b5e8f1a4d7c0b3e6f9a2d5c8b1e4f7a0d3c6b9e2f5a', clientSeed: 'housebets', nonce: 1, balls: [25, 10, 8, 18, 22, 28, 23, 37, 27, 38] },
  { serverSeed: '5a1f7d2c9e4b8a3f6d0c2b5e8f1a4d7c0b3e6f9a2d5c8b1e4f7a0d3c6b9e2f5a', clientSeed: 'housebets', nonce: 7, balls: [38, 32, 6, 15, 18, 9, 31, 13, 39, 1] },
] as const;

/** E01 "payouts": published settlements of a stake of 1. */
export const PAYOUT_EXAMPLES = [
  { risk: 'classic', picks: 1, hits: 1, multiplier: 3.96, payout: 3.96 },
  { risk: 'classic', picks: 3, hits: 1, multiplier: 0.999586, payout: 0.999586 },
  { risk: 'classic', picks: 10, hits: 10, multiplier: 100, payout: 100 },
  { risk: 'low', picks: 1, hits: 0, multiplier: 0.7, payout: 0.7 },
  { risk: 'low', picks: 10, hits: 2, multiplier: 1.107732, payout: 1.107732 },
  { risk: 'medium', picks: 5, hits: 5, multiplier: 391.46, payout: 391.46 },
  { risk: 'high', picks: 10, hits: 10, multiplier: 2000, payout: 2000 },
  { risk: 'high', picks: 4, hits: 3, multiplier: 10, payout: 10 },
] as const;

/** The commitment encoding: the capture's commitments are sha256 of the server seed's UTF-8 text (KENO-01). */
export const COMMITMENT_ENCODING = 'sha256(utf8(serverSeed)) as lowercase hex';
