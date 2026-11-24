// HouseBets House Games keno (keno2, new engine, fairness version "canonical") — verification suite: the 32 checks of the
// KENO profile (profile/profile.json, a byte copy of the framework's games/keno/profile.json 1.0.2, Framework 1.1, its sha256
// checked at run time; src/profile-map.ts, generated from it, must carry the same rows). Run: npm run verify (Node 22,
// no install). A step that throws is scored FAIL and the run goes on; an exception outside every step still prints every row, exit 1.
// Status by policy: HARD_FAIL → PASS | FAIL; FLAG → PASS | FLAG (origin operator or capture); INFORMATIONAL → INFO;
// GRADED / RELEASE_GATE (package checks) → PASS | GAP, reported, not in the verdict — except a release-gate record
// (outputs/fresh-copy.json, outputs/mutation-results.json) that is missing or not the bytes RELEASE-MANIFEST.json pins: FAIL,
// and the verdict is NOT PROVABLY FAIR. A step that throws is scored FAIL, never skipped (step(), below).
// Verdict, ranked as RTP-CLAIM 1.2.0's rtpClaimVerdict: any FAIL → NOT PROVABLY FAIR (exit 1) > a scored check with no status
// from this run → INCOMPLETE (exit 3; never a pass) > KENO-19 OVERSTATED → RTP FIGURE OVERSTATED (exit 5,
// Methodology v1.1) > an operator-origin FLAG → Conditional Pass (exit 2) > Full Pass (exit 0). A stale verify.js → exit 4, no verdict.
// A capture-origin FLAG is disclosed with a limitation row and is verdict-neutral (policy decided 2026-09-17).
// verify writes only outputs/run/ and never rewrites a pinned artifact.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, load, sha256File, sha256Bytes, readJson, PRIMARY_FILE, PRIMARY_SHA256, TAIL_FILE, TAIL_SHA256, AS_CAPTURED_FILE,
  AS_CAPTURED_SHA256, PHASE_C_FILE, PHASE_C_SHA256, PHASE_C10_FILE, PHASE_C10_SHA256, PHASE_D_FILE, PHASE_D_SHA256, EVIDENCE_PINS,
  EXPECTED_BETS, EXPECTED_SEEDS, EXPECTED_EPOCHS, EXPECTED_EPOCH_SIZE, EXPECTED_TAIL_BETS, EXPECTED_PHASE_C_BETS, EXPECTED_PHASE_C10_BETS,
  EXPECTED_PHASE_D_BETS, PHASE_C_RISK, PHASE_C_PICKS, PHASE_C_STAKE, PHASE_C10_STAKE, PHASE_D_SEEDS, NONCE_BASE, COVERAGE_FLOOR,
  PLAN_CLASSES, PILOT_FILE, PASS2_SETS, EXPECTED_REVEALED_SEEDS } from '../src/loader.ts';
import { ballsOf, indexFromU, sha256Hex } from '../src/rng.ts';
import * as RNG from '../src/rng.ts';
import { units8, onGrid8, legalPicks, isRisk, hitsOf, microOf, payout8, D, hitWeight, hitChanceAlt, moments, CONFIGS, configOf, choose } from '../src/rules.ts';
import { GRID, DRAWN, PICKS_MAX, RISKS, PAYTABLE, MICRO_SCALE, MIN_STAKE, MAX_STAKE, MAX_WIN, SPEC_VECTORS, PAYOUT_EXAMPLES, type Risk } from '../src/spec.ts';
import { PROFILE, PROFILE_SHA256, PROFILE_VERSION, type Policy, type ProfileCheck } from '../src/profile-map.ts';
import { publishedRtp, walletLimits, e01Examples, statedLowerBound, ratOf } from '../src/exhibits.ts';
import { codeFingerprint } from '../scripts/fingerprint.mjs';
import { splitWholeEpochs } from '../src/split.ts';
import { census, censusText, type Census } from '../src/simulate.ts';
import { SIM_ROUNDS, FLOOR_ROUNDS_PER_CONFIG, FLOOR_PASS2_NONCES, ALPHA_SCREEN, EDGE_SIGMAS, EDGE_BUFFER, SIM_PASS2_NONCES,
  SIM_PASS2_EARLY_WINDOW, SIM_PASS2_ALPHA, RUNS_HIGH_FROM, pass1Seed } from '../src/sim-config.ts';
import { chiSquaredPValue, runsStatisticFromCounts, twoSidedNormalP, normalLowerTailP, normalQuantile, lagOneAutocorrelation,
  waldsWolfowitzRunsTest } from '../src/stats.ts';
import { binomialOutside, serialScreensFalseAlarm, FAIL_FALSE_ALARM_CAP, fmtRate } from '../src/false-alarm.ts';
import { tileChi2, TILE_CHI2_FACTOR, TILE_FALSE_ALARM } from '../src/false-alarm-tiles.ts';
import { PASS2_FALSE_ALARM } from '../src/false-alarm-pass2.ts';
import { computeRtpClaim, runRtpClaimGate, configRtp } from '../src/rtp-settings.ts';
import { RTP_CLAIM_RULE_ENFORCED, rtpClaimVerdict } from '../src/rtp-claim';
import { ARTIFACT_PINS, AUDIT_ID, SITE_VERIFIER_PIN } from '../src/artifact-pins.ts';
import { loadSiteModule, replay, exportNames, type Probe } from '../src/site-verifier.ts';
import { fieldDiff, beyondTolerance } from '../src/diff.ts';
import type { Dataset, Bet } from '../src/types.ts';

const P = 'KENO';
type Status = 'PASS' | 'FAIL' | 'FLAG' | 'INFO' | 'GAP' | 'ABSENT' | 'OVERSTATED';
interface Row { id: string; name: string; policy: Policy; status: Status; origin?: 'operator' | 'capture'; detail: string }
const rows: Row[] = [];
// ═══ A step that throws is scored, never skipped ═══
// Every check below runs inside step(). An exception in a step (a file missing, a dataset field null or absent) marks the
// check(s) that step scores FAIL, with the error in the detail, and the next step still runs. A shared input that cannot be
// computed (input()) becomes a value that throws on first use and names itself, so every step that reads it fails on its own
// row. Any such error makes the verdict NOT PROVABLY FAIR (exit 1). An exception outside every step still prints every row,
// each check it left unscored as FAIL, and exits 1.
const RUN_ERRORS: string[] = [];
const TAINT = new Map<string, string>();
const errText = (e: unknown): string => { const x = e as { code?: string; name?: string; message?: string } | null; return `${x?.code ?? x?.name ?? 'Error'}: ${String(x?.message ?? e).split('\n')[0]}`; };
function step(ids: string[], fn: () => void): void {
  try { fn(); } catch (e) {
    const why = errText(e); RUN_ERRORS.push(`${ids.join(', ') || 'a shared computation'}: ${why}`);
    for (const id of ids) if (!TAINT.has(id)) TAINT.set(id, why);
  }
}
function input<T>(name: string, fn: () => T, ...fallback: [T?]): T {
  try { return fn(); } catch (e) {
    const why = errText(e); RUN_ERRORS.push(`input ${name}: ${why}`);
    // a boolean condition that cannot be computed is false (it fails the check it feeds); any other input is poisoned
    if (fallback.length) return fallback[0] as T;
    const poison = (): never => { throw new Error(`input ${name} could not be computed (${why})`); };
    return new Proxy(function () {}, { get: poison, apply: poison, construct: poison, has: poison, ownKeys: poison, getOwnPropertyDescriptor: poison }) as unknown as T;
  }
}
function failRow(id: string, detail: string): void {
  const r = rows.find((x) => x.id === id);
  if (r) { const was = `${r.status}: ${r.detail}`; r.status = 'FAIL'; delete r.origin; r.detail = `${detail} (recorded before the error: ${was})`; }
  else { const p = prof(id); rows.push({ id, name: p.name, policy: p.policy, status: 'FAIL', detail }); }
}
/** Called first in finish(): every check whose step threw becomes FAIL. */
function applyTaint(): void {
  for (const [id, why] of TAINT) failRow(id, `NOT SCORED, the step threw ${why} (an input it reads is missing or malformed); scored FAIL, never skipped`);
  TAINT.clear();
}
/** A release-gate record (outputs/fresh-copy.json, outputs/mutation-results.json) that is missing, not pinned, or not the
 *  bytes RELEASE-MANIFEST.json pins for it: its check is FAIL, and the verdict fails (extraFails). A record that matches its
 *  pin but reports a shortfall stays a GAP. */
function pinFail(id: string, why: string): void {
  const d = `FAIL: the release-gate record is not the one RELEASE-MANIFEST.json pins (${why}); a deleted or edited record fails the verdict`;
  const r = rows.find((x) => x.id === id);
  if (r) { r.status = 'FAIL'; delete r.origin; r.detail = `${d}; ${r.detail}`; }
  else { const p = prof(id); rows.push({ id, name: p.name, policy: p.policy, status: 'FAIL', detail: d }); }
}
/** Verdict-bearing failures outside the scored HARD_FAIL / FLAG rows: a FAIL on a package check (a release-gate record that
 *  is missing or differs from its RELEASE-MANIFEST.json pin) and any run error. */
const extraFails = (): number => rows.filter((r) => r.status === 'FAIL' && r.policy !== 'HARD_FAIL' && r.policy !== 'FLAG').length + RUN_ERRORS.length;
process.on('uncaughtException', (e) => {
  try {
    const why = errText(e); RUN_ERRORS.push(`the run stopped outside any step: ${why}`);
    for (const c of PROFILE) if (!rows.some((r) => r.id === c.id) && !TAINT.has(c.id)) TAINT.set(c.id, `${why}; the run stopped before this check`);
    finish();
  } catch (e2) { console.log(`VERDICT: NOT PROVABLY FAIR — the verifier stopped: ${errText(e)}; ${errText(e2)}`); }
  process.exit(1);
});
// ═══ The step list is bound to the framework profile the MANIFEST cites ═══
// profile/profile.json is a byte copy of the framework's games/keno/profile.json; its sha256 must equal PROFILE_SHA256 (the
// hash MANIFEST.md and RELEASE-MANIFEST.json cite). The scored check list and every check's policy are taken from THAT file,
// and src/profile-map.ts must carry the same rows (id, name, layer, kind, policy). A missing or altered profile file, a row
// missing from src/profile-map.ts or one relabelled there → INCOMPLETE (exit 3), never a pass; a relabelled step still runs
// under the profile's own policy, so forged data behind it still FAILs.
const PROFILE_FILE = 'profile/profile.json';
const binding = (() => {
  const issues: string[] = []; let sha: string | null = null; let checks: ProfileCheck[] | null = null; let version: string | null = null;
  try {
    const raw = readFileSync(join(ROOT, PROFILE_FILE)); sha = sha256Bytes(raw); const j = JSON.parse(raw.toString('utf8')); version = String(j.profileVersion);
    checks = j.checks.map((c: any) => ({ id: c.id, name: c.name, layer: c.layer, kind: c.kind, policy: c.policy }));
  } catch (e) { issues.push(`${PROFILE_FILE} unreadable (${(e as Error).message.split('\n')[0]})`); }
  if (sha !== null && sha !== PROFILE_SHA256) issues.push(`${PROFILE_FILE} sha256 ${sha.slice(0, 12)}… is not the cited profile ${PROFILE_SHA256.slice(0, 12)}…`);
  if (version !== null && version !== PROFILE_VERSION) issues.push(`profile version ${version} is not the cited ${PROFILE_VERSION}`);
  if (checks) {
    for (const c of checks) { const l = PROFILE.find((x) => x.id === c.id);
      if (!l) issues.push(`${c.id} missing from src/profile-map.ts`);
      else if (l.policy !== c.policy || l.name !== c.name || l.kind !== c.kind || l.layer !== c.layer) issues.push(`${c.id} relabelled in src/profile-map.ts (${l.policy}, profile ${c.policy})`); }
    for (const l of PROFILE) if (!checks.some((c) => c.id === l.id)) issues.push(`${l.id} in src/profile-map.ts is not in the profile`);
  }
  return { ok: issues.length === 0, issues, sha, checks: checks ?? PROFILE };
})();
const prof = (id: string) => { const p = binding.checks.find((c) => c.id === id); if (!p) throw new Error(`no profile check ${id}`); return p; };
/** Record a check by its profile policy. `ok` false → FAIL / FLAG / GAP; INFORMATIONAL is always INFO. */
function record(n: number, ok: boolean, detail: string, origin: 'operator' | 'capture' = 'operator') {
  const id = `${P}-${String(n).padStart(2, '0')}`; const p = prof(id); let status: Status;
  if (p.policy === 'INFORMATIONAL') status = 'INFO';
  else if (p.policy === 'HARD_FAIL') status = ok ? 'PASS' : 'FAIL';
  else if (p.policy === 'FLAG') status = ok ? 'PASS' : 'FLAG';
  else status = ok ? 'PASS' : 'GAP';
  rows.push({ id, name: p.name, policy: p.policy, status, ...(status === 'FLAG' ? { origin } : {}), detail });
}
/** RTP-CLAIM 1.2.0 (Methodology v1.1; src/rtp-claim-switch.ts ON): the -19 status. `ok` carries the step's own
 *  conditions besides the rule (the exact derivation, the claim read from the exhibits): if one fails, the profile's policy
 *  applies as before. With those clean the rule decides: PASS, or OVERSTATED for a house-side miss of the published figure
 *  (verdict RTP FIGURE OVERSTATED, exit 5 — never NOT PROVABLY FAIR, the draws are checked by the other steps). A committed
 *  RTP table that does not equal this run's is a reproduction failure: FAIL, whatever the rule says. */
function recordRtpClaim(n: number, ok: boolean, gate: { status: 'INFO' | 'PASS' | 'OVERSTATED' | 'FAIL'; tableMatches: boolean }, detail: string) {
  const id = `${P}-${String(n).padStart(2, '0')}`; const p = prof(id);
  if (!gate.tableMatches || gate.status === 'FAIL') { rows.push({ id, name: p.name, policy: p.policy, status: 'FAIL', detail }); return; }
  // an RTP miss is decided by the rule alone — OVERSTATED wins over every other condition of the step
  if (gate.status === 'OVERSTATED') { rows.push({ id, name: p.name, policy: p.policy, status: 'OVERSTATED', detail }); return; }
  if (!ok) { record(n, false, detail); return; }
  rows.push({ id, name: p.name, policy: p.policy, status: gate.status, detail });
}
/** A HARD_FAIL / FLAG check whose only shortfall is an auditor-side capture gap: a capture-origin FLAG (verdict-neutral). */
const captureFlag = (n: number, detail: string) => { const id = `${P}-${String(n).padStart(2, '0')}`; const p = prof(id); rows.push({ id, name: p.name, policy: p.policy, status: 'FLAG', origin: 'capture', detail }); };
const pct = (a: number, b: number) => `${a}/${b}`;
/** The verdict is bound to the profile's scored check list. Every HARD_FAIL / FLAG id of the profile must have a status from
 *  THIS run, recorded exactly once; an id with none (step deleted, skipped or aborted) is printed as ABSENT and the verdict is
 *  INCOMPLETE (exit 3; exit 4 is verify.js's staleness guard), never "PROVABLY FAIR". A FAIL still wins: a run with a FAIL is NOT PROVABLY FAIR, absent ids listed. */
