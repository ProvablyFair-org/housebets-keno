// every figure a check compares against that HouseBets publishes is read at verify time from the
// pinned exhibit that carries it, never from a hand copy. KENO-26 checks the exhibit's sha256 first; only then is it read.
// Where a constant stays in src/ (src/spec.ts MIN_STAKE, MAX_STAKE, MAX_WIN, SPEC_VECTORS, PAYOUT_EXAMPLES; the paytable,
// which KENO-13 compares cell for cell with E01 and E07), KENO-26 asserts it equals the exhibit's value and a mismatch is a
// reproduction failure (FAIL, exit 1). The published RTP figures have no hand copy at all: the RTP-CLAIM claim
// (src/rtp-settings.ts) is built from the places below, so a change to a published figure reaches the -19 check and its
// verdict (RTP FIGURE OVERSTATED, exit 5) without any code edit.
import { readJson } from './loader.ts';

export const E01_FILE = 'evidence/E01-keno-fairness-spec-2026-10-12.json';
export const E02_FILE = 'evidence/E02-keno-rules-panel-2026-10-10.json';
export const E03_FILE = 'evidence/E03-keno-limits-2026-10-12.json';
/** The same rules panel in the live copy of the bundle (fetched 19 Oct 2026, last-modified 16 Oct 2026): rulesReturn and
 *  rulesReturnLine were reworded on 16 Oct ("Theoretical RTP is approximately 99% before payout rounding; …"). */
export const E08_FILE = 'evidence/E08-keno-rules-panel-live-2026-10-19.json';

/** A percentage as written in an exhibit ("99", "99.5") → the exact decimal fraction of 1 ("0.99", "0.995"). */
export function pctToFraction(p: string): string {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(p); if (!m) throw new Error(`not a percentage: ${p}`);
  const f = m[2] ?? '', digits = (m[1] + f).replace(/^0+(?=\d)/, ''), scale = f.length + 2;
  const padded = digits.padStart(scale + 1, '0');
  return (padded.slice(0, -scale) + '.' + padded.slice(-scale)).replace(/0+$/, '').replace(/\.$/, '');
}
/** "0.99" or "989/1000" → [numerator, denominator] (exact, bigint). */
export function ratOf(s: string): [bigint, bigint] {
  const f = /^(\d+)\s*\/\s*(\d+)$/.exec(s.trim()); if (f) return [BigInt(f[1]), BigInt(f[2])];
  const d = /^(\d+)(?:\.(\d+))?$/.exec(s.trim()); if (!d) throw new Error(`not an exact decimal or fraction: ${s}`);
  return [BigInt(d[1] + (d[2] ?? '')), 10n ** BigInt((d[2] ?? '').length)];
}
/** Compare two exact figures ("0.99", "76904663103/77681500000"): −1, 0, 1. */
export function cmpFig(a: string, b: string): number { const [x, y] = ratOf(a), [u, v] = ratOf(b); const l = x * v, r = u * y; return l < r ? -1 : l > r ? 1 : 0; }
const maxFig = (xs: string[]) => xs.reduce((a, b) => (cmpFig(a, b) >= 0 ? a : b));

/** One place in the evidence where HouseBets states the keno return for every configuration, with the figure it states. */
export interface RtpPlace { place: 'game settings' | 'rules'; where: string; text: string; rtp: string }

/** Every place in the shipped evidence that states one return figure for every configuration: E01 "return" (the
 *  game settings the site loads), E02 rulesReturn and E02 rulesReturnLine (the rules panel and its paytable line), and the
 *  same two keys reworded in the live copy, E08 rulesReturn and E08 rulesReturnLine. Throws
 *  when a place has lost its figure (KENO-26 reports it as a FAIL). */
