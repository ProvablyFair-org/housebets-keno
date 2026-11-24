// RTP-CLAIM wiring — HouseBets keno: the per-configuration exact RTP table and the claim it is held to.
// The rule is src/rtp-claim.ts, a byte-identical copy of the framework's core/rtp-claim.ts (conformance C-13 compares the
// SHA-256), version 1.2.0. The switch src/rtp-claim-switch.ts is ON (Methodology v1.1, 14 Oct 2026): the -19 check is
// scored; a house-side miss is OVERSTATED and the verdict RTP FIGURE OVERSTATED (exit 5), never NOT PROVABLY FAIR.
//
// SETTINGS. Every (risk, picks) configuration: 4 risks × 1..10 picks = 40 (E01 paytables). The draw does not depend on which
// tiles are picked (KENO-17), so a configuration's RTP covers every pick set of that size.
// EXACT RTP. Σ_k P(k hits | n picks) × micro_k / 10^6 with P hypergeometric on 40 tiles and 10 drawn,
// P = C(n,k)·C(40−n,10−k) / C(40,10) (KENO-18), as an exact rational over C(40,10) × 10^6.
// CLAIM. Read at run time from the pinned exhibits, never from a constant, as a
// per-setting claim: each configuration is held to the highest figure any place states for it — the flat "99%" of E01
// "return", E02 rulesReturn and E02 rulesReturnLine (and their 16 Oct rewording, E08), or E01's own per-row figure (paytables[risk][n − 1].rtp) where that is
// higher (src/exhibits.ts publishedRtp). The source names each place and says how it was read: in the game's answers and
// code, not on a rendered page.
//   npm run rtp-claim:write    rewrite outputs/rtp-claim-table.json and print its SHA-256 to pin
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RtpClaimAccumulator, rtpClaimTable, rtpClaimGate } from './rtp-claim';
import type { RtpClaim, RtpClaimResult, RtpClaimGate } from './rtp-claim';
import { RISKS, PICKS_MAX, MICRO_SCALE } from './spec.ts';
import { publishedRtp } from './exhibits.ts';
import { D, hitWeight, microOf } from './rules.ts';
import { ROOT } from './loader.ts';

/** The claim, built from the exhibits (pin-checked by KENO-26 before verify calls this). */
export function rtpClaim(): RtpClaim {
  const pub = publishedRtp();
  return {
    kind: 'per-setting',
    figures: pub.figures,
    source: `HouseBets keno, stated for every configuration in ${pub.places.length} places and per row in one more, each read in the game's answers or code, `
      + `none on a rendered page (P-2): in the game settings the site loads — the fairness answer, ${pub.places[0].where}: "${pub.places[0].text}", `
      + `requested by the live game bundle (platform-housegames-keno2-game.js sha256 7afa2e0bf9f0ac99…, the file E02 and E07 cite: br("/"+je+"/fairness")), `
      + `and its per-row figure paytables[risk][picks − 1].rtp; and in the rules — the game page rules panel in that bundle (the live page's script `
      + `tag names this file, bundles/LIVE-BUNDLES.md 10 Oct 2026; E08 is the same URL's copy of 19 Oct, last-modified 16 Oct, `
      + `after HouseBets reworded the two return lines), ${pub.places.slice(1).map((p) => `${p.where}: "${p.text}"`).join('; ')}. `
      + `Each configuration is held to the highest figure stated for it: the flat ${pub.flat}${pub.agree ? ' (the places agree)' : ' (THE PLACES DISAGREE: ' + pub.places.map((p) => p.rtp).join(', ') + ')'}`
      + `${pub.rowsAbove.length ? `, or the higher E01 row figure for ${pub.rowsAbove.join('; ')}` : ' (no E01 row figure is higher)'}.`,
  };
}
export const RTP_CLAIM_TABLE = join(ROOT, 'outputs', 'rtp-claim-table.json');
/** SHA-256 of the committed table — re-pin with the run that rewrote it (npm run rtp-claim:write). */
export const RTP_CLAIM_TABLE_SHA256 = '064da81bb7c8c8c029b666f384f23b447d97a101bba3f6e3fa90f0e0b9e4947b';

/** The exact RTP of (risk, n picks) as [numerator, denominator]. */
export function configRtp(risk: (typeof RISKS)[number], n: number): [bigint, bigint] {
  let num = 0n; for (let k = 0; k <= n; k++) num += hitWeight(n, k) * BigInt(microOf(risk, n, k));
  return [num, D * BigInt(MICRO_SCALE)];
}

export function computeRtpClaim(): RtpClaimResult {
  const acc = new RtpClaimAccumulator(rtpClaim());
  for (const risk of RISKS) for (let n = 1; n <= PICKS_MAX; n++) { const [num, den] = configRtp(risk, n); acc.add(`${risk}, ${n} pick${n > 1 ? 's' : ''}`, num, den, risk); }
  return acc.result();
}

export function rtpClaimTableText(r: RtpClaimResult): string {
  return rtpClaimTable(r, {
    package: 'housebets/keno', game: 'keno',
    settingSpace: 'every (risk, picks) configuration (40): classic, low, medium, high × 1..10 picks',
    rtpMethod: 'exact rational: Σ_k C(n,k)·C(40−n,10−k)/C(40,10) × micro_k/10^6 over the published paytable (E01)',
  });
}

export function runRtpClaimGate(): RtpClaimGate {
  const r = computeRtpClaim();
  return rtpClaimGate(r, rtpClaimTableText(r), RTP_CLAIM_TABLE, RTP_CLAIM_TABLE_SHA256);
}

if (process.argv[1] && /rtp-settings\.ts$/.test(process.argv[1])) {
  const text = rtpClaimTableText(computeRtpClaim());
  writeFileSync(RTP_CLAIM_TABLE, text);
  console.log(`wrote outputs/rtp-claim-table.json sha256 ${createHash('sha256').update(text).digest('hex')}`);
}