const SCORED_IDS = binding.checks.filter((c) => c.policy === 'HARD_FAIL' || c.policy === 'FLAG').map((c) => c.id);   // profile/profile.json
function bindToProfile() {
  for (const id of SCORED_IDS) if (!rows.some((r) => r.id === id)) rows.push({ id, name: prof(id).name, policy: prof(id).policy, status: 'ABSENT', detail: 'no status from this run (step deleted, skipped or aborted)' });
  const dup = rows.map((r) => r.id).filter((id, i, a) => a.indexOf(id) !== i);
  for (const id of new Set(dup)) rows.push({ id, name: prof(id).name, policy: prof(id).policy, status: 'ABSENT', detail: `recorded ${dup.filter((x) => x === id).length + 1} times in one run` });
}
/** RTP-CLAIM 1.2.0 ranking (rtpClaimVerdict): NOT PROVABLY FAIR (1) > INCOMPLETE (3) > RTP FIGURE OVERSTATED (5) > Conditional (2) > Full (0). */
const verdictExit = (rs: Row[], extra = 0) => {   // extra: verdict-bearing failures outside the scored rows (extraFails())
  const sc = rs.filter((r) => r.policy === 'HARD_FAIL' || r.policy === 'FLAG');
  return rtpClaimVerdict({ fails: sc.filter((r) => r.status === 'FAIL').length + extra, complete: !sc.some((r) => r.status === 'ABSENT') && binding.ok,
    overstated: sc.some((r) => r.status === 'OVERSTATED'), opFlags: sc.filter((r) => r.status === 'FLAG' && r.origin === 'operator').length });
};
const verdictOf = (rs: Row[]) => verdictExit(rs).verdict;
const t0 = Date.now();

// ═══ -26 dataset & config pins — before anything reads the data ═══
const dataPins: [string, string][] = [[PRIMARY_FILE, PRIMARY_SHA256], [TAIL_FILE, TAIL_SHA256], [AS_CAPTURED_FILE, AS_CAPTURED_SHA256],
  [PHASE_C_FILE, PHASE_C_SHA256], [PHASE_C10_FILE, PHASE_C10_SHA256], [PHASE_D_FILE, PHASE_D_SHA256]];