export function rtpPlaces(): RtpPlace[] {
  const e1 = readJson(E01_FILE).answer.body, e2 = readJson(E02_FILE).rulesPanelEnglish;
  const ret = String(e1.return ?? ''); const m1 = /^(\d+(?:\.\d+)?)%/.exec(ret);
  if (!m1) throw new Error(`E01 "return" states no percentage: ${JSON.stringify(ret)}`);
  const out: RtpPlace[] = [{ place: 'game settings', where: 'E01 "return" (GET /housegames/keno2/fairness)', text: ret, rtp: pctToFraction(m1[1]) }];
  for (const k of ['rulesReturn', 'rulesReturnLine']) {
    const s = String(e2[k] ?? ''); const m = /returns (\d+(?:\.\d+)?)% to the player/.exec(s);
    if (!m) throw new Error(`E02 ${k} states no percentage: ${JSON.stringify(s)}`);
    out.push({ place: 'rules', where: `E02 ${k} (game page rules panel)`, text: s, rtp: pctToFraction(m[1]) });
  }
  const e8 = readJson(E08_FILE).rulesPanelEnglish ?? {};
  for (const k of ['rulesReturn', 'rulesReturnLine']) {
    const s = String(e8[k] ?? ''); const m = /^Theoretical RTP is approximately (\d+(?:\.\d+)?)% before payout rounding/.exec(s);
    if (!m) throw new Error(`E08 ${k} states no percentage: ${JSON.stringify(s)}`);
    out.push({ place: 'rules', where: `E08 ${k} (game page rules panel, live copy of 19 Oct)`, text: s, rtp: pctToFraction(m[1]) });
  }
  return out;
}

/** E01's own figure for each configuration (paytables[risk][picks − 1].rtp, an exact fraction), keyed "risk, n pick(s)". */
export function rowFigures(): Record<string, string> {
  const t = readJson(E01_FILE).answer.body.paytables as Record<string, { picks: number; rtp: string }[]>; const out: Record<string, string> = {};
  for (const [risk, rows] of Object.entries(t)) for (const r of rows) { ratOf(String(r.rtp)); out[`${risk}, ${r.picks} pick${r.picks > 1 ? 's' : ''}`] = String(r.rtp); }
  return out;
}

/** The figure each configuration is held to: the HIGHEST figure any place states for it — the flat figure every
 *  place above states for all configurations, or E01's own row figure where that is higher. A player reading any of them is
 *  told at least that much; a player-favourable understatement never fails (RTP-CLAIM). */
export function publishedRtp(): { flat: string; agree: boolean; places: RtpPlace[]; rows: Record<string, string>; figures: Record<string, string>; rowsAbove: string[] } {
  const places = rtpPlaces(); const flat = maxFig(places.map((p) => p.rtp)); const rows = rowFigures();
  const figures: Record<string, string> = {}; const rowsAbove: string[] = [];
  for (const [k, v] of Object.entries(rows)) { if (cmpFig(v, flat) > 0) { figures[k] = v; rowsAbove.push(k); } else figures[k] = flat; }
  return { flat, agree: places.every((p) => cmpFig(p.rtp, flat) === 0), places, rows, figures, rowsAbove };
}

/** E01 "return"'s own lower bound ("at least 99/100 − 1e-6"), printed beside the rule's 0.1 pp band; null if not stated. */
export function statedLowerBound(): string | null {
  const m = /at least (\d+)\/(\d+) − (\d+(?:\.\d+)?)e-(\d+)/.exec(String(readJson(E01_FILE).answer.body.return ?? ''));
  return m ? `${m[1]}/${m[2]} − ${m[3]}e-${m[4]}` : null;
}

/** E01's worked examples and settlements as published. */
export function e01Examples(): { examples: any[]; payouts: any[] } { const a = readJson(E01_FILE).answer.body; return { examples: a.examples, payouts: a.payouts }; }

/** E03 wallet limits (the audited wallet, USDT), as the exhibit carries them. */
export function walletLimits(): { minBet: string; maxBet: string; maxWin: string } {
  const w = readJson(E03_FILE).answer.body.wallet; return { minBet: String(w.minBet), maxBet: String(w.maxBet), maxWin: String(w.maxWin) };
}
