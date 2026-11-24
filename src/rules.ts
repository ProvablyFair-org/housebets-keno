// The keno table as HouseBets publishes it (E01 rules and paytables, E02 rules panel), in exact integer units.
//   picks   = 1..10 different tiles of 0..39, plus a risk (classic, low, medium, high)
//   hits    = how many picks are among the ten balls drawn — always from the recomputed draw, never from a served field
//   micro   = PAYTABLE[risk][picks − 1][hits] (multiplier × 1e6)
//   payout  = stake × micro / 10^6 rounded down to the wallet's 1e-8, once (E01 rules[2])
//   chance  = P(k hits | n picks) = C(n,k)·C(40−n,10−k) / C(40,10), hypergeometric on 40 tiles with 10 drawn — exact, BigInt
import { GRID, DRAWN, PICKS_MIN, PICKS_MAX, RISKS, PAYTABLE, MICRO_SCALE, type Risk } from './spec.ts';

/** A decimal number (as JSON gave it) to integer 1e-8 units. Numbers go through toFixed(8), so a capture copy's float noise
 *  cannot leak in; the server's answers carry at most 8 decimals. */
/** a money value as the server wrote it lies on the wallet's 1e-8 grid. A JSON number is read through its shortest
 *  round-trip form (String(x)), so a value with a ninth decimal is seen, not rounded away as toFixed(8) in units8 would. */
export function onGrid8(x: unknown): boolean {
  if (typeof x === 'string') return /^-?\d+(\.\d{1,8})?$/.test(x);
  if (typeof x !== 'number' || !Number.isFinite(x)) return false;
  const m = String(x).match(/^-?\d+(?:\.(\d+))?(?:e([+-]\d+))?$/);
  if (!m) return false;
  return (m[1]?.length ?? 0) - Number(m[2] ?? 0) <= 8;
}

export function units8(x: number | string): bigint {
  const s = typeof x === 'number' ? x.toFixed(8) : String(x);
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`not a decimal: ${s}`);
  const [i, f = ''] = s.replace('-', '').split('.');
  if (f.length > 8 && /[1-9]/.test(f.slice(8))) throw new Error(`more than 8 decimals: ${s}`);
  const v = BigInt(i) * 100000000n + BigInt((f + '00000000').slice(0, 8));
  return s.startsWith('-') ? -v : v;
}

/** A legal pick set: 1..10 different integers in 0..39. */
export const legalPicks = (p: readonly number[]): boolean =>
  Array.isArray(p) && p.length >= PICKS_MIN && p.length <= PICKS_MAX && new Set(p).size === p.length && p.every((x) => Number.isInteger(x) && x >= 0 && x < GRID);
export const isRisk = (r: string): r is Risk => (RISKS as readonly string[]).includes(r);

/** |picks ∩ balls|. */
export const hitsOf = (picks: readonly number[], balls: readonly number[]): number => picks.filter((p) => balls.includes(p)).length;

/** The paytable cell for (risk, number of picks, hits), in micro-multipliers. */
export function microOf(risk: Risk, picks: number, hits: number): number {
  const row = PAYTABLE[risk][picks - 1]; if (!row || hits < 0 || hits >= row.length) throw new Error(`no cell ${risk}/${picks}/${hits}`);
  return row[hits];
}

/** payout in 1e-8 units: floor(stake8 × micro / 10^6). */
export const payout8 = (stake8: bigint, micro: number): bigint => (stake8 * BigInt(micro)) / BigInt(MICRO_SCALE);

// ── exact hypergeometric
const C = (n: number, k: number): bigint => { if (k < 0 || k > n) return 0n; let r = 1n; for (let i = 0; i < k; i++) r = (r * BigInt(n - i)) / BigInt(i + 1); return r; };
export const choose = C;
/** The common denominator of every hit chance: C(40, 10) = 847,660,528. */
export const D = C(GRID, DRAWN);
/** P(k hits | n picks) × D, an integer: C(n,k)·C(40−n,10−k). */
export const hitWeight = (n: number, k: number): bigint => C(n, k) * C(GRID - n, DRAWN - k);
/** The same chance by the other counting, C(10,k)·C(30,n−k)/C(40,n), as an exact fraction [num, den] (KENO-18 cross-check). */
export const hitChanceAlt = (n: number, k: number): [bigint, bigint] => [C(DRAWN, k) * C(GRID - DRAWN, n - k), C(GRID, n)];

/** A configuration's exact first two moments of the return, in micro units: meanD = D·E[micro], varD2 = D²·Var[micro]. */
export function moments(risk: Risk, n: number): { meanD: bigint; varD2: bigint } {
  let s = 0n, s2 = 0n;
  for (let k = 0; k <= n; k++) { const w = hitWeight(n, k), m = BigInt(microOf(risk, n, k)); s += w * m; s2 += w * m * m; }
  return { meanD: s, varD2: D * s2 - s * s };
}

/** The 40 configurations, "risk/picks", in table order. */
export const CONFIGS: readonly string[] = RISKS.flatMap((r) => Array.from({ length: PICKS_MAX }, (_, i) => `${r}/${i + 1}`));
export const configOf = (risk: string, picks: number): string => `${risk}/${picks}`;