const pinBad = [...dataPins, ...EVIDENCE_PINS].filter(([f, h]) => sha256File(f) !== h);
if (pinBad.length) { record(26, false, `mismatch: ${pinBad.map(([f]) => f).join(', ')} — abort before any step`); finish(); process.exit(1); }
// the exhibits are pin-checked; now every constant that stays in src/ must equal the exhibit's value,
// and the published return must parse from every place that states it. A mismatch is a reproduction failure (FAIL, exit 1).
// The paytable itself is compared cell for cell with E01 and E07 by -13.
let PUB: ReturnType<typeof publishedRtp> | null = null;
step(['KENO-26'], () => {
  const bad: string[] = [];
  try { PUB = publishedRtp(); } catch (e) { bad.push((e as Error).message); }
  try { const lim = walletLimits();
    if (units8(MIN_STAKE) !== units8(lim.minBet)) bad.push(`src/spec.ts MIN_STAKE ${MIN_STAKE} ≠ E03 wallet.minBet ${lim.minBet}`);
    if (units8(MAX_STAKE) !== units8(lim.maxBet)) bad.push(`src/spec.ts MAX_STAKE ${MAX_STAKE} ≠ E03 wallet.maxBet ${lim.maxBet}`);
    if (units8(MAX_WIN) !== units8(lim.maxWin)) bad.push(`src/spec.ts MAX_WIN ${MAX_WIN} ≠ E03 wallet.maxWin ${lim.maxWin}`);
  } catch (e) { bad.push(`E03 wallet limits unreadable (${(e as Error).message})`); }
  const ex = e01Examples(); const J = JSON.stringify;
  if (J((ex.examples ?? []).map((x: any) => [x.serverSeed, x.clientSeed, x.nonce, x.balls])) !== J(SPEC_VECTORS.map((x) => [x.serverSeed, x.clientSeed, x.nonce, x.balls]))) bad.push('src/spec.ts SPEC_VECTORS ≠ E01 "examples"');
  if (J(ex.payouts) !== J(PAYOUT_EXAMPLES)) bad.push('src/spec.ts PAYOUT_EXAMPLES ≠ E01 "payouts"');
  // E01 and E03 are cut from the answers the as-captured file recorded before its first bet (meta.preflight). The
  // comparison is printed, not scored: scoring it would make an exhibit-only change of a published figure end NOT PROVABLY FAIR
  // instead of the rule's RTP FIGURE OVERSTATED ( test); the exhibits' own pins are scored above
  const pre = (JSON.parse(readFileSync(join(ROOT, 'data', AS_CAPTURED_FILE), 'utf8')).meta ?? {}).preflight ?? {};
  const e01Same = J(readJson('evidence/E01-keno-fairness-spec-2026-10-12.json').answer) === J(pre.fairness), e03Same = J(readJson('evidence/E03-keno-limits-2026-10-12.json').answer) === J(pre.limits);
  record(26, bad.length === 0, `${dataPins.length} datasets + ${EVIDENCE_PINS.length} evidence exhibits match their sha256 pinned in src/loader.ts; the figures checks compare against, read from the exhibits: MIN_STAKE ${MIN_STAKE}, MAX_STAKE ${MAX_STAKE} and MAX_WIN ${MAX_WIN} == E03 wallet minBet, maxBet, maxWin; SPEC_VECTORS and PAYOUT_EXAMPLES == E01; printed, not scored: E01 and E03 == the as-captured file's meta.preflight (fairness ${e01Same}, limits ${e03Same}); the published return parses from ${PUB ? PUB.places.map((p) => `${p.where} (${p.rtp})`).join(', ') + ` and E01's ${Object.keys(PUB.rows).length} row figures` : 'NO place'}: ${bad.length === 0}${bad.length ? ' — ' + bad.join('; ') : ''}`);
  if (!PUB) { finish(); process.exit(1); }
});

const ds = input('ds', () => (load(PRIMARY_FILE))), tail = input('tail', () => (load(TAIL_FILE))), pC = input('pC', () => (load(PHASE_C_FILE))), pC10 = input('pC10', () => (load(PHASE_C10_FILE))), pD = input('pD', () => (load(PHASE_D_FILE)));
const asText = input('asText', () => (readFileSync(join(ROOT, 'data', AS_CAPTURED_FILE), 'utf8')));
const asCaptured = input('asCaptured', () => (JSON.parse(asText) as Dataset & { meta: any }));
const E01 = input('E01', () => (readJson('evidence/E01-keno-fairness-spec-2026-10-12.json').answer.body));
const E02 = input('E02', () => (readJson('evidence/E02-keno-rules-panel-2026-10-10.json').rulesPanelEnglish));
const E07 = input('E07', () => (readJson('evidence/E07-keno-bundle-paytable-autopick-2026-10-10.json')));
const seedOf = (d: Dataset, e: number) => d.seeds.find((s) => Number(s.epoch) === e);
const ALL = input('ALL', () => ([ds, tail, pC, pC10, pD]));
/** Pass 2's population: every revealed seed of every shipped dataset, labelled as src/loader.ts PASS2_SETS labels them. */
const P2SETS: [string, Dataset][] = input('P2SETS', () => (PASS2_SETS.map(([s]) => [s, ({ A: ds, tail, C: pC, C10: pC10, D: pD } as Record<string, Dataset>)[s]])));
const P2BETS = input('P2BETS', () => (P2SETS.flatMap(([, d]) => d.bets)));
const same = (a: readonly number[], b: readonly number[] | undefined) => !!b && a.length === b.length && a.every((x, i) => x === b[i]);
const wordOf = (micro: number) => (micro === 0 ? 'lose' : micro < MICRO_SCALE ? 'partial' : 'win');

/** The per-round recompute core, shared by every dataset: balls, structure, picks, hits, cell, payout, copies. */
function recompute(d: Dataset) {
  const c = { n: 0, seedLink: 0, balls: 0, servedShape: 0, picks: 0, echo: 0, hits: 0, micro: 0, mult: 0, word: 0, payout: 0, stake: 0, copies: 0,
    paying: 0, bad: [] as string[] };
  for (const b of d.bets) {
    c.n++;
    const s = seedOf(d, b.epoch);
    if (!s) { c.bad.push(`bet ${b.idx}: no seed for epoch ${b.epoch}`); continue; }
    if (b.respClientSeed === s.clientSeed && b.respHashedSeed === s.hashedServerSeed) c.seedLink++; else c.bad.push(`bet ${b.idx}: answer seeds differ from epoch ${b.epoch}`);
    const g = b._raw?.game, r = b._raw?.round;
    const balls = ballsOf(s.revealedServerSeed, s.clientSeed, b.nonce);
    if (same(balls, b.outcome) && same(balls, g?.balls)) c.balls++; else c.bad.push(`bet ${b.idx}: balls ${JSON.stringify(b.outcome)} want ${JSON.stringify(balls)}`);
    // the served record's own structure, independent of the recomputation
    const sb = g?.balls ?? [];
    if (sb.length === DRAWN && new Set(sb).size === DRAWN && sb.every((x) => Number.isInteger(x) && x >= 0 && x < GRID)) c.servedShape++; else c.bad.push(`bet ${b.idx}: served balls not 10 different tiles of 0..39`);
    const picks = b.request.spots, risk = b.request.risk;
    const picksOk = legalPicks(picks) && isRisk(risk);
    if (picksOk) c.picks++; else { c.bad.push(`bet ${b.idx}: illegal picks/risk ${JSON.stringify(picks)} ${risk}`); continue; }
    if (same([...picks].sort((x, y) => x - y), [...(b.echoedSpots ?? [])].sort((x, y) => x - y)) && same([...picks].sort((x, y) => x - y), [...(g?.spots ?? [])].sort((x, y) => x - y))
      && b.echoedRisk === risk && g?.risk === risk) c.echo++; else c.bad.push(`bet ${b.idx}: answer does not echo the picks and risk sent`);
    const h = hitsOf(picks, balls);
    if (b.hits === h && g?.hits === h) c.hits++; else c.bad.push(`bet ${b.idx}: hits ${b.hits}/${g?.hits} want ${h}`);
    const m = microOf(risk as Risk, picks.length, h);
    if (b.micro === m && g?.micro === m) c.micro++; else c.bad.push(`bet ${b.idx}: micro ${b.micro} want ${m}`);
    if (Math.abs(b.payoutMultiplier - m / MICRO_SCALE) <= 1e-12 && Math.abs((g?.multiplier ?? -1) - m / MICRO_SCALE) <= 1e-12) c.mult++; else c.bad.push(`bet ${b.idx}: multiplier ${b.payoutMultiplier}`);
    if (g?.outcome === wordOf(m)) c.word++;
    const st8 = units8(b.request.amount);
    if (units8(b.stake) === st8 && units8(b.gameStake) === st8 && units8(g?.stake ?? -1) === st8 && units8(r?.stake ?? -1) === st8 && units8(b.roundStake) === st8) c.stake++; else c.bad.push(`bet ${b.idx}: stake copies differ`);
    const want = payout8(st8, m);
    if (units8(b.payout) === want && units8(g?.payout ?? -1) === want && units8(r?.payout ?? -1) === want) c.payout++; else c.bad.push(`bet ${b.idx}: payout ${b.payout} want ${want}e-8`);
    if (want > 0n) c.paying++;
    if (r && r.roundId === b.roundId && g?.roundId === b.roundId && units8(b.roundPayout) === units8(r.payout)) c.copies++; else c.bad.push(`bet ${b.idx}: copy != server round`);
  }
  return c;
}

// ═══ -05 population & epoch size (G-BIND) + the split re-run from the as-captured file ═══
step(['KENO-05'], () => {
  const perEpoch = new Map<number, number>();
  for (const b of ds.bets) perEpoch.set(b.epoch, (perEpoch.get(b.epoch) || 0) + 1);
  const sizesOk = [...perEpoch.values()].every((n) => n === EXPECTED_EPOCH_SIZE);
  let splitOk = false, splitDetail = '';
  try {
    const r = splitWholeEpochs(asText, AS_CAPTURED_FILE.split('/').pop()!, 'keno');
    splitOk = r.primaryText === readFileSync(join(ROOT, 'data', PRIMARY_FILE), 'utf8') && r.tailText === readFileSync(join(ROOT, 'data', TAIL_FILE), 'utf8');
    splitDetail = splitOk ? 'the split re-run from the as-captured file reproduces both files byte for byte' : 'the split re-run does NOT reproduce the files';
  } catch (e: any) { splitDetail = `split re-run failed: ${e.message}`; }
  const counts = { C: pC.bets.length, C10: pC10.bets.length, D: pD.bets.length };
  const supSizes = [pC, pC10, pD].every((d) => { const m = new Map<number, number>(); for (const b of d.bets) m.set(b.epoch, (m.get(b.epoch) || 0) + 1); return [...m.values()].every((n) => n === EXPECTED_EPOCH_SIZE) && m.size === d.seeds.length; });
  // one bet per round — every round id of the five datasets distinct (a bet copied over another fails here)
  const rids = ALL.flatMap((d) => d.bets.map((b) => b.roundId)); const ridsUnique = new Set(rids).size === rids.length && rids.every((x) => typeof x === 'string' && x.length > 0);
  const ok = ds.bets.length === EXPECTED_BETS && ds.seeds.length === EXPECTED_SEEDS && perEpoch.size === EXPECTED_EPOCHS && sizesOk
    && tail.bets.length === EXPECTED_TAIL_BETS && counts.C === EXPECTED_PHASE_C_BETS && counts.C10 === EXPECTED_PHASE_C10_BETS && counts.D === EXPECTED_PHASE_D_BETS && supSizes && splitOk && ridsUnique;
  record(5, ok, `Phase A ${ds.bets.length} bets / ${ds.seeds.length} seeds / ${perEpoch.size} epochs, every epoch ${EXPECTED_EPOCH_SIZE}: ${sizesOk}; tail ${tail.bets.length} (own file, disclosed DL-1); supplementary C ${counts.C}, C $10 ${counts.C10}, D ${counts.D}, every supplementary epoch ${EXPECTED_EPOCH_SIZE}: ${supSizes}; the ${rids.length} round ids of the five files all distinct: ${ridsUnique} — against src/loader.ts constants, never meta; ${splitDetail}`);
});

// ═══ -01 seed hash integrity (every revealed seed of every dataset) ═══
step(['KENO-01'], () => {
  const all = ALL.flatMap((d) => d.seeds);
  const ok = all.filter((s) => sha256Hex(s.revealedServerSeed) === s.hashedServerSeed).length;
  const primOk = ds.seeds.filter((s) => sha256Hex(s.revealedServerSeed) === s.hashedServerSeed).length;
  record(1, ok === all.length && primOk === EXPECTED_SEEDS, `sha256(utf8(revealed)) == committed: ${pct(primOk, EXPECTED_SEEDS)} Phase A seeds, ${pct(ok, all.length)} across Phase A, tail, C, C $10 and D; 0 unverifiable bets`);
});

// ═══ -02 forward commitment chain, anchored before epoch 0 ═══
step(['KENO-02'], () => {
  const chainOf = (d: Dataset) => { let n = 0; for (let i = 0; i + 1 < d.seeds.length; i++) if (d.seeds[i].hashedNextServerSeed === d.seeds[i + 1].hashedServerSeed) n++; return n; };
  const anchor = (d: Dataset) => !!d.preCapture && d.preCapture.hashedNextServerSeed === d.seeds[0].hashedServerSeed;
  const prim = chainOf(ds), link = ds.seeds[ds.seeds.length - 1].hashedNextServerSeed === tail.seeds[0].hashedServerSeed;
  const post = asCaptured.meta.postCapture?.activePair;
  const end = !!post && tail.seeds[tail.seeds.length - 1].hashedNextServerSeed === (post.seed?.hashedServerSeed ?? post.hashedServerSeed);
  const sup = [pC, pC10, pD].map((d) => ({ n: chainOf(d), of: d.seeds.length - 1, anchor: anchor(d) }));
  const ok = prim === EXPECTED_SEEDS - 1 && anchor(ds) && link && end && sup.every((s) => s.n === s.of && s.anchor);
  // P-1, printed and not scored: the capture's two times per CSPRNG client seed (hash read, seed drawn), as it wrote them
  const cs = [ds, tail, pC, pC10].flatMap((d) => d.seeds as any[]).filter((s) => s.clientSeedSource === 'node:crypto randomBytes(16) hex');
  const tw = (s: any) => s.clientSeedDrawnAfterCommitment ?? {}; const sameMs = cs.filter((s) => tw(s).commitmentReadAt && tw(s).commitmentReadAt === tw(s).clientSeedDrawnAt).length;
  const laterMs = cs.filter((s) => tw(s).commitmentReadAt && String(tw(s).commitmentReadAt) < String(tw(s).clientSeedDrawnAt)).length;
  record(2, ok, `Phase A ${pct(prim, EXPECTED_SEEDS - 1)} links, pre-capture anchor ${anchor(ds)}, Phase A → tail link ${link}, tail → pair active after the capture ${end}; C ${sup[0].n}/${sup[0].of} anchor ${sup[0].anchor}, C $10 ${sup[1].n}/${sup[1].of} anchor ${sup[1].anchor}, D ${sup[2].n}/${sup[2].of} anchor ${sup[2].anchor}; the capture's own times for the ${cs.length} CSPRNG client seeds (printed, not scored, P-1): drawn in the same millisecond as the hash read on ${sameMs}, a later millisecond on ${laterMs}, earlier on ${cs.length - sameMs - laterMs}, so the read-then-draw order rests on the rig's code order`);
});

// ═══ -03 hash consistency within epoch ═══
step(['KENO-03'], () => {
  let ok = 0;
  for (const s of ds.seeds) { const bs = ds.bets.filter((b) => b.epoch === Number(s.epoch)); if (bs.every((b) => b.respHashedSeed === s.hashedServerSeed && b.respClientSeed === s.clientSeed)) ok++; }
  // the server's own answer (_raw.game.fairness, kept verbatim in the dataset) is compared with the capture's copies the
  // recomputation reads, on every bet of every dataset — not only the copies
  let n = 0, raw = 0;
  for (const d of ALL) for (const b of d.bets) { n++; const f = (b._raw?.game as any)?.fairness; const s = seedOf(d, b.epoch);
    if (f && s && f.hashedServerSeed === b.respHashedSeed && f.clientSeed === b.respClientSeed && f.hashedServerSeed === s.hashedServerSeed && f.clientSeed === s.clientSeed) raw++; }
  record(3, ok === EXPECTED_EPOCHS && raw === n, `${pct(ok, EXPECTED_EPOCHS)} epochs: every bet's copied server-seed hash and client seed are its epoch's; the server's own answer (_raw.game.fairness.hashedServerSeed, .clientSeed) == the copy == the epoch's on ${pct(raw, n)} bets of Phase A, tail, C, C $10 and D`);
});

// ═══ -04 nonce continuity ═══
step(['KENO-04'], () => {
  let ok = 0; const bad: string[] = [];
  for (const s of ds.seeds) {
    const e = Number(s.epoch); const ns = ds.bets.filter((b) => b.epoch === e).map((b) => b.nonce).sort((a, b) => a - b);
    if (ns.length === EXPECTED_EPOCH_SIZE && ns.every((n, i) => n === NONCE_BASE + i) && ns.length === Number(s.serverNonceAtRotation)) ok++; else bad.push(String(e));
  }
  const ts = tail.seeds[0], tn = tail.bets.map((b) => b.nonce).sort((a, b) => a - b);
  const tailOk = tn.length === EXPECTED_TAIL_BETS && tn.every((n, i) => n === NONCE_BASE + i) && tn.length === Number(ts.serverNonceAtRotation);
  // the supplementary files' epochs too — nonces exactly 1..50, once each, N == the server's count at rotation
  const supEp = ([['C', pC], ['C $10', pC10], ['D', pD]] as [string, Dataset][]).map(([k, d]) => { let g = 0; for (const s of d.seeds) { const e = Number(s.epoch);
    const ns = d.bets.filter((b) => b.epoch === e).map((b) => b.nonce).sort((a, b) => a - b);
    if (ns.length === EXPECTED_EPOCH_SIZE && ns.every((x, i) => x === NONCE_BASE + i) && ns.length === Number(s.serverNonceAtRotation)) g++; } return { k, g, of: d.seeds.length }; });
  const supOk = supEp.every((x) => x.g === x.of);
  // the nonce the recomputation uses (the capture's copy) == the nonce in the server's own answer, every bet of every dataset
  let n = 0, raw = 0; for (const d of ALL) for (const b of d.bets) { n++; if ((b._raw?.game as any)?.fairness?.nonce === b.nonce && Number.isInteger(b.nonce)) raw++; }
  record(4, ok === EXPECTED_EPOCHS && tailOk && raw === n && supOk, `${pct(ok, EXPECTED_EPOCHS)} epochs: nonces exactly ${NONCE_BASE}..${EXPECTED_EPOCH_SIZE}, once each, no gap, repeat or reorder, and N == the server's nonce read at rotation${bad.length ? `; bad epochs ${bad.join(',')}` : ''}; the tail pair (DL-1): ${NONCE_BASE}..${EXPECTED_TAIL_BETS} and N == ${ts.serverNonceAtRotation}: ${tailOk}; the supplementary epochs the same way: ${supEp.map((x) => `${x.k} ${pct(x.g, x.of)}`).join(', ')}; the nonce the recomputation uses == the server's own answer (_raw.game.fairness.nonce) on ${pct(raw, n)} bets of every dataset`);
});

// ═══ -07 / -10 / -11 on Phase A (+ the tail) ═══
const p = input('p', () => (recompute(ds))), tr = input('tr', () => (recompute(tail)));
const tailRe = input('tailRe', () => (tr.balls === tr.n && tr.seedLink === tr.n && tr.hits === tr.n && tr.micro === tr.n && tr.payout === tr.n && tr.copies === tr.n && tr.n === EXPECTED_TAIL_BETS), false);
step(['KENO-07'], () => { record(7, p.balls === p.n && p.seedLink === p.n && p.n === EXPECTED_BETS && tailRe,
  `the ten balls == spec derivation (E01: HMAC-SHA256(serverSeed, clientSeed:nonce:i), u_i = bytes 4i..4i+3 of block_0 ‖ block_1, ball i = position floor(u_i·(40 − i)/2^32) among the tiles not yet drawn, ascending) IN DRAW ORDER ${pct(p.balls, p.n)}, compared with the bet's copy and the server's game answer; answer seeds == epoch seeds ${pct(p.seedLink, p.n)}; coverage ${p.n} == expectedBets; the tail's own file (DL-1): balls ${pct(tr.balls, tr.n)}, hits ${pct(tr.hits, tr.n)}, cells ${pct(tr.micro, tr.n)}, payouts ${pct(tr.payout, tr.n)}, copies == server record ${pct(tr.copies, tr.n)}${p.bad.length ? ' — ' + p.bad.slice(0, 3).join('; ') : ''}`); });
step(['KENO-10'], () => { record(10, p.servedShape === p.n && p.balls === p.n && p.picks === p.n && p.echo === p.n && p.hits === p.n,
  `served balls are 10 different tiles of 0..39 (from the served record alone) ${pct(p.servedShape, p.n)} and equal the recomputed draw ${pct(p.balls, p.n)}; picks legal (1–10 different tiles of 0..39) with a published risk ${pct(p.picks, p.n)}; the answer echoes the picks and risk sent ${pct(p.echo, p.n)}; hits = |picks ∩ recomputed balls| == the served hits ${pct(p.hits, p.n)} — computed, the served field only compared`); });
// every money value the server wrote (and the capture's copies of it) lies on the wallet's 1e-8 grid, every dataset; the
// multiplier is a paytable cell ÷ 10^6, so it is on the grid too
const moneyOf = (b: Bet): unknown[] => { const g: any = b._raw?.game ?? {}, r: any = b._raw?.round ?? {};
  return [b.request.amount, b.stake, b.gameStake, b.payout, b.roundStake, b.roundPayout, b.payoutMultiplier, g.stake, g.payout, g.multiplier,
    r.stake, r.payout, r.delta, ...[r.balance, (b as any).balance, (b._raw as any)?.balance].filter((x) => x != null)]; };
let moneyN = 0, moneyOn = 0; step(['KENO-11'], () => { for (const d of ALL) for (const b of d.bets) for (const x of moneyOf(b)) { moneyN++; if (onGrid8(x)) moneyOn++; } });
step(['KENO-11'], () => { record(11, p.payout === p.n && p.stake === p.n && p.copies === p.n && p.mult === p.n && moneyOn === moneyN,
  `payout == floor(stake × recomputed cell / 10^6) at 1e-8 (E01 rules[2], "rounded down … once") in the bet, the server's game answer and its round record ${pct(p.payout, p.n)}; stake copies (request, bet, game, round) agree ${pct(p.stake, p.n)}; served multiplier == cell / 10^6 ${pct(p.mult, p.n)}; capture copy == the server's own round record (roundId, payout) ${pct(p.copies, p.n)}; ${p.paying} paying bets (${ds.bets.filter((b) => b.micro > MICRO_SCALE).length} above the stake, ${ds.bets.filter((b) => b.micro > 0 && b.micro < MICRO_SCALE).length} below it), ${p.n - p.paying} at 0; every money value and multiplier (stake, payout, multiplier, round stake/payout/delta, balances, in the server's answer and the copies) on the 1e-8 grid, an off-grid value a FAIL: ${pct(moneyOn, moneyN)} values across Phase A, tail, C, C $10 and D`); });

// ═══ -08 draw bias bound: census of src/rng.ts indexFromU for every range the draw uses (40 … 31) ═══
step(['KENO-08'], () => {
  const T = 4294967296n; let mono = true, total = true, worst = 0;
  const lines: string[] = [];
  for (let range = GRID; range > GRID - DRAWN; range--) {
    const R = BigInt(range); const first = (k: number) => (BigInt(k) * T + R - 1n) / R;   // ceil(k · 2^32 / range)
    let sum = 0n, minN = T, maxN = 0n, maxDev = 0n;
    for (let k = 0; k < range; k++) {
      const a = first(k), b = k + 1 === range ? T : first(k + 1), n = b - a; sum += n;
      if (n < minN) minN = n; if (n > maxN) maxN = n;
      if (indexFromU(Number(a), range) !== k || indexFromU(Number(b - 1n), range) !== k || (a > 0n && indexFromU(Number(a - 1n), range) !== k - 1)) mono = false;
      const dev = n * R - T; const ad = dev < 0n ? -dev : dev; if (ad > maxDev) maxDev = ad;
    }
    if (sum !== T) total = false;
    const bound = Number(maxDev) / (range * 4294967296); if (bound > worst) worst = bound;
    lines.push(`${range}: ${minN === maxN ? `${minN}` : `${minN}/${maxN}`}`);
  }
  record(8, mono && total && worst <= 2 ** -32, `count of src/rng.ts indexFromU over the 2^32 values of u, taken from the two ends of each outcome's interval (given by the formula and checked through the function; the values between the ends are not enumerated, so the count is exact for a map that is monotone in u) for each of the 10 ranges the draw uses (index into the ${GRID} … ${GRID - DRAWN + 1} tiles not yet drawn): values per index ${lines.join(', ')}; each range sums to 2^32: ${total}; boundaries re-checked through the function: ${mono}; worst |P(index) − 1/range| = ${worst.toExponential(4)} ≤ 2^-32 = ${(2 ** -32).toExponential(4)} (no modulo, no rejection)`);
});

// ═══ -09 RNG reference vectors (E01 published examples + a captured bet) ═══
step(['KENO-09'], () => {
  const sameAsE01 = JSON.stringify((E01.examples as any[]).map((x) => [x.serverSeed, x.clientSeed, x.nonce, x.balls])) === JSON.stringify(SPEC_VECTORS.map((x) => [x.serverSeed, x.clientSeed, x.nonce, x.balls]))
    && JSON.stringify(E01.payouts) === JSON.stringify(PAYOUT_EXAMPLES);
  const v = SPEC_VECTORS.filter((x) => same(ballsOf(x.serverSeed, x.clientSeed, x.nonce), x.balls)).length;
  const pv = PAYOUT_EXAMPLES.filter((x) => { const m = microOf(x.risk as Risk, x.picks, x.hits); return m / MICRO_SCALE === x.multiplier && payout8(100000000n, m) === units8(x.payout); }).length;
  const b5 = ds.bets.find((b) => b.idx === 5)!; const s5 = seedOf(ds, b5.epoch)!;
  const balls5 = ballsOf(s5.revealedServerSeed, s5.clientSeed, b5.nonce);
  const capOk = same(balls5, b5.outcome) && payout8(units8(b5.stake), microOf(b5.request.risk as Risk, b5.request.spots.length, hitsOf(b5.request.spots, balls5))) === units8(b5.payout);
  record(9, v === SPEC_VECTORS.length && pv === PAYOUT_EXAMPLES.length && capOk && sameAsE01, `the ${SPEC_VECTORS.length} worked draws of HouseBets' published spec (E01 examples, in draw order) ${pct(v, SPEC_VECTORS.length)}; the ${PAYOUT_EXAMPLES.length} published settlements of a stake of 1 (E01 payouts) ${pct(pv, PAYOUT_EXAMPLES.length)}; src/spec.ts vectors == E01: ${sameAsE01}; captured bet idx 5 (${b5.request.risk}, picks ${JSON.stringify(b5.request.spots)}, ${b5.hits} hits, paid ${b5.payout}) recomputes: ${capOk}; also tests/rng.test.ts`);
});

// ═══ -06 client-seed influence, Phase D recomputation, client-seed generator ═══
step(['KENO-06'], () => {
  let changed = 0; let ordered = 1n; for (let i = 0; i < DRAWN; i++) ordered *= BigInt(GRID - i);
  for (const b of ds.bets) { const s = seedOf(ds, b.epoch)!; if (!same(ballsOf(s.revealedServerSeed, s.clientSeed + '#wrong', b.nonce), b.outcome)) changed++; }
  const n = ds.bets.length;
  const d = recompute(pD);
  const seedsInOrder = pD.seeds.map((s) => s.clientSeed);
  const playerSet = PHASE_D_SEEDS.every((x, i) => seedsInOrder[i] === x) && new Set(seedsInOrder).size >= 2;
  let dSame = 0;   // rule 23b: under the previous epoch's client seed the same nonces give another draw
  for (const b of pD.bets) { const s = seedOf(pD, b.epoch)!; const prev = b.epoch === 0 ? pD.preCapture?.clientSeed : seedOf(pD, b.epoch - 1)!.clientSeed; if (!prev || same(ballsOf(s.revealedServerSeed, prev, b.nonce), b.outcome)) dSame++; }
  const gen = [ds, tail, pC, pC10].flatMap((x) => x.seeds).map((s) => s.clientSeedSource);
  const csprng = gen.every((g) => g === 'node:crypto randomBytes(16) hex');
  const esc = readJson('evidence/E06-keno-empty-seed-control-2026-10-13.json').record;
  const ok = changed === n && d.balls === d.n && d.payout === d.n && d.hits === d.n && playerSet && dSame === 0 && csprng && esc.status === 400;
  record(6, ok, `a wrong client seed changes the drawn balls on ${pct(changed, n)} bets (the model: another seed repeats the ordered 10-ball draw with probability 1 / (40!/30!) = 1/${ordered} per bet, so none is expected); Phase D: player-set seeds ${JSON.stringify(seedsInOrder)} (predictable, disclosed DL-2, all 4 epochs exposed), ${pct(d.balls, d.n)} draws, ${pct(d.hits, d.n)} hits and ${pct(d.payout, d.n)} payouts recompute, ${dSame} of ${d.n} draws equal under the previous client seed; phases A–C client seeds from node:crypto randomBytes(16) (CSPRNG) on ${pct(gen.filter((g) => g === 'node:crypto randomBytes(16) hex').length, gen.length)} seeds; empty-seed control: server refused, HTTP ${esc.status} (E06)`);
});

// ═══ -12 bet-size invariance (Phase C at 100 × minimum, and the $10 set) ═══
step(['KENO-12'], () => {
  // the Phase C config is the paytable's highest exact P(non-zero payout) (ties → lower payout variance), recomputed here
  const rank = RISKS.flatMap((risk) => Array.from({ length: PICKS_MAX }, (_, i) => { const n = i + 1; let nz = 0n; for (let k = 0; k <= n; k++) if (microOf(risk, n, k) > 0) nz += hitWeight(n, k); const { varD2 } = moments(risk, n); return { risk, n, nz, varD2 }; }))
    .sort((a, b) => (a.nz === b.nz ? (a.varD2 < b.varD2 ? -1 : a.varD2 > b.varD2 ? 1 : 0) : a.nz > b.nz ? -1 : 1));
  const top = rank[0]; const topOk = top.risk === PHASE_C_RISK && top.n === PHASE_C_PICKS;
  const chk = (d: Dataset, stake: string) => {
    const c = recompute(d);
    const sent = d.bets.every((b) => b.request.risk === PHASE_C_RISK && b.request.spots.length === PHASE_C_PICKS && units8(b.request.amount) === units8(stake) && b._raw.game?.risk === PHASE_C_RISK && (b._raw.game?.spots ?? []).length === PHASE_C_PICKS);
    return { c, sent, ok: c.balls === c.n && c.hits === c.n && c.micro === c.n && c.payout === c.n && c.stake === c.n && c.copies === c.n && sent && c.paying >= 100 };
  };
  const a = chk(pC, PHASE_C_STAKE), b = chk(pC10, PHASE_C10_STAKE);
  const minOk = units8(PHASE_C_STAKE) === 100n * units8(MIN_STAKE);
  record(12, a.ok && b.ok && minOk && topOk, `Phase C config recomputed from the paytable: ${top.risk}, ${top.n} pick (P(non-zero payout) = ${Number(top.nz) / Number(D)}) == the one played: ${topOk}; Phase C ${pC.bets.length} bets at ${PHASE_C_STAKE} (= 100 × E03 minimum ${MIN_STAKE}: ${minOk}): draws ${pct(a.c.balls, a.c.n)}, hits ${pct(a.c.hits, a.c.n)}, cells ${pct(a.c.micro, a.c.n)}, payouts ${pct(a.c.payout, a.c.n)}, as sent and answered ${a.sent}, ${a.c.paying} paying (≥ 100); $10 set ${pC10.bets.length} bets at ${PHASE_C10_STAKE}: draws ${pct(b.c.balls, b.c.n)}, cells ${pct(b.c.micro, b.c.n)}, payouts ${pct(b.c.payout, b.c.n)}, as sent and answered ${b.sent}, ${b.c.paying} paying (≥ 100); same paytable cell and rounding rule as base stake`);
});

// ═══ -13 paytable provenance & served-vs-declared ═══
step(['KENO-13'], () => {
  const e01Rows = RISKS.flatMap((r) => (E01.paytables[r] as any[]).map((x, i) => ({ r, n: i + 1, x })));
  const codeVsE01 = e01Rows.filter(({ r, n, x }) => x.picks === n && same(PAYTABLE[r][n - 1], x.micro) && x.micro.every((m: number, k: number) => Math.abs(x.multipliers[k] - m / MICRO_SCALE) <= 1e-12)).length;
  const codeVsE07 = RISKS.flatMap((r) => PAYTABLE[r].map((row, i) => same(row, E07.paytableMicro[r]?.[i]))).filter(Boolean).length;
  const rowsOk = e01Rows.length === 40 && Object.keys(E01.paytables).length === RISKS.length && Object.keys(E07.paytableMicro).length === RISKS.length;
  // every bet of every dataset: the served cell == the declared cell at the recomputed hits; the served (risk, picks) rows seen
  let n = 0, ok = 0; const served = new Set<string>();
  for (const d of ALL) for (const b of d.bets) {
    n++; const s = seedOf(d, b.epoch)!; const risk = b.request.risk, picks = b.request.spots;
    if (!isRisk(risk) || !legalPicks(picks)) continue;
    const m = microOf(risk, picks.length, hitsOf(picks, ballsOf(s.revealedServerSeed, s.clientSeed, b.nonce)));
    if (b._raw.game?.micro === m && b.micro === m) ok++; served.add(configOf(risk, picks.length));
  }
  const no1x = RISKS.every((r) => PAYTABLE[r].every((row) => row.every((m) => m !== MICRO_SCALE)));
  record(13, codeVsE01 === 40 && codeVsE07 === 40 && rowsOk && ok === n, `src/spec.ts paytable == the server's published table (E01 paytables, micro and multipliers) ${pct(codeVsE01, 40)} rows, == the game page's own table (E07, the bundle's Af) ${pct(codeVsE07, 40)} rows, cell for cell; the served cell == the declared cell at the recomputed hits on ${pct(ok, n)} bets of every dataset, covering ${served.size}/40 served (risk, picks) rows; the derivation reads no operator multiplier, hit or probability field (E01 hitChance is only compared, -18); no cell pays exactly 1× (the served outcome word follows the cell: 0 lose, < 1× partial, > 1× win): ${no1x}`);
});

// ═══ -14 paytable shape & bounds ═══
step(['KENO-14'], () => {
  const consolation: string[] = [], decreasing: string[] = [], partial: string[] = []; let topMult = 0, topCfg = '';
  for (const r of RISKS) PAYTABLE[r].forEach((row, i) => {
    const n = i + 1; if (row[0] > 0) consolation.push(`${r}/${n} 0 hits ${row[0] / MICRO_SCALE}×`);
    for (let k = 1; k < row.length; k++) if (row[k] < row[k - 1]) decreasing.push(`${r}/${n} ${k} hits`);
    for (let k = 0; k < row.length; k++) if (row[k] > 0 && row[k] < MICRO_SCALE) partial.push(`${r}/${n}/${k}`);
    if (row[row.length - 1] > topMult) { topMult = row[row.length - 1]; topCfg = `${r}/${n}`; }
  });
  // the max-win clip (E01 rules[3]): a stake whose top prize would pay more than the max win above it is refused
  const cap8 = units8(MAX_WIN), lo = units8(MIN_STAKE), hi = units8(MAX_STAKE);
  let n = 0, inRange = 0, maxTopNet = 0n;
  for (const d of ALL) for (const b of d.bets) {
    n++; const s8 = units8(b.stake); if (s8 >= lo && s8 <= hi) inRange++;
    if (!isRisk(b.request.risk) || !legalPicks(b.request.spots)) continue;
    const row = PAYTABLE[b.request.risk][b.request.spots.length - 1]; const net = payout8(s8, row[row.length - 1]) - s8; if (net > maxTopNet) maxTopNet = net;
  }
  const threshold = Number(cap8) / 1e8 / (topMult / MICRO_SCALE - 1);
  const rej = (asCaptured.meta.rejected ?? []) as any[];
  const rejTransient = rej.every((x) => /temporarily unavailable/i.test(JSON.stringify(x.body ?? '')));
  const declared = /max win above it is refused before the draw/.test(E01.rules[3]) && /refused before the draw/.test(E02.rulesMaxWin ?? '');
  const ok = inRange === n && maxTopNet <= cap8 && declared && rejTransient && decreasing.length === 0;
  // the refusal branch is reachable within the bet limits (it binds below the max stake) and the capture never produced it.
  // Scored by the profile's rule text (decision of 27 Oct, "same gap, same score"): KENO-14 asks that "the max-profit clip is
  // declared (or declared undeclared)" and that a violation be disclosed; a declared branch the capture never reached is not
  // one of its violations, so the check passes with the branch declared unwitnessed (DL-7), as LIMBO-14 scores it
  const reachable = threshold < Number(hi) / 1e8, refusals = rej.filter((x) => /max.?win/i.test(JSON.stringify(x.body ?? ''))).length;
  const branch = `; the refusal branch binds below the max stake ${MAX_STAKE} (reachable within the bet limits: ${reachable}) and the capture produced it ${refusals} times (largest captured stake ${Math.max(...ALL.flatMap((d) => d.bets.map((b) => Number(b.stake))))}, DL-7)`;
  if (ok && reachable && refusals === 0) record(14, true, `every stake within the declared ${MIN_STAKE} … ${MAX_STAKE} (E03): ${pct(inRange, n)}; the top multiplier is ${topMult / MICRO_SCALE}× (${topCfg}); the max-win clip is declared (E01 rules[3], E02 rulesMaxWin) and binds above a stake of about ${threshold.toFixed(2)} on ${topCfg} (max win ${MAX_WIN} ÷ ${topMult / MICRO_SCALE - 1}); the largest top-prize win above the stake of any captured bet is ${Number(maxTopNet) / 1e8}, below the max win; the capture's ${rej.length} refused requests are all the transient "Transaction temporarily unavailable" (DL-1): ${rejTransient}; non-monotone cells: ${consolation.length} consolation payouts on 0 hits (${consolation.join(', ')}), ${decreasing.length} decreasing steps; ${partial.length} cells pay less than the stake (0 < multiplier < 1, a "partial" result)${branch} — the clip is declared and the branch is declared unwitnessed (DL-7); the rule asks for the declaration, not a witness, so PASS`);
  else record(14, ok, `every stake within the declared ${MIN_STAKE} … ${MAX_STAKE} (E03): ${pct(inRange, n)}; the top multiplier is ${topMult / MICRO_SCALE}× (${topCfg}); the max-win clip is declared (E01 rules[3], E02 rulesMaxWin) and binds above a stake of about ${threshold.toFixed(2)} on ${topCfg} (max win ${MAX_WIN} ÷ ${topMult / MICRO_SCALE - 1}); the largest top-prize win above the stake of any captured bet is ${Number(maxTopNet) / 1e8}, below the max win, so no refusal is expected and the capture's ${rej.length} refused requests are all the transient "Transaction temporarily unavailable" (DL-1): ${rejTransient}; non-monotone cells: ${consolation.length} consolation payouts on 0 hits (${consolation.join(', ')}), ${decreasing.length} decreasing steps${decreasing.length ? ` (${decreasing.join(', ')})` : ''}; ${partial.length} cells pay less than the stake (0 < multiplier < 1, a "partial" result)`);
});

// ═══ -15 configuration & cell coverage, against the capture plan in code ═══
step(['KENO-15'], () => {
  const per: Record<string, number> = {}, cells = new Set<string>();
  for (const b of ds.bets) { const c = configOf(b.request.risk, b.request.spots.length); per[c] = (per[c] || 0) + 1; cells.add(`${c}/${b.hits}`); }
  const under = CONFIGS.filter((c) => (per[c] || 0) < COVERAGE_FLOOR);
  const cls: Record<string, number> = {}; for (const b of ds.bets) cls[b.cls] = (cls[b.cls] || 0) + 1;
  const planOk = PLAN_CLASSES.every((c) => (cls[c] || 0) > 0) && Object.keys(cls).every((c) => PLAN_CLASSES.includes(c));
  // the share of each configuration's theoretical RTP carried by cells never reached in Phase A
  let totalCells = 0, worstShare = 0, worstCfg = ''; let sumShare = 0, likeliest = 0, likeliestCell = '';
  for (const risk of RISKS) for (let n = 1; n <= PICKS_MAX; n++) {
    const [num] = configRtp(risk, n); let unreached = 0n;
    for (let k = 0; k <= n; k++) {
      totalCells++; if (cells.has(`${risk}/${n}/${k}`)) continue;
      unreached += hitWeight(n, k) * BigInt(microOf(risk, n, k));
      const pr = Number(hitWeight(n, k)) / Number(D); if (pr > likeliest) { likeliest = pr; likeliestCell = `${risk}/${n} at ${k} hits`; }
    }
    const share = Number(unreached) / Number(num); sumShare += share; if (share > worstShare) { worstShare = share; worstCfg = `${risk}/${n}`; }
  }
  const vals = Object.values(per);
  const tr = asCaptured.meta.planTruncated ?? {};
  const planText = `the Phase A plan was trimmed from ${tr.from} to ${tr.to} entries at ${tr.at} with ${tr.betsInCheckpointAtTrim} bets already placed, by dropping its last entries before they were played (as-captured meta.planTruncated); ${asCaptured.bets.length} were placed and ${(asCaptured.meta.rejected ?? []).length} refused (DL-1)`;
  const pocketsReached = new Set(ds.bets.flatMap((b) => b.outcome)).size;
  record(15, under.length === 0 && planOk && CONFIGS.every((c) => per[c] > 0) && pocketsReached === GRID,
    `${planText}; Phase A bets per (risk, picks) configuration (src/rules.ts CONFIGS, floor ${COVERAGE_FLOOR}): ${CONFIGS.length}/${CONFIGS.length} present, min ${Math.min(...vals)}, max ${Math.max(...vals)}${under.length ? `; below the floor: ${under.join(', ')}` : ''}; the ${PLAN_CLASSES.length} plan classes (src/loader.ts PLAN_CLASSES) are exactly the ones played: ${planOk}; all ${GRID} tiles drawn: ${pocketsReached === GRID}; paytable cells reached in live play ${cells.size}/${totalCells}; share of a configuration's theoretical RTP carried by never-reached cells: mean ${(sumShare / 40 * 100).toFixed(2)} %, worst ${(worstShare * 100).toFixed(2)} % (${worstCfg}); the likeliest never-reached cell is ${likeliestCell} (P = ${likeliest.toExponential(2)} per bet, about ${(likeliest * (per[likeliestCell.split(' ')[0]] || 0)).toFixed(2)} expected in this configuration's Phase A bets) — printed; a cell's payout rule is the paytable (-13)`);
});

// ═══ -16 wallet / balance reconciliation (the platform's bet history, E04; the account reconciliation, E05) ═══
step(['KENO-16'], () => {
  const e4 = readJson('evidence/E04-keno-bet-history-2026-10-13.json'); const led = new Map<string, any>(e4.rows.map((r: any) => [r.id, r]));
  let n = 0, ok = 0; const used = new Set<string>();   // each E04 row matched at most once (one-to-one)
  for (const d of ALL) for (const b of d.bets) {
    n++; const x = led.get(b.roundId); if (!x || used.has(x.id)) continue; used.add(x.id);
    if (x && units8(x.stake) === units8(b._raw.round!.stake) && units8(x.payout) === units8(b._raw.round!.payout) && x.game === 'housegames-keno' && x.status === (units8(b.payout) > 0n ? 'won' : 'lost')) ok++;
  }
  // the numbers are compared, not the shape of a line — every dataset row's paid − staked == net, the TOTAL row == the sum
  // of the rows, the ledger line adds up and matches TOTAL, the before-balance == after − net + open stakes at 1e-8, the
  // last game answer == the after-balance at its 4 decimals, and this package's own datasets give the rounds, stake and paid
  // E05 prints for them, computed here from the datasets (the as-captured file stands for Phase A + tail)
  const e5 = readFileSync(join(ROOT, 'evidence', 'E05-account-reconcile-2026-10-13.txt'), 'utf8');
  const u8 = (s: string) => units8(s.replace(/^\+/, ''));
  const dsRows = e5.split('\n').filter((l) => /\.json\s+\d+\s/.test(l)).map((l) => { const m = l.trim().split(/\s+/); return { file: m[0], rounds: Number(m[1]), staked: u8(m[2]), paid: u8(m[3]), net: u8(m[4]) }; });
  const games = new Set(dsRows.map((r) => (r.file.split('/').pop()!.match(/^housebets-([a-z]+)/) || r.file.match(/\/([a-z0-9]+)\/[^/]+$/) || [])[1]).filter(Boolean));
  const ledger = e5.match(/ledger: (\d+) entries = (\d+) captured rounds matched exactly \+ (\d+) open \+ (\d+) from 10 Oct; unexplained (\d+)/);
  const tot = e5.match(/^TOTAL\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s*$/m);
  const after = e5.match(/wallet cash balance after \(server, 8 dp\): (\d+\.\d{8})/), before = e5.match(/balance before = after - net (\S+) \+ open stakes (\S+) = (\d+\.\d{8})/);
  const last = e5.match(/last answer \S+: balance (\d+\.\d+) \(4 dp\)/);
  const sum = (f: (r: typeof dsRows[number]) => bigint) => dsRows.reduce((s, r) => s + f(r), 0n);
  const rowsNet = dsRows.filter((r) => r.paid - r.staked === r.net).length;
  const totOk = !!tot && Number(tot[1]) === dsRows.reduce((s, r) => s + r.rounds, 0) && u8(tot[2]) === sum((r) => r.staked) && u8(tot[3]) === sum((r) => r.paid) && u8(tot[4]) === sum((r) => r.net) && u8(tot[3]) - u8(tot[2]) === u8(tot[4]);
  const ledgerOk = !!ledger && !!tot && Number(ledger[1]) === Number(ledger[2]) + Number(ledger[3]) + Number(ledger[4]) && ledger[2] === tot[1] && ledger[5] === '0';
  const balOk = !!after && !!before && !!tot && u8(before[1]) === u8(tot[4]) && u8(before[3]) === u8(after[1]) - u8(before[1]) + u8(before[2]);
  const lastOk = !!after && !!last && Math.abs(Number(units8(after[1]) - units8(last[1]))) <= 5000;   // ≤ half a 4-dp unit
  const tally = (d: Dataset) => ({ rounds: d.bets.length, staked: d.bets.reduce((s, b) => s + units8(b._raw.round!.stake), 0n), paid: d.bets.reduce((s, b) => s + units8(b._raw.round!.payout), 0n) });
  const ourSets: [string, Dataset][] = [['phaseA/' + AS_CAPTURED_FILE.split('/').pop()!, asCaptured], ['phases/' + PHASE_C_FILE.split('/').pop()!, pC],
    ['phases-10usd/' + PHASE_C10_FILE.split('/').pop()!, pC10], ['phases/' + PHASE_D_FILE.split('/').pop()!, pD]];
  const oursOk = ourSets.filter(([f, d]) => { const r = dsRows.find((x) => x.file.endsWith(f)); const t = tally(d); return !!r && r.rounds === t.rounds && r.staked === t.staked && r.paid === t.paid; }).length;
  // every same-engine keno dataset E05 lists, and the ones this package does not ship
  const gameRows = dsRows.filter((r) => /housebets-keno2?-/.test(r.file.split('/').pop()!)), notOurs = gameRows.filter((r) => !ourSets.some(([f]) => r.file.endsWith(f)));
  const excl = `E05 lists ${gameRows.length} keno datasets, ${gameRows.reduce((s, r) => s + r.rounds, 0)} rounds: this package's ${gameRows.length - notOurs.length} (${gameRows.length - notOurs.length ? gameRows.filter((r) => !notOurs.includes(r)).reduce((s, r) => s + r.rounds, 0) : 0} rounds) and, not shipped, ${notOurs.map((r) => `${r.file.split('/').pop()} (${r.rounds} rounds${r.file.endsWith('/' + PILOT_FILE) ? ', the 12 Oct first capture, recomputed by npm run pilot' : ''})`).join(', ') || 'none'}`;
  const rec = rowsNet === dsRows.length && totOk && ledgerOk && balOk && lastOk && /^RECONCILED$/m.test(e5) && !/NOT RECONCILED|^FAIL /m.test(e5);
  const seq = [...asCaptured.bets].sort((x, y) => x.idx - y.idx) as any[]; let balMoved = 0; const balPairs = seq.length - 1;
  for (let i = 1; i < seq.length; i++) if (Math.abs(Math.round((seq[i].balance - seq[i - 1].balance) * 1e4) - Math.round((seq[i].payout - seq[i].stake) * 1e4)) > 1) balMoved++;
  record(16, ok === n && e4.rows.length === n && used.size === n && led.size === n && rec && oursOk === ourSets.length, `every keno round of the package is in the platform's bet history with the same stake, payout and won/lost status, each row matched once: ${pct(ok, n)} (E04, ${e4.rows.length} rows, ${led.size} distinct ids); the account reconciliation (E05, the full output of the workshop's reconcile-full.py), its numbers re-added here: ${dsRows.length} captured datasets of ${games.size} games, paid − staked == net on ${pct(rowsNet, dsRows.length)} rows, TOTAL (${tot?.[1]} rounds, staked ${tot?.[2]}, paid ${tot?.[3]}, net ${tot?.[4]}) == the sum of the rows: ${totOk}; ${ledger?.[1]} ledger entries = ${ledger?.[2]} captured rounds matched exactly + ${ledger?.[3]} open + ${ledger?.[4]} bets from 10 Oct, matched == TOTAL rounds, unexplained ${ledger?.[5]}: ${ledgerOk}; the after-balance ${after?.[1]} is the server's 8-dp read after the capture and the before-balance ${before?.[3]} is DERIVED from it (after − net + open stakes, == at 1e-8: ${balOk}), not read; the last game answer's 4-dp balance ${last?.[1]} == the after-balance at 4 dp: ${lastOk}; the first answer's balance follows the day's first bet and is not compared; RECONCILED: ${rec}; this package's 4 datasets (as-captured Phase A + tail, C, C $10, D) give the rounds, stake and paid E05 prints for them, summed here from the datasets at 1e-8: ${pct(oursOk, ourSets.length)}; ${excl}; the per-bet balance field is not used: between consecutive as-captured answers (Phase A and tail) the balance moved by something other than the keno bet's own net on ${balMoved} of ${balPairs} (4 dp), because other games' captures ran on the same account at the same time (DL-8)`);
});

// ═══ -17 pick-set independence ═══
step(['KENO-17'], () => {
  const rngSrc = readFileSync(join(ROOT, 'src', 'rng.ts'), 'utf8');
  const messageOk = /update\(`\$\{clientSeed\}:\$\{nonce\}:\$\{block\}`\)/.test(rngSrc) && /export function ballsOf\(serverSeed: string, clientSeed: string, nonce: number\)/.test(rngSrc);
  let epochsMulti = 0, epochsOk = 0;
  for (const s of ds.seeds) {
    const bs = ds.bets.filter((b) => b.epoch === Number(s.epoch));
    const sets = new Set(bs.map((b) => `${b.request.risk}:${[...b.request.spots].sort((x, y) => x - y).join(',')}`));
    if (sets.size > 1) { epochsMulti++; if (bs.every((b) => same(ballsOf(s.revealedServerSeed, s.clientSeed, b.nonce), b.outcome))) epochsOk++; }
  }
  record(17, messageOk && p.balls === p.n && epochsOk === epochsMulti && epochsMulti > 0, `the declared RNG message is "clientSeed:nonce:i" and src/rng.ts ballsOf takes (serverSeed, clientSeed, nonce) only — no pick, risk or stake field: ${messageOk}; every Phase A bet recomputes with its picks excluded from the derivation ${pct(p.balls, p.n)}; ${pct(epochsOk, epochsMulti)} epochs whose bets carried different picks and risks draw by the one function`);
});

// ═══ -18 anti-circularity: the hypergeometric law, exact ═══
step(['KENO-18'], () => {
  let ok = 0; const bad: string[] = []; let worstE01 = 0;
  for (let n = 1; n <= PICKS_MAX; n++) {
    let sum = 0n, mean = 0n, alt = true;
    for (let k = 0; k <= n; k++) {
      const w = hitWeight(n, k); sum += w; mean += BigInt(k) * w;
      const [an, ad] = hitChanceAlt(n, k); if (w * ad !== an * D) alt = false;                 // C(n,k)C(40−n,10−k)/C(40,10) == C(10,k)C(30,n−k)/C(40,n)
      const op = (E01.hitChance?.[String(n)] ?? [])[k]; worstE01 = Math.max(worstE01, Math.abs(Number(w) / Number(D) - (typeof op === 'number' ? op : NaN)) || 0);
      if (typeof op !== 'number') alt = false;
    }
    if (sum === D && mean * BigInt(GRID) === BigInt(n * DRAWN) * D && alt) ok++; else bad.push(String(n));
  }
  // negative controls: a probability nudged by one count breaks Σ = 1; a paytable cell nudged by one micro no longer reproduces E01's exact RTP
  const nudged = hitWeight(5, 2) + 1n; let s5 = 0n; for (let k = 0; k <= 5; k++) s5 += k === 2 ? nudged : hitWeight(5, k);
  const probRejected = s5 !== D;
  const [num, den] = configRtp('classic', 5); const nudgedNum = num + hitWeight(5, 3);   // classic/5, 3 hits + 1 micro
  const e01r = String(E01.paytables.classic[4].rtp).split('/').map((x) => BigInt(x)); const tableRejected = nudgedNum * e01r[1] !== e01r[0] * den && num * e01r[1] === e01r[0] * den;
  record(18, ok === PICKS_MAX && probRejected && tableRejected && worstE01 <= 1e-15, `P(k hits | n picks) = C(n,k)·C(40−n,10−k)/C(40,10), exact BigInt: for every n = 1 … 10, Σ_k P = 1, the mean = n·10/40, and the other counting C(10,k)·C(30,n−k)/C(40,n) gives the same fractions: ${pct(ok, PICKS_MAX)}${bad.length ? ` (differ: n = ${bad.join(', ')})` : ''}; the operator's E01 hitChance field is compared, never used: worst |Δ| ${worstE01.toExponential(1)}; negative controls: one count added to P(2 | 5) breaks Σ = 1 (${probRejected}), one micro added to classic/5 at 3 hits no longer equals E01's exact RTP for that row while the true table does (${tableRejected})`);
});

// ═══ -19 per-configuration RTP by exact enumeration vs the claim (RTP-CLAIM 1.2.0 table, exact; enforced) ═══
const rtp = input('rtp', () => (computeRtpClaim()));
const gate = input('gate', () => (runRtpClaimGate()));
step(['KENO-19'], () => {
  // the claim is read from the exhibits (src/exhibits.ts), per configuration the highest figure any place
  // states for it; the -19 status comes from the RTP-CLAIM rule alone. E01's row equality and its own "to one millionth" band are
  // printed as information: an exhibit that overstates a row is the rule's to judge (OVERSTATED), never an operator FLAG first.
  const pub = PUB!; let eq = 0, inBand = 0; const spread: number[] = [];
  // E01 "return"'s own band, read from its text: "at most A/B and at least A/B − m·10^-e"
  const lb = statedLowerBound(); const lbm = lb ? /^(\d+)\/(\d+) − (\d+(?:\.\d+)?)e-(\d+)$/.exec(lb) : null;
  const la = lbm ? BigInt(lbm[1]) : 0n, ld = lbm ? BigInt(lbm[2]) : 1n; const [ea, eb0] = lbm ? ratOf(lbm[3]) : [0n, 1n]; const eb = eb0 * 10n ** BigInt(lbm ? lbm[4] : 0);
  for (const risk of RISKS) for (let n = 1; n <= PICKS_MAX; n++) {
    const [num, den] = configRtp(risk, n); const [a, b] = ratOf(String(E01.paytables[risk][n - 1].rtp));
    if (num * b === a * den) eq++;
    if (lbm && num * ld <= la * den && num * ld * eb >= (la * eb - ea * ld) * den) inBand++;
    spread.push(Number(num * 10n ** 12n / den) / 1e12);
  }
  const ok = true;
  recordRtpClaim(19, ok, gate, `${rtp.settings} configurations: exact RTP Σ_k P(k)·cell from ${rtp.trueMin.rtpPct} % (${rtp.trueMin.setting}) to ${rtp.trueMax.rtpPct} % (${rtp.trueMax.setting}), spread ${((Math.max(...spread) - Math.min(...spread)) * 100).toExponential(2)} pp; vs the per-configuration claim read from the exhibits at run time — the flat ${pub.flat} of ${pub.places.map((p) => `${p.where} "${p.text.split(/[:,] /)[0]}" (${p.rtp})`).join('; ')}${pub.agree ? ' (the places agree)' : ' — THE PLACES DISAGREE'}, or E01's own row figure where higher (${pub.rowsAbove.length ? pub.rowsAbove.join('; ') : 'none is'}): ${rtp.houseSideFailures} house-side beyond the 0.1 pp band → RTP-CLAIM ${rtp.outcome} (rule ${rtp.ruleVersion.split(' ')[0]}, enforced ${RTP_CLAIM_RULE_ENFORCED}: ${gate.status}); information, not scored here: every configuration == the exact fraction E01 publishes for its row ${pct(eq, 40)}, inside E01's own stated band [${lb ?? 'not stated'}, ${lbm ? `${la}/${ld}` : '—'}] ${pct(inBand, 40)}; the per-configuration table is outputs/rtp-claim-table.json, regenerated == committed: ${gate.tableMatches}`);
});

// ═══ -20 / -21 the simulation, re-run in full and compared with the pinned census ═══
/** '' when the pinned census ships; else the words the census checks print (and censusSame is false: FAIL). */
function censusMissing(): string { return existsSync(join(ROOT, 'outputs', 'simulation-results.json')) ? '' : ' (outputs/simulation-results.json is MISSING: the re-run has nothing to equal, FAIL)'; }
let cen: Census; let censusSame = false;
step(['KENO-20'], () => {
  cen = census(P2SETS);
  const committed = (existsSync(join(ROOT, 'outputs', 'simulation-results.json')) ? readFileSync(join(ROOT, 'outputs', 'simulation-results.json'), 'utf8') : null);
  censusSame = censusText(cen) === committed;
  mkdirSync(join(ROOT, 'outputs', 'run'), { recursive: true });
  writeFileSync(join(ROOT, 'outputs', 'run', 'simulation-results.json'), censusText(cen));
});
step(['KENO-20'], () => {
  const p1 = cen.pass1; const N = p1.rounds, T = p1.totalRounds, q = DRAWN / GRID, e = T * q;   // N per stream (per configuration), T over the streams
  // tile uniformity with the without-replacement correction (src/false-alarm-tiles.ts): X² · (K − 1)/(K(1 − q)) = X² · 39/30
  // ~ χ²(39) for 10 of K = 40 per round. Until 14 Oct the factor was (1 − q)(K − 1)/K = 0.73125, which understated the statistic
  const tc = tileChi2(p1.balls, T), x2 = tc.x2, chi2 = tc.chi2, pChi = tc.p;
  const n = p1.lag1.n, sx = Number(BigInt(p1.lag1.sumX)), sx2 = Number(BigInt(p1.lag1.sumX2)), sxy = Number(BigInt(p1.lag1.sumXY));
  const mean = sx / n, varr = sx2 / n - mean * mean, r1 = (sxy / (n - 1) - mean * mean) / varr, z1 = r1 * Math.sqrt(n), pLag = twoSidedNormalP(z1);
  const runs = runsStatisticFromCounts(p1.runs.runs, p1.runs.n1, p1.runs.n), pRuns = twoSidedNormalP(runs.z);
  const screens = pChi >= ALPHA_SCREEN && pLag >= ALPHA_SCREEN && pRuns >= ALPHA_SCREEN;
  // every tile count within 5σ + 1 of N·10/40 (a tile is drawn in a round with probability 1/4: binomial, exact false-alarm)
  const sd = Math.sqrt(T * q * (1 - q)), lo = Math.ceil(e - EDGE_SIGMAS * sd - 1), hi = Math.floor(e + EDGE_SIGMAS * sd + 1);
  const tilesOk = p1.balls.every((c) => c >= lo && c <= hi), tileFa = GRID * binomialOutside(T, q, lo, hi);
  // every hit-histogram cell of every pick count within 5σ + 1 of N·P(k | n), exact binomial false alarm per cell (union bound)
  let cellsOk = 0, cellsAll = 0, cellFa = 0, worstZ = 0, worstCell = '';
  for (let pk = 1; pk <= PICKS_MAX; pk++) for (let k = 0; k <= pk; k++) {
    cellsAll++; const pr = Number(hitWeight(pk, k)) / Number(D), ex = N * pr, s = Math.sqrt(N * pr * (1 - pr));
    const a = Math.max(0, Math.ceil(ex - EDGE_SIGMAS * s - 1)), b = Math.floor(ex + EDGE_SIGMAS * s + 1); const o = p1.hits[pk - 1][k];
    if (o >= a && o <= b) cellsOk++; cellFa += binomialOutside(N, pr, a, b);
    const z = s > 0 ? Math.abs(o - ex) / s : 0; if (z > worstZ) { worstZ = z; worstCell = `${pk} picks, ${k} hits: ${o} vs ${ex.toFixed(1)}`; }
  }
  const histOk = p1.hits.every((row, i) => row.reduce((x, y) => x + y, 0) === N && row.length === i + 2);
  // RTP convergence per configuration, from the histogram: printed (the histogram bands above are the scored form)
  let worstRtp = 0, worstRtpCfg = '';
  for (const risk of RISKS) for (let pk = 1; pk <= PICKS_MAX; pk++) {
    const row = PAYTABLE[risk][pk - 1]; let ret = 0; for (let k = 0; k <= pk; k++) ret += p1.hits[pk - 1][k] * row[k];
    const { meanD, varD2 } = moments(risk, pk); const mu = Number(meanD) / Number(D) / MICRO_SCALE, se = Math.sqrt(Number(varD2)) / Number(D) / MICRO_SCALE / Math.sqrt(N);
    const z = Math.abs(ret / MICRO_SCALE / N - mu) / se; if (z > worstRtp) { worstRtp = z; worstRtpCfg = `${risk}/${pk} ${(ret / MICRO_SCALE / N * 100).toFixed(3)} % vs ${(mu * 100).toFixed(4)} %`; }
  }
  const rtpIn = worstRtp * 1 <= EDGE_SIGMAS;
  // the half-width of each printed RTP band (5·SE, SE = σ_config/√N) against the 1 pp house edge it would have to detect
  const bands = RISKS.flatMap((risk) => Array.from({ length: PICKS_MAX }, (_, i) => { const { varD2 } = moments(risk, i + 1); return { cfg: `${risk}/${i + 1}`, w: EDGE_SIGMAS * Math.sqrt(Number(varD2)) / Number(D) / MICRO_SCALE / Math.sqrt(N) }; }));
  const bMin = bands.reduce((a, b) => (b.w < a.w ? b : a)), bMax = bands.reduce((a, b) => (b.w > a.w ? b : a)), wider = bands.filter((b) => b.w > 0.01).length;
  const bandText = `bands: tile count T/4 ± (5σ + 1) = ${lo}..${hi} over the T = ${T.toLocaleString('en')} rounds (half-width ${((hi - lo) / 2).toFixed(1)}, ${((hi - lo) / 2 / e * 100).toFixed(3)} % of T/4); each hit cell N·P(k | n) ± (5σ + 1) on its stream's N = ${N.toLocaleString('en')} rounds; the printed RTP bands ±5·SE (SE = σ_config/√N) run from ${(bMin.w * 100).toFixed(3)} pp (${bMin.cfg}) to ${(bMax.w * 100).toFixed(3)} pp (${bMax.cfg}), ${wider} of 40 wider than the 1 pp house edge (those configurations' RTP bands cannot see an edge of that size from this sample; the scored form is the hit histogram)`;
  const serialFa = serialScreensFalseAlarm(GRID, RUNS_HIGH_FROM, ALPHA_SCREEN).either;
  const ownSeeds = new Set(Array.from({ length: PICKS_MAX }, (_, i) => pass1Seed(i + 1, 0)).flatMap((x) => [x.server, x.client, String(x.picks)])).size === 3 * PICKS_MAX;   // no two streams on one seed label
  const depth = N === SIM_ROUNDS && N >= FLOOR_ROUNDS_PER_CONFIG && p1.streams === PICKS_MAX && T === PICKS_MAX * N && n === T && ownSeeds;
  const ok = censusSame && screens && tilesOk && cellsOk === cellsAll && histOk && depth;
  record(20, ok, `census re-run in full == the pinned outputs/simulation-results.json byte for byte: ${censusSame}${censusMissing()}; ${p1.streams} streams (one per pick count, each on its own seeds: ${ownSeeds}) × ${N.toLocaleString('en')} fresh rounds = ${T.toLocaleString('en')} rounds, every round on a random pick set, the four risk levels of a pick count settled on its stream (floor ${FLOOR_ROUNDS_PER_CONFIG.toLocaleString('en')} per configuration); on all ${T.toLocaleString('en')} rounds: tile chi² ${chi2.toFixed(2)} (df 39; Pearson X² ${x2.toFixed(2)} × ${TILE_CHI2_FACTOR.toFixed(4)}, the without-replacement correction (K − 1)/(K(1 − q))) p ${pChi.toFixed(4)}, first-ball lag-1 r ${r1.toExponential(2)} z ${z1.toFixed(3)} p ${pLag.toFixed(4)}, runs (first ball ≥ ${RUNS_HIGH_FROM}) z ${runs.z.toFixed(3)} p ${pRuns.toFixed(4)} (each ≥ α/3 = ${ALPHA_SCREEN.toFixed(4)}: ${screens}); every tile count in ${lo}..${hi} (5σ + 1): ${tilesOk}; hit histogram vs the hypergeometric law, every cell in its 5σ + 1 band: ${pct(cellsOk, cellsAll)} (worst ${worstZ.toFixed(2)}σ, ${worstCell}); RTP convergence from the histogram, printed: worst ${worstRtp.toFixed(2)} SE (${worstRtpCfg}), all within 5 SE: ${rtpIn}; ${bandText}; false-alarm rates: tile screen α/3 = ${fmtRate(ALPHA_SCREEN)} under the χ²(39) law, measured ${TILE_FALSE_ALARM.rate} ± ${TILE_FALSE_ALARM.standardError} (mean statistic ${TILE_FALSE_ALARM.meanStatistic} vs 39) by src/false-alarm-tiles.ts over ${TILE_FALSE_ALARM.replicates.toLocaleString('en')} replicates of ${TILE_FALSE_ALARM.rounds.toLocaleString('en')} rounds, serial screens ${fmtRate(serialFa)}, tile bands ≤ ${fmtRate(tileFa)}, hit cells ≤ ${fmtRate(cellFa)}`);
});
step(['KENO-21'], () => {
  // Pass 2 over EVERY revealed seed of every shipped dataset (146),
  // early window = each epoch's captured nonce range
  const ep = cen.pass2.epochs;
  const mom = new Map(CONFIGS.map((c) => { const [r, n] = c.split('/'); const m = moments(r as Risk, Number(n)); return [c, { mean: Number(m.meanD) / Number(D), sd: Math.sqrt(Number(m.varD2)) / Number(D) }]; }));
  const agg = (w: 'early' | 'ref', of?: (e: typeof ep[number]) => boolean) => {
    let zs = 0, slots = 0, ret = 0, mu = 0, v = 0;
    for (const e of ep) { if (of && !of(e)) continue; for (const [c, [n, s]] of Object.entries(e[w].byConfig)) { const m = mom.get(c)!; zs += (s - n * m.mean) / m.sd; slots += n; ret += s; mu += n * m.mean; v += n * m.sd * m.sd; } }
    return { z: zs / Math.sqrt(slots), slots, zRaw: (ret - mu) / Math.sqrt(v), sdRaw: Math.sqrt(v) };
  };
  const early = agg('early'), ref = agg('ref'), earlyA = agg('early', (e) => e.set === 'A'), earlyAdded = agg('early', (e) => e.set !== 'A'); const pEarly = normalLowerTailP(early.z), pEarlyA = normalLowerTailP(earlyA.z);
  const below = ep.filter((e) => { let s = 0; for (const [c, [n, r]] of Object.entries(e.early.byConfig)) { const m = mom.get(c)!; s += (r - n * m.mean) / m.sd; } return s < 0; }).length;
  // the early window is the capture itself: its cells must equal the captured bets' served cells, per configuration, every
  // shipped bet, and each epoch's early window must be exactly its captured nonce range 1..n
  const served: Record<string, [number, number]> = {}; for (const b of P2BETS) { const c = configOf(b.request.risk, b.request.spots.length); const x = (served[c] ??= [0, 0]); x[0]++; x[1] += b.micro; }
  const earlyAll: Record<string, [number, number]> = {}; for (const e of ep) for (const [c, [n, s]] of Object.entries(e.early.byConfig)) { const x = (earlyAll[c] ??= [0, 0]); x[0] += n; x[1] += s; }
  const servedSame = Object.keys(served).length === Object.keys(earlyAll).length && Object.entries(served).every(([c, [n, s]]) => earlyAll[c]?.[0] === n && earlyAll[c]?.[1] === s);
  const seedsAll = P2SETS.flatMap(([s, d]) => d.seeds.map((sd) => ({ s, d, e: Number(sd.epoch), h: sd.hashedServerSeed })));
  const rangeOk = seedsAll.filter(({ s, d, e, h }) => { const ns = d.bets.filter((b) => b.epoch === e).map((b) => b.nonce).sort((x, y) => x - y); const c = ep.find((x) => x.set === s && x.epoch === e && x.seedHash === h);
    return !!c && ns.length > 0 && ns.every((n, i) => n === NONCE_BASE + i) && c.early.slots === ns.length && c.early.slots + c.ref.slots === SIM_PASS2_NONCES; }).length;
  const whole = ep.filter((e) => e.early.slots === SIM_PASS2_EARLY_WINDOW).length, short = ep.filter((e) => e.early.slots !== SIM_PASS2_EARLY_WINDOW);
  // detection power at 80 % for a uniform per-bet RTP deficit δ: standardized δ·Σ(1/sd)/√slots, raw δ·slots/sd_raw
  const zPow = -normalQuantile(SIM_PASS2_ALPHA) + normalQuantile(0.8);
  let inv = 0; const byRisk: Record<string, { n: number; inv: number; v: number }> = {};
  for (const b of P2BETS) { const c = configOf(b.request.risk, b.request.spots.length), m = mom.get(c)!; const sd = m.sd / MICRO_SCALE; inv += 1 / sd; const r = (byRisk[b.request.risk] ??= { n: 0, inv: 0, v: 0 }); r.n++; r.inv += 1 / sd; r.v += sd * sd; }
  const powStd = zPow * Math.sqrt(early.slots) / inv * 100, powRaw = zPow * (early.sdRaw / MICRO_SCALE) / early.slots * 100;
  const riskPow = RISKS.map((r) => `${r} ${(zPow * Math.sqrt(byRisk[r].n) / byRisk[r].inv * 100).toFixed(1)} pp`).join(', ');
  const perSet = P2SETS.map(([s]) => `${s} ${ep.filter((e) => e.set === s).length}`).join(', ');
  const depthOk = ep.length === EXPECTED_REVEALED_SEEDS && seedsAll.length === EXPECTED_REVEALED_SEEDS && rangeOk === EXPECTED_REVEALED_SEEDS && SIM_PASS2_NONCES >= FLOOR_PASS2_NONCES;
  const ok = censusSame && depthOk && servedSame && pEarly >= SIM_PASS2_ALPHA && PASS2_FALSE_ALARM.rate <= FAIL_FALSE_ALARM_CAP;
  record(21, ok, `${censusMissing() ? `census${censusMissing()}; ` : ''}every revealed seed: ${ep.length} epochs (${perSet}; ${pct(rangeOk, seedsAll.length)} bound to their dataset's seed, captured nonces and window sizes) × ${SIM_PASS2_NONCES.toLocaleString('en')} nonces (early = the captured nonce range: 1..${SIM_PASS2_EARLY_WINDOW} on ${whole} epochs${short.length ? `, ${short.map((e) => `1..${e.early.slots} on the ${e.set} epoch`).join(', ')}` : ''}; reference = the rest of 1..${SIM_PASS2_NONCES}), each slot replaying the bet played at that position (its risk and picks); scored statistic (src/sim-config.ts): the standardized early-window return of the ${early.slots} played bets, z ${early.z.toFixed(3)}, one-sided p ${pEarly.toFixed(4)} (≥ ${SIM_PASS2_ALPHA}: ${pEarly >= SIM_PASS2_ALPHA}); the Phase A seeds alone (the population before the widening, printed): z ${earlyA.z.toFixed(3)}, p ${pEarlyA.toFixed(4)} over ${earlyA.slots} bets; the ${ep.length - ep.filter((e) => e.set === 'A').length} seeds the widening added (tail, C, C $10, D) alone: z ${earlyAdded.z.toFixed(3)} over ${earlyAdded.slots} bets (printed); ${below} epochs below expectation, ${ep.length - below} at or above; reference window z ${ref.z.toFixed(3)}; the raw return (printed, not scored) early z ${early.zRaw.toFixed(3)}, reference z ${ref.zRaw.toFixed(3)}; early window == the captured bets' served cells per configuration, every shipped bet: ${servedSame}; detection power at 80 % for a uniform per-bet RTP deficit: ${powStd.toFixed(2)} pp standardized (raw return: ${powRaw.toFixed(2)} pp; standardized on one risk alone: ${riskPow} — disclosed DL-4); false-alarm rate ${PASS2_FALSE_ALARM.rate} ± ${PASS2_FALSE_ALARM.standardError} (src/false-alarm-pass2.ts, the same ${P2BETS.length} bets, ≤ ${FAIL_FALSE_ALARM_CAP})`);
});

// ═══ -22 live-sample fit (INFORMATIONAL) ═══
step(['KENO-22'], () => {
  const N = ds.bets.length, q = DRAWN / GRID, e = N * q; const bins = new Array(GRID).fill(0); for (const b of ds.bets) for (const x of b.outcome) bins[x]++;
  const tc = tileChi2(bins, N), x2 = tc.x2, chi2 = tc.chi2, pChi = tc.p;
  const order = [...ds.bets].sort((a, b) => a.idx - b.idx).map((b) => b.outcome[0]);
  const r1 = lagOneAutocorrelation(order), runs = waldsWolfowitzRunsTest(order);
  let hitsObs = 0, hitsExp = 0; for (const b of ds.bets) { hitsObs += b.hits; hitsExp += b.request.spots.length * DRAWN / GRID; }
  // the observed return of Phase A, Σ round payout / Σ round stake in exact 1e-8 units: variance, not RTP evidence
  const stA = ds.bets.reduce((s, b) => s + units8((b as any)._raw.round.stake), 0n), paA = ds.bets.reduce((s, b) => s + units8((b as any)._raw.round.payout), 0n);
  const f8 = (u: bigint) => `${u / 100000000n}.${String(u % 100000000n).padStart(8, '0')}`;
  const obsA = `Phase A observed return ${f8(paA)} paid / ${f8(stA)} staked = ${(Number(paA * 10000000n / stA) / 100000).toFixed(4)} % (variance, not RTP evidence)`;
  record(22, true, `${N} captured draws: tile chi² ${chi2.toFixed(2)} (df 39; Pearson X² ${x2.toFixed(2)} × ${TILE_CHI2_FACTOR.toFixed(4)}, the without-replacement correction) p ${pChi.toFixed(4)}; first-ball lag-1 r ${r1.toFixed(5)}; runs z ${runs.zScore.toFixed(3)} p ${runs.pValue.toFixed(4)}; hits ${hitsObs} vs ${hitsExp.toFixed(1)} expected; ${obsA} — informational (a live sample has little power and never bears the verdict)`);
});

// ═══ -31 scaling-edge / bet-size tier audit ═══
step(['KENO-31'], () => {
  // declarationTruth: the pinned config (E01, E03) carries no tier, ladder or scaling field; then every bet is priced by the one table
  const keys = (o: any, out: string[] = []): string[] => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.push(k); keys(v, out); } return out; };
  const e03 = readJson('evidence/E03-keno-limits-2026-10-12.json').answer;
  const ladderKeys = [...keys(E01), ...keys(e03)].filter((k) => /tier|ladder|scal|edge/i.test(k));
  const byStake = new Map<string, { n: number; ok: number }>();
  for (const d of ALL) for (const b of d.bets) {
    const s = seedOf(d, b.epoch)!; const k = String(b.request.amount); const x = byStake.get(k) ?? { n: 0, ok: 0 }; x.n++;
    if (isRisk(b.request.risk) && legalPicks(b.request.spots) && b.micro === microOf(b.request.risk, b.request.spots.length, hitsOf(b.request.spots, ballsOf(s.revealedServerSeed, s.clientSeed, b.nonce)))) x.ok++;
    byStake.set(k, x);
  }
  const all = [...byStake.values()].every((x) => x.ok === x.n);
  record(31, ladderKeys.length === 0 && all && byStake.size >= 3, `no bet-size ladder: the server's fairness answer (E01) and limits answer (E03) carry no tier, ladder, scaling or edge field (${ladderKeys.length} found); every bet is priced by the one published table at every stake captured: ${[...byStake.entries()].map(([k, x]) => `${k}: ${x.ok}/${x.n}`).join(', ')}`);
});

