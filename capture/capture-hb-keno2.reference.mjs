#!/usr/bin/env node
// Reference copy; the as-run copy was not kept. The capture recorded capture-hb-keno2.mjs sha256 fc8bbe919e60800507166e78f7cb64b9cb14a279fa1cbb40c9ae07533bc8b6fc in the as-captured
// file's meta (meta.captureScript); this copy is made from the rig's later file (sha256 377889eee301749d3f4b45566edae89dcf245576aadf5b00a4d33ae338090048), which does not hash to it.
// Published so the capture method can be read; no step of this package reads or runs it. Code unchanged; comments
// redacted (people's names, a quote, another audit's details, internal file paths).
/* ============================================================================
 *  HouseBets House Games (new engine) — KENO (keno2) capture  ·  ProvablyFair.org
 *  Written 2026-10-10. NOT RUN against the site by its author; the auditor runs every capture.
 *  Endpoints and fields: quoted from the game page's bundle platform-housegames-keno2-game.js (sha256 7afa2e0b…9089),
 *  the bundle the live keno page loaded.
 *
 *   POST /housegames/keno2/bet {generation, amount, risk, spots, currency}
 *   spots = 1..10 distinct integers 0..39 (bundle Uo/Bd: n<0||n>=40 rejected); risk "classic"|"low"|"medium"|"high" (bundle wt)
 *
 *  PLAN: 4 risks × 1..10 spots = 40 cells × 12 = 480 rounds at the minimum stake; spots a CSPRNG sample of 0..39.
 *  SETUP / OPTIONS: as the dice capture script of the same rig
 *  PHASES (12 Oct, hb-sp-core; no --phase = Phase A, unchanged):
 *   --phase=C  200 bets on PHASE_C (below) at 100 × the minimum. PHASE_C = the (risk, spots) config with the highest
 *              probability of a non-zero payout in the paytable, computed by the rig's offline
 *              verifier → low/1 and medium/1 both pay on every bet (P = 1);
 *              the tie goes to the lower payout variance (low/1 0.2523 < medium/1 1.0443). The rig's verifier recomputes
 *              the choice and fails a Phase C dataset played on any other config.
 *   --phase=D --client-seeds=s1,s2,s3,s4 [--empty-seed-control]  4 × 50 at the minimum, Phase A settings
 * ==========================================================================*/
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { runCapture, shuffle, sample } from '../common/hb-sp-core.mjs';

const RISKS = ['classic', 'low', 'medium', 'high'];
const BOARD = Array.from({ length: 40 }, (_, i) => i);
// Phase C config: from the rig's offline verifier (paytable micro-units, low row 1 = [700000, 1860000]):
// pays 0.70× on 0 hits (P 30/40 = 0.75) and 1.86× on 1 hit (P 10/40 = 0.25); P(non-zero payout) = 1
const PHASE_C = { risk: 'low', spots: 1, pNonZeroPayout: 1, pPayAboveStake: 0.25 };
const adapter = {
  game: 'keno2', gameType: 'keno2', betPath: '/keno2/bet', limitsSlug: 'keno2', fairnessSlug: 'keno2', seedPrefix: 'pfkeno', extraGets: [],
  scriptFile: fileURLToPath(import.meta.url),
  planDoc: '480 = 4 risks × spots 1..10 × 12; spots a CSPRNG sample of 0..39',
  buildPlan() {
    const plan = [];
    for (const r of RISKS) for (let p = 1; p <= 10; p++) for (let i = 0; i < 12; i++) plan.push({ cls: `${r}-${p}`, risk: r, spots: sample(BOARD, p) });
    return shuffle(plan);
  },
  probePlan: () => [{ cls: 'classic-1', risk: 'classic', spots: sample(BOARD, 1) }, { cls: 'high-10', risk: 'high', spots: sample(BOARD, 10) }],
  // supplementary phases (used only with --phase)
  phases: {
    C: { count: 200, setting: { risk: PHASE_C.risk, spots: PHASE_C.spots },
      entry: () => ({ cls: `C-${PHASE_C.risk}-${PHASE_C.spots}`, risk: PHASE_C.risk, spots: sample(BOARD, PHASE_C.spots) }),
      doc: `Phase C: 200 bets = 4 epochs × 50 on risk ${PHASE_C.risk}, ${PHASE_C.spots} spot (a CSPRNG sample of 0..39 per bet), stake 100 × the minimum; ` +
        `the config with the highest probability of a non-zero payout in the hbverify paytable: P = ${PHASE_C.pNonZeroPayout} (tie with medium/1, broken by the lower payout variance); ` +
        `P(payout > stake) = ${PHASE_C.pPayAboveStake}` },
    D: { doc: 'Phase D: one epoch of 50 bets per player-set client seed (--client-seeds, in order) at the minimum stake; settings drawn from a fresh Phase A plan (CSPRNG)' },
  },
  stakeOf: (_e, base) => base,
  // bundle Td.bet: o={generation:r, amount:e.amount, risk:e.risk, spots:e.spots, currency:a}
  body: (e, base, currency) => ({ generation: randomUUID(), amount: base, risk: e.risk, spots: e.spots, currency }),
  // bundle answer checks Cd()/eg(): game.{roundId, active:false, risk, spots, balls[10], hits, micro, multiplier, stake, payout,
  // outcome, fairness.{version, hashedServerSeed, nonce}} (+ fairness.clientSeed read by the history), round.{roundId, stake, payout}, balance
  extract(o, e) {
    const d = (o && o.game) || {}, f = d.fairness || {}, r = (o && o.round) || {};
    return {
      outcome: d.balls ?? null, echoedSpots: d.spots ?? null, echoedRisk: d.risk ?? null, hits: d.hits ?? null, micro: d.micro ?? null,
      payoutMultiplier: d.multiplier ?? null, payout: d.payout ?? null, gameStake: d.stake ?? null, resultWord: d.outcome ?? null,
      nonce: f.nonce ?? null, respClientSeed: f.clientSeed ?? null, respHashedSeed: f.hashedServerSeed ?? null, fairnessVersion: f.version ?? null,
      roundId: d.roundId ?? null, roundPayout: r.payout ?? null, roundStake: r.stake ?? null, balance: o ? o.balance ?? null : null,
      sameSetting: d.risk != null ? d.risk === e.risk : null,
    };
  },
};
runCapture(adapter, dirname(fileURLToPath(import.meta.url))).catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
