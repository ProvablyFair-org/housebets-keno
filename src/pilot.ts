// the same-account, same-engine keno rounds the account ledger holds that this package's datasets do not — the first
// capture of 12 Oct 2026 (the workshop's capture-2026-10-12/keno2/housebets-keno2-sp1-480bets.json, made before the planned
// full capture and not part of the capture plan this package audits). The file is NOT shipped; this script, run on it,
// recomputes every round with this package's own derivation and paytable and prints the counts the MANIFEST quotes.
//   npm run pilot -- <path to housebets-keno2-sp1-480bets.json>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ballsOf, sha256Hex } from './rng.ts';
import { units8, hitsOf, microOf, payout8, isRisk, legalPicks } from './rules.ts';
import { ROOT, PILOT_FILE, PILOT_SHA256 } from './loader.ts';

const path = process.argv[2];
if (!path) { console.error('usage: npm run pilot -- <path to the workshop pilot file>'); process.exit(2); }
const bytes = readFileSync(path); const sha = createHash('sha256').update(bytes).digest('hex');
const d = JSON.parse(bytes.toString('utf8'));
const seeds: any[] = d.seeds, bets: any[] = d.bets;
const seedOf = (e: number) => seeds.find((s) => Number(s.epoch) === e);
const same = (a: readonly number[], b: readonly number[] | undefined) => !!b && a.length === b.length && a.every((x, i) => x === b[i]);
let commit = 0, links = 0, draws = 0, pays = 0, raw = 0, nonces = 0;
for (const s of seeds) if (sha256Hex(s.revealedServerSeed) === s.hashedServerSeed) commit++;
for (let i = 0; i + 1 < seeds.length; i++) if (seeds[i].hashedNextServerSeed === seeds[i + 1].hashedServerSeed) links++;
const anchor = d.preCapture?.hashedNextServerSeed === seeds[0].hashedServerSeed;
for (const s of seeds) { const ns = bets.filter((b) => b.epoch === Number(s.epoch)).map((b) => b.nonce).sort((a, b) => a - b); if (ns.every((n, i) => n === i + 1) && ns.length === Number(s.serverNonceAtRotation)) nonces++; }
for (const b of bets) {
  const s = seedOf(b.epoch); const g = b._raw?.game ?? {}, f = g.fairness ?? {}, r = b._raw?.round ?? {};
  if (!s) continue;
  const balls = ballsOf(s.revealedServerSeed, s.clientSeed, b.nonce);
  if (same(balls, b.outcome) && same(balls, g.balls)) draws++;
  const risk = b.request.risk, picks = b.request.spots;
  if (isRisk(risk) && legalPicks(picks)) {
    const h = hitsOf(picks, balls), m = microOf(risk, picks.length, h), want = payout8(units8(b.request.amount), m);
    if (g.hits === h && g.micro === m && want === units8(b.payout) && want === units8(g.payout) && want === units8(r.payout)) pays++;
  }
  if (f.nonce === b.nonce && f.hashedServerSeed === s.hashedServerSeed && f.clientSeed === s.clientSeed) raw++;
}
const at = bets.map((b) => String(b.at)).sort();
const e5 = readFileSync(join(ROOT, 'evidence', 'E05-account-reconcile-2026-10-13.txt'), 'utf8');
const row = e5.split('\n').find((l) => l.includes('/' + PILOT_FILE));
const e5Rounds = row ? Number(row.trim().split(/\s+/)[1]) : null;
console.log(`pilot ${PILOT_FILE} sha256 ${sha} (== the pin in src/loader.ts: ${sha === PILOT_SHA256})`);
console.log(`  ${bets.length} rounds on ${seeds.length} seed pairs, first ${at[0]}, last ${at[at.length - 1]}`);
console.log(`  revealed seeds hash to their commitments ${commit}/${seeds.length}; chain links ${links}/${seeds.length - 1}, pre-capture anchor ${anchor}; nonces 1..N == the server's count ${nonces}/${seeds.length} pairs`);
console.log(`  draws recompute in draw order ${draws}/${bets.length}; hits, paytable cell and payout recompute (bet, game answer, round record) ${pays}/${bets.length}; the server's own answer (nonce, seed hash, client seed) == the epoch's ${raw}/${bets.length}`);
console.log(`  E05 row for this file: ${e5Rounds} rounds (${e5Rounds === bets.length ? 'equal' : 'DIFFERENT'})`);
const ok = sha === PILOT_SHA256 && commit === seeds.length && links === seeds.length - 1 && anchor && nonces === seeds.length && draws === bets.length && pays === bets.length && raw === bets.length && e5Rounds === bets.length;
console.log(ok ? 'PILOT RECOMPUTES' : 'PILOT DOES NOT RECOMPUTE');
process.exitCode = ok ? 0 : 1;