// ═══ -32 auto-pick vs manual pick ═══
step(['KENO-32'], () => {
  const code = String(E07.autoPickCode ?? '');
  const offered = /autoPick/.test(readFileSync(join(ROOT, 'evidence', 'E07-keno-bundle-paytable-autopick-2026-10-10.json'), 'utf8')) && /function \$A\(e\)/.test(code);
  const csprng = /crypto\.getRandomValues\(r\)/.test(code) && /Math\.floor\(4294967296\/e\)\*e/.test(code) && /Math\.floor\(Math\.random\(\)\*e\)/.test(code);
  const recorded = ALL.some((d) => d.bets.some((b) => 'autoPick' in (b as any) || 'autopick' in (b.request as any)));
  const detail = `the game offers an auto-pick (E07: the bundle's $A draws a partial Fisher-Yates of the 40 tiles in the browser with crypto.getRandomValues and rejection sampling, ${csprng ? 'falling back to Math.random only if crypto throws or 16 draws in a row are rejected' : 'generator not as recorded'}); its result is sent as the same "spots" field a manual pick uses, so it enters the same draw function (-17) and paytable cell (-13); no captured bet used the control (the capture's picks are a CSPRNG plan, src/loader.ts PLAN_CLASSES), so auto-pick vs manual outcomes were not compared`;
  if (!offered) record(32, true, 'no auto-pick control found in the bundle (E07)');
  else if (!csprng) record(32, false, `${detail}: the auto-pick generator is not the CSPRNG recorded in E07, an operator finding whatever the capture`);
  else if (!recorded) captureFlag(32, `${detail}: a capture gap, disclosed DL-9, verdict-neutral`);
  else record(32, true, detail);
});

// ═══ Package checks: -23, 24, 25, 27, 28, 29, 30 ═══
const manifest = input('manifest', () => (existsSync(join(ROOT, 'MANIFEST.md')) ? readFileSync(join(ROOT, 'MANIFEST.md'), 'utf8') : ''));
const readme = input('readme', () => (existsSync(join(ROOT, 'README.md')) ? readFileSync(join(ROOT, 'README.md'), 'utf8') : ''));
step(['KENO-23'], () => {
  // -23: the framework's standardized S5 matrix, by row id AND row name. The KENO profile's -23 rule names the ids
  // ("framework IDs S5-1 … S5-8") but not the eight names; those are the framework matrix's names (listed in full by the
  // framework's PLINKO-23 rule), held here as S5_NAMES, and when the vendored profile's -23 rule lists names they are read from
  // it and must equal these. The table is the block between the S5-MATRIX markers of MANIFEST.md (columns: Test ID |
  // Category | What the framework tests | Result | Tied to).
  const S5_NAMES = ['replay protection', 'input validation', 'seed integrity under adversarial input', 'cross-player isolation',
    'payout field integrity', 'nonce sequence enforcement', 'parameter boundary enforcement', 'game-specific state'];
  const ids = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `S5-${i}`);
  const rule = String((existsSync(join(ROOT, 'profile', 'profile.json')) ? readJson('profile/profile.json') : { checks: [] }).checks.find((c: any) => c.id === 'KENO-23')?.asserts ?? '');
  const idsListed = /S5-1 … S5-8/.test(rule);
  const named = rule.match(/S5-1 … S5-8 \(([^)]*)\)/)?.[1]?.split(',').map((s) => s.trim().toLowerCase()) ?? null;
  const listed = named ?? S5_NAMES, namesOk = idsListed && (named === null || JSON.stringify(named) === JSON.stringify(S5_NAMES));
  const block = manifest.match(/<!-- S5-MATRIX:START -->([\s\S]*?)<!-- S5-MATRIX:END -->/)?.[1] ?? '';
  const cells = block.split('\n').filter((l) => /^\| S5-\d+ \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const RESULT = /^(Pass|Flag|Hard Fail|Not tested)\b/;
  const rowOk = ids.map((id, i) => { const r = cells.filter((c) => c[0] === id); return r.length === 1 && cells.indexOf(r[0]) === i && r[0].length === 5
    && r[0][1].toLowerCase() === listed[i] && RESULT.test(r[0][3]) && r[0][4].length > 0; });
  const good = ids.filter((_, i) => rowOk[i]).length;
  // the printed tally separates a row that passes on every control it names from one that passes on part of them and from
  // one that is Not tested (a status that starts "Pass on" is a partial pass)
  const s5cov = (st: string[]) => { const full = st.filter((s) => /^Pass\b/.test(s) && !/^Pass on\b/.test(s)).length, part = st.filter((s) => /^Pass on\b/.test(s)).length, nt = st.filter((s) => /^Not tested\b/.test(s)).length, fl = st.filter((s) => /^Flag\b/.test(s)).length, hf = st.filter((s) => /^Hard Fail\b/.test(s)).length;
    return `${full} Pass on every control the row names, ${part} Pass on part of the controls it names, ${nt} Not tested${fl ? `, ${fl} Flag` : ''}${hf ? `, ${hf} Hard Fail` : ''}`; };
  const outside = (manifest.replace(block, '').match(/^\| S5-\d+ \|/gm) || []).length;
  record(23, namesOk && good === 8 && cells.length === 8 && outside === 0, `MANIFEST.md fairness-integrity matrix (the block between the S5-MATRIX markers): ${cells.length} rows; the vendored profile's KENO-23 rule names S5-1 … S5-8: ${idsListed}, ${named ? `and lists the names (== the framework matrix's: ${namesOk})` : 'without the names, so they are the framework matrix\'s (S5_NAMES)'}; rows S5-1 … S5-8 present once each, in order, under those names (${listed.join(', ')}), each with a result (Pass / Flag / Hard Fail / Not tested) and what it is tied to: ${good}/8${good < 8 ? ` (wrong: ${ids.filter((_, i) => !rowOk[i]).join(', ')})` : ''}; results ${s5cov(cells.map((c) => c[3] ?? ''))}; S5-n rows outside the block: ${outside}`);
});
// -24: the site-verifier module (site-verifier/derive.js, generated from src/rng.ts by scripts/build-site-verifier.mjs).
// Two legs, both needed. The pins: the file on disk has the sha256 of SITE_VERIFIER_PIN (src/artifact-pins.ts) and of its
// RELEASE-MANIFEST.json entry, and MANIFEST.md and README.md quote that sha256. The replay: the module is loaded from that
// file (never bundled into verify.js), must export what src/rng.ts exports, and every function is run side by side with
// src/rng.ts on every captured round of the five shipped datasets (both HMAC blocks, the ten balls, and the draw-to-index
// map on each of the round's ten draws); one differing result fails the check. The pins alone would pass a module that
// derives something else and was re-pinned; the replay alone would pass a file nobody pinned.
const SITE = await loadSiteModule(ROOT, SITE_VERIFIER_PIN[0]);
step(['KENO-24'], () => {
  const [file, pin] = SITE_VERIFIER_PIN;
  const relPin: string | null = (() => { try { return readJson('RELEASE-MANIFEST.json').files?.[file] ?? null; } catch { return null; } })();
  const pinOk = SITE.sha256 !== null && SITE.sha256 === pin, relOk = SITE.sha256 !== null && SITE.sha256 === relPin;
  const cited = SITE.sha256 !== null && manifest.includes(SITE.sha256) && readme.includes(SITE.sha256);
  const names = exportNames(RNG), exportsOk = !!SITE.mod && JSON.stringify(exportNames(SITE.mod)) === JSON.stringify(names);
  function* probes(): Generator<Probe> {
    for (const d of ALL) {
      for (const s of d.seeds) if (s.revealedServerSeed) yield ['sha256Hex', (m) => m.sha256Hex(s.revealedServerSeed)];
      for (const b of d.bets) {
        const s = seedOf(d, b.epoch)!;
        yield ['hmacBlock', (m) => m.hmacBlock(s.revealedServerSeed, s.clientSeed, b.nonce, 0)];
        yield ['hmacBlock', (m) => m.hmacBlock(s.revealedServerSeed, s.clientSeed, b.nonce, 1)];
        yield ['ballsOf', (m) => m.ballsOf(s.revealedServerSeed, s.clientSeed, b.nonce)];
        const bytes = Buffer.concat([RNG.hmacBlock(s.revealedServerSeed, s.clientSeed, b.nonce, 0), RNG.hmacBlock(s.revealedServerSeed, s.clientSeed, b.nonce, 1)]);
        for (let i = 0; i < DRAWN; i++) { const u = bytes.readUInt32BE(4 * i); yield ['indexFromU', (m) => m.indexFromU(u, GRID - i)]; }
      }
    }
  }
  const rounds = ALL.reduce((n, d) => n + d.bets.length, 0);
  const rp = exportsOk ? replay(RNG, SITE.mod!, probes()) : null;
  const covered = rp ? names.filter((n) => rp.byLabel[n] > 0).length : 0;
  const replayOk = !!rp && rp.differences === 0 && rp.byLabel.ballsOf === rounds && rounds === EXPECTED_BETS + EXPECTED_TAIL_BETS + EXPECTED_PHASE_C_BETS + EXPECTED_PHASE_C10_BETS + EXPECTED_PHASE_D_BETS && covered === names.length;
  record(24, pinOk && relOk && cited && exportsOk && replayOk, `${file} (generated from src/rng.ts by scripts/build-site-verifier.mjs): ${SITE.sha256 === null ? 'missing' : `sha256 ${SITE.sha256}`}; == SITE_VERIFIER_PIN in src/artifact-pins.ts: ${pinOk}; == its RELEASE-MANIFEST.json pin: ${relOk}; quoted in MANIFEST.md and README.md: ${cited}; ${SITE.mod ? `the module loaded from that file exports what src/rng.ts exports (${names.join(', ')}): ${exportsOk}` : `the module did not load (${SITE.error})`}; ${rp ? `run side by side with src/rng.ts on every captured round of the ${ALL.length} shipped datasets: ${rounds} rounds, ${rp.calls} calls (${Object.entries(rp.byLabel).map(([k, v]) => `${k} ${v}`).join(', ')}; ${covered}/${names.length} exports exercised), ${rp.differences} differing result${rp.differences === 1 ? '' : 's'}${rp.first ? ` (first: ${rp.first})` : ''}` : 'not replayed'}`);
});
step(['KENO-25'], () => {
  const need = ['Verify a bet', 'rotate', 'sha256', 'HMAC-SHA256', 'floor('];
  const has = need.filter((w) => readme.includes(w));
  record(25, has.length === need.length, `README.md "Verify a bet" carries where the seed is revealed, the fields, the commitment encoding and the draw formula: ${has.length}/${need.length} markers`);
});
const artifactBad = input('artifactBad', () => (ARTIFACT_PINS.filter(([f, h]) => !existsSync(join(ROOT, f)) || sha256File(f) !== h)));
// a status read from a record comes only from a shipped record whose sha256 RELEASE-MANIFEST.json pins (written by the
// package's own script); a missing, unpinned or edited record is a FAIL that fails the verdict (pinFail), never a pass
const CODE_FP = input('CODE_FP', () => (codeFingerprint(ROOT)));
const relFiles: Record<string, string> = input('relFiles', () => ((() => { try { return readJson('RELEASE-MANIFEST.json').files ?? {}; } catch { return {}; } })()));
const pinnedRecord = (rel: string): { obj: any; why: string } => {
  if (!existsSync(join(ROOT, rel))) return { obj: null, why: `${rel} missing` };
  if (!relFiles[rel]) return { obj: null, why: `${rel} not pinned in RELEASE-MANIFEST.json` };
  if (sha256File(rel) !== relFiles[rel]) return { obj: null, why: `${rel} differs from its RELEASE-MANIFEST.json pin` };
  let obj: any; try { obj = JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); } catch { return { obj: null, why: `${rel} unreadable` }; }
  // the record must carry the fingerprint of the code and data it ran against, and it must be this one
  if (obj.codeSha256 !== CODE_FP) return { obj: null, why: `${rel} ran against other code or data (fingerprint ${String(obj.codeSha256).slice(0, 12)}…, now ${CODE_FP.slice(0, 12)}…)` };
  return { obj, why: '' };
};
step(['KENO-28'], () => {
  const { obj: fc, why } = pinnedRecord('outputs/fresh-copy.json');
  // the standalone bundle: STANDALONE.json pins every source of verify.js and verify.js itself (verify.js also refuses to run stale)
  const sm = existsSync(join(ROOT, 'STANDALONE.json')) ? readJson('STANDALONE.json') : null;
  const srcs = sm ? Object.entries(sm.sources as Record<string, string>) : [];
  const stale = srcs.filter(([q, h]) => !existsSync(join(ROOT, q)) || sha256Bytes(readFileSync(join(ROOT, q))) !== h).map(([q]) => q);
  const unpinned = [...readdirSync(join(ROOT, 'src')).filter((x) => x.endsWith('.ts')).map((x) => 'src/' + x), 'tests/verify.ts'].filter((q) => !sm || !(q in sm.sources));
  const outOk = !!sm && existsSync(join(ROOT, 'verify.js')) && sha256Bytes(readFileSync(join(ROOT, 'verify.js'))) === sm.output['verify.js'] && /STALENESS GUARD/.test(readFileSync(join(ROOT, 'verify.js'), 'utf8'));
  const bundleOk = !!sm && stale.length === 0 && unpinned.length === 0 && outOk;
  const bundle = sm ? `verify.js built from the current sources (STANDALONE.json: every src/*.ts and tests/verify.ts pinned ${unpinned.length === 0}, unchanged ${stale.length === 0}${stale.length ? ` — stale: ${stale.join(', ')}` : ''}; verify.js == its pinned output and carries the staleness guard ${outOk})` : 'STANDALONE.json missing (npm run build:standalone)';
  // the fresh copy must reproduce the committed record's verdict with that verdict's
  // exit code (0, 2 or 5 for a releasable package), not only a Full Pass
  const committedVerdict = (() => { try { return JSON.parse(readFileSync(join(ROOT, 'outputs', 'verification-results.json'), 'utf8')).verdict; } catch { return null; } })();
  const ok = !!fc && fc.verdict === committedVerdict && fc.exit === exitOfVerdict(committedVerdict) && fc.standaloneExit === fc.exit && fc.beyondTolerance === 0 && fc.pinnedUnchanged === true && bundleOk && AUDIT_ID !== null;
  record(28, ok, `${fc ? `the shipped fresh-copy record (outputs/fresh-copy.json, pinned in RELEASE-MANIFEST.json, written by npm run gate:fresh on Node ${fc.node}, its code fingerprint == this code and data; verdict == the committed record's "${committedVerdict}" with its exit ${exitOfVerdict(committedVerdict)}: ${fc.verdict === committedVerdict && fc.exit === exitOfVerdict(committedVerdict)}): RNG tests exit ${fc.rngTestsExit}, verify exit ${fc.exit} "${fc.verdict}", standalone verify.js exit ${fc.standaloneExit}, regeneration vs committed ${fc.beyondTolerance} fields beyond tolerance, pinned artifacts unchanged ${fc.pinnedUnchanged}` : `no usable fresh-copy record: ${why}`}; ${bundle}; audit ID ${AUDIT_ID ?? 'NOT ASSIGNED (pending, assigned by ProvablyFair.org)'}`);
  if (!fc && !why.includes('ran against other code')) pinFail(`${P}-28`, why);   // missing, unpinned or edited: FAIL, verdict-bearing (a record of other code stays a GAP)
});
step(['KENO-29'], () => {
  const { obj: mr, why } = pinnedRecord('outputs/mutation-results.json');
  // the record is also checked against the registry it claims to be the run of: same ids, counts re-derived from its own rows
  const regText = readFileSync(join(ROOT, 'tests', 'mutations.json')); const reg = JSON.parse(regText.toString('utf8'));
  const scoredIds = SCORED_IDS;   // from profile/profile.json
  let consistent = false, det = `no usable mutation record: ${why}`;
  if (mr) {
    const ids = (mr.results ?? []).map((r: any) => r.id).sort().join(','), regIds = reg.mutations.map((m: any) => m.id).sort().join(',');
    const killed = (mr.results ?? []).filter((r: any) => r.killed).length;
    const uncovered = scoredIds.filter((id) => !(mr.results ?? []).some((r: any) => r.kills === id && r.killed));
    consistent = mr.registrySha256 === sha256Bytes(regText) && ids === regIds && mr.total === reg.mutations.length && mr.killed === killed && JSON.stringify(uncovered) === JSON.stringify(mr.uncoveredSteps);
    det = `the shipped battery record (outputs/mutation-results.json, pinned in RELEASE-MANIFEST.json, written by npm run mutate): ${mr.killed}/${mr.total} mutations killed by their named step under the kill rule (its status differs from an unmutated copy); undeclared survivors ${mr.survivors.filter((s: any) => !s.limitation).length}; scored checks with no killing mutation: ${uncovered.join(', ') || 'none'}; record == the run of tests/mutations.json as it is now (registry sha256, ids, counts re-derived from its rows): ${consistent}; the record's code fingerprint == this code and data (scripts/fingerprint.mjs): true`;
  }
  record(29, !!mr && consistent && mr.survivors.filter((s: any) => !s.limitation).length === 0 && mr.uncoveredSteps.length === 0, det);
  if (!mr && !why.includes('ran against other code')) pinFail(`${P}-29`, why);   // missing, unpinned or edited: FAIL, verdict-bearing (a record of other code stays a GAP)
});
step(['KENO-30'], () => {
  const dl = (manifest.match(/^\| DL-\d+ \|/gm) || []).length;
  const prem = /Could the data contradict it\?/.test(manifest);
  const ev = EVIDENCE_PINS.every(([f]) => manifest.includes(f.split('/').pop()!));
  record(30, dl > 0 && prem && ev, `MANIFEST.md: ${dl} declared-limitation rows; load-bearing premises with "Could the data contradict it?": ${prem}; every exhibit E01…E${String(EVIDENCE_PINS.length).padStart(2, '0')} listed by file name: ${ev}`);
});

// KENO-27 runs last, after every check the committed record holds has its row, so its comparison sees the whole record
step(['KENO-27'], () => {
  const gi = existsSync(join(ROOT, '.gitignore')) ? readFileSync(join(ROOT, '.gitignore'), 'utf8') : '';
  const unignored = ARTIFACT_PINS.every(([f]) => gi.includes('!' + f));
  const noMeta = ARTIFACT_PINS.every(([f]) => existsSync(join(ROOT, f)) && !/"(runAt|generatedAt|timestamp|hostname|nodeVersion)"/.test(readFileSync(join(ROOT, f), 'utf8')));
  const cfRec = join(ROOT, 'outputs', 'verification-results.json');
  const recDiffs = existsSync(cfRec) ? beyondTolerance(fieldDiff(JSON.parse(readFileSync(cfRec, 'utf8')), recordOf())).length : -1;
  record(27, artifactBad.length === 0 && unignored && noMeta && censusSame && gate.tableMatches && recDiffs === 0,
    `${ARTIFACT_PINS.length - artifactBad.length}/${ARTIFACT_PINS.length} artifacts match the sha256 pinned in src/artifact-pins.ts${artifactBad.length ? ` (mismatch: ${artifactBad.map(([f]) => f).join(', ')})` : ''}; un-ignored by name in .gitignore: ${unignored}; no run metadata: ${noMeta}; census regenerated == committed: ${censusSame}${censusMissing()}; RTP table regenerated == committed: ${gate.tableMatches}; verify writes only outputs/run/; committed outputs/verification-results.json vs this run: ${recDiffs < 0 ? 'absent' : `${recDiffs} fields beyond tolerance`}`);
});

finish();

/** The exit code rtpClaimVerdict gives a verdict line (KENO-28 and scripts/fresh-copy-check.mjs use the same map). */
function exitOfVerdict(v: string | null): number | null {
  if (!v) return null; if (v.startsWith('NOT PROVABLY FAIR')) return 1; if (v.startsWith('INCOMPLETE')) return 3; if (v.startsWith('RTP FIGURE OVERSTATED')) return 5;
  if (v === 'PROVABLY FAIR — Conditional Pass') return 2; if (v === 'PROVABLY FAIR — Full Pass') return 0; return null;
}
function finish() {
  applyTaint();
  bindToProfile();
  const order = (id: string) => Number(id.split('-')[1]);
  rows.sort((a, b) => order(a.id) - order(b.id));
  const scored = rows.filter((r) => r.policy === 'HARD_FAIL' || r.policy === 'FLAG');
  const fails = scored.filter((r) => r.status === 'FAIL').length;
  const absent = scored.filter((r) => r.status === 'ABSENT').map((r) => r.id);
  const opFlags = scored.filter((r) => r.status === 'FLAG' && r.origin === 'operator').length;
  const over = scored.filter((r) => r.status === 'OVERSTATED').length;
  const capFlags = scored.filter((r) => r.status === 'FLAG' && r.origin === 'capture').length;
  const passes = scored.filter((r) => r.status === 'PASS').length;
  const v = verdictExit(rows, extraFails());
  const why = [absent.length ? `scored checks with no status: ${absent.join(', ')}` : '', binding.ok ? '' : `profile binding: ${binding.issues.join('; ')}`].filter(Boolean).join('; ');
  const verdict = v.verdict === 'INCOMPLETE' ? `INCOMPLETE — ${why}` : v.verdict;
  const pkg = rows.filter((r) => r.policy === 'GRADED' || r.policy === 'RELEASE_GATE');
  console.log(`HouseBets House Games keno (new engine) — verification (profile ${P} ${PROFILE_VERSION} ${binding.sha ? binding.sha.slice(0, 12) + '…' : 'ABSENT'}, ${rows.length} checks)`);
  for (const r of rows) console.log(`  ${r.id.padEnd(8)} ${(r.status + (r.origin === 'capture' ? '*' : '')).padEnd(6)} ${r.policy.padEnd(13)} ${r.name.padEnd(46)} ${r.detail}`);
  console.log(`  (* capture-origin FLAG: disclosed, verdict-neutral)`);
  console.log(`scored checks (HARD_FAIL + FLAG): ${passes} PASS, ${fails} FAIL, ${over} OVERSTATED, ${opFlags} operator FLAG, ${capFlags} capture FLAG of ${scored.length}; informational ${rows.filter((r) => r.status === 'INFO').length}; package checks ${pkg.filter((r) => r.status === 'PASS').length}/${pkg.length} PASS (${pkg.filter((r) => r.status === 'GAP').map((r) => r.id).join(', ') || 'no gaps'})`);
  console.log(`profile binding: ${SCORED_IDS.length - absent.length} of the profile's ${SCORED_IDS.length} scored checks have a status from this run${absent.length ? `; ABSENT: ${absent.join(', ')}` : ''}`);
  console.log(`profile binding (vendored profile): ${PROFILE_FILE} sha256 ${binding.sha ?? 'absent'} == the cited ${PROFILE_SHA256.slice(0, 12)}…, the scored list and every policy taken from it, src/profile-map.ts rows identical: ${binding.ok}${binding.ok ? '' : ' — ' + binding.issues.join('; ')}`);
  const failOutside = rows.filter((r) => r.status === 'FAIL' && r.policy !== 'HARD_FAIL' && r.policy !== 'FLAG').map((r) => r.id);
  if (failOutside.length) console.log(`FAIL outside the scored checks (verdict-bearing): ${failOutside.join(', ')}`);
  if (RUN_ERRORS.length) console.log(`run errors (${RUN_ERRORS.length}; any one fails the verdict): ${RUN_ERRORS.join(' | ')}`);
  console.log(`VERDICT: ${verdict}`);
  // the run record (outputs/run/ only) and its comparison with the committed record — verdict-bearing rows only
  // The committed record excludes -27 (the check of the record's own pin), so committing it settles on one pin.
  const rec = recordOf();
  mkdirSync(join(ROOT, 'outputs', 'run'), { recursive: true });
  writeFileSync(join(ROOT, 'outputs', 'run', 'verification-results.json'), JSON.stringify(rec, null, 2) + '\n');
  const cf = join(ROOT, 'outputs', 'verification-results.json');
  if (existsSync(cf)) {
    const diffs = beyondTolerance(fieldDiff(JSON.parse(readFileSync(cf, 'utf8')), rec));
    console.log(`Reproduction vs the committed outputs/verification-results.json on Node ${process.versions.node}: ${diffs.length === 0 ? 'REPRODUCED' : `DIFFERS (${diffs.length} fields, e.g. ${diffs.slice(0, 2).map((d: any) => d.path).join(', ')})`}`);
  }
  console.log(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exitCode = v.exit;
}

/** The verification record (13 Oct): every scored check except -27 (which compares this record with the committed one)
 *  plus the informational one, in check order. Built here so -27 and finish() write and compare the same object. */
function recordOf() {
  const order = (id: string) => Number(id.split('-')[1]);
  // every package check (GRADED / RELEASE_GATE) is recorded too, except KENO-28, KENO-29: they attest this record itself
  // (KENO-28 and KENO-29 read gate records bound to sources that pin it), so verify prints them and does not record them
  const pkgRows = rows.filter((r) => (r.policy === 'GRADED' || r.policy === 'RELEASE_GATE') && !['KENO-28', 'KENO-29'].includes(r.id));
  const sorted = [...rows].sort((a, b) => order(a.id) - order(b.id));
  const scored = sorted.filter((r) => r.policy === 'HARD_FAIL' || r.policy === 'FLAG');
  // a scored id with no row yet (and not added by bindToProfile) counts as ABSENT in the record too
  const recRows = scored.filter((r) => r.id !== `${P}-27`).concat(SCORED_IDS.filter((id) => id !== `${P}-27` && !scored.some((r) => r.id === id))
    .map((id) => ({ id, name: prof(id).name, policy: prof(id).policy, status: 'ABSENT' as Status, detail: 'no status from this run (step deleted, skipped or aborted)' })))
    .sort((a, b) => order(a.id) - order(b.id));
  const rf = recRows.filter((r) => r.status === 'FAIL').length, ro = recRows.filter((r) => r.status === 'FLAG' && r.origin === 'operator').length;
  const recVerdict = verdictOf(recRows);
  const rec = { suite: 'housebets-keno', profileSha256: binding.sha ?? 'absent', verdict: recVerdict,
    summary: { passes: recRows.filter((r) => r.status === 'PASS').length, fails: rf, overstated: recRows.filter((r) => r.status === 'OVERSTATED').length, operatorFlags: ro, captureFlags: recRows.filter((r) => r.status === 'FLAG' && r.origin === 'capture').length, packageChecks: pkgRows.length, excluded: [`${P}-27`] },
    steps: [...recRows.concat(sorted.filter((r) => r.policy === 'INFORMATIONAL')), ...pkgRows].sort((a, b) => order(a.id) - order(b.id)).map((r) => ({ id: r.id, status: r.status, origin: r.origin ?? null, detail: r.detail })) };
  return rec;
}
