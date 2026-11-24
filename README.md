# HouseBets Keno — Provably Fair Audit (new engine, October 2026)

**Auditor:** [ProvablyFair.org](https://www.provablyfair.org) · **Audit ID:** PF-2026-HB05 · **Release:** `v1.0.0` · **Capture:** 12–13 October 2026

**Result: PROVABLY FAIR — Full Pass.** `node verify.js` scores the framework's KENO profile: 23 of 24 scored checks PASS
and one capture-origin FLAG, which is disclosed and does not move the verdict (KENO-32: the game's auto-pick was not used,
MANIFEST.md DL-9); 0 FAIL, KENO-22 informational. KENO-14 passes with the max-win refusal declared but never exercised
(DL-7). All 7,278 captured bets recompute exactly from `(serverSeed, clientSeed, nonce)`: the ten balls in
their draw order, the hits, the paytable cell and the payout. All 7 package checks PASS; KENO-24 runs the ProvablyFair.org
verifier module shipped here (`site-verifier/derive.js`) side by side with `src/rng.ts` on every captured bet.
KENO-16 (wallet reconciliation) passes on the platform's bet history and the account reconciliation; the comparison of consecutive balances the profile describes was not possible in this capture, because other games were captured on the same account at the same time (MANIFEST.md DL-8).

**Theoretical RTP: 99 % to within one millionth on every paytable.** The 40 paytables (4 risks × 1–10 picks) return from
98.999972 % (classic, 7 picks) to 99.000000 % before the payout is rounded down to 0.00000001, each exactly the fraction HouseBets publishes for it; HouseBets states 99 %.
These figures take every set of 10 drawn numbers as equally likely; the published draw map is within 2^-32 of equal at each
of the 10 draw steps and not exactly equal (KENO-08, worst deviation 2.07 × 10^-10), and that difference is not carried
into them.
Theoretical RTP is not a promise about the return of any session.

**Scope:** HouseBets House Games Keno (`keno2`: 40 tiles, 10 drawn, 1 to 10 picks, four risks; fairness version
`canonical`), USDT wallet. One audit account, in a logged-in browser session, placed every bet through the game's own API on
12–13 October 2026. HouseBets' own verify screen was not captured,
and the only adversarial request the capture sent was an empty client seed (refused; MANIFEST.md DL-12); the
fairness-integrity tests, run separately on HouseBets' running service by ProvablyFair.org, are in the ProvablyFair.org
report for this game, Section 5 (Fairness Integrity Testing).

[Audit report](https://audit.provablyfair.org/casino/housebets/games/keno/overview) · [Public repository](https://github.com/ProvablyFair-org/housebets-keno) · [MIT license](LICENSE) · full write-up: [MANIFEST.md](MANIFEST.md)

## What was verified

| Check | Captured evidence |
|---|---|
| Bets | 6,650 Phase A bets at the platform minimum stake (0.01000311 USDT) in 133 seed pairs of 50, all 40 configurations (163 to 168 bets each); 200 bets at 100 × the minimum and 200 at $10, both on low risk with one pick; 200 under four auditor-typed client seeds; the 28 bets of the capture's short last pair (MANIFEST.md DL-1). 7,278 in all |
| Recomputation | the ten balls in draw order, the hits, the paytable cell and the payout of every bet, against HouseBets' published algorithm and paytables (E01), the rules on the game page (E02) and the paytable the game page carries (E07): 7,278/7,278 |
| Second implementation | an independent rebuild of the draw, the settlement and the RTP, written in Python from E01 independently of this package's code, runs in `npm test` and reproduces 7,278/7,278 bets and 40/40 paytable RTPs (MANIFEST.md, Game and algorithm) |
| Commitments | 146/146 revealed seeds hash to the commitment shown before their bets; the next-seed chain links from a pre-capture read |
| Platform records | every bet in the platform's own bet history (E04) and the account's wallet reconciliation (E05) |
| Theoretical RTP | 40/40 paytables equal E01's exact fractions, held to the 99 % published (RTP-CLAIM 1.2.0: PASS, 0 configurations beyond the 0.1 pp band) |
| Simulation | Pass 1: 10 streams of 1,000,000 rounds from fixed seeds, one stream per pick count on its own seeds (10,000,000 rounds; the four risk levels of a pick count settle on its stream), re-run in full by every `verify`; Pass 2: every revealed seed (146) replayed over 10,000 nonces, early-window z −1.693, p 0.0452 (the rule fails below p 0.01) |
| Observed return | Phase A 89.6357 % (59.62628271 paid on 66.52068150 staked; variance, not RTP evidence) |

Datasets (sha256, pinned in `src/loader.ts`):

- `data/housebets-keno-phaseA-6650bets.json` — `6b2d29f0d155deb79639e35f8307d39b11d1e1d308b9939bc451b70673ffff6f`
- `data/housebets-keno-phaseA-tail-28bets.json` — `4922dcd5549517197f54137e60faf2864f89c896ad594185bc43b0107cc50633`
- `data/as-captured/housebets-keno2-sp1-6678bets.json` — `0cd3d3d46e62e28ba9b3b23d31851cbedc7f6e3ce9ea80019b2ced082f548c6e`
- `data/supplementary/housebets-keno2-phaseC-200bets.json` — `8d2f195ee18b0a9764fd290507add154793026de9fdeb005b51d01fc9be67890`
- `data/supplementary/housebets-keno2-phaseC-10usd-200bets.json` — `30c0ba41ccccc6dce8b2fdc56ee1c141ccee0e23cb90e7bc0a25cc07181bb99f`
- `data/supplementary/housebets-keno2-phaseD-200bets.json` — `81d019879bd07cd0d100d849127f0247605375acd214ea1081679e32c5fda8f0`

A matching hash shows consistency with a commitment; it is not a timestamp. That each commitment was shown before its bets
rests on the capture's own records (MANIFEST.md P-1).

## Run the audit

Nothing to install: `node verify.js` runs on Node 22, `npm test` (the TypeScript sources) on Node 22.6 or later:

```
node verify.js          # the standalone verifier (generated from tests/verify.ts by npm run build:standalone)
npm test                # the same suite from the TypeScript sources, the RNG reference vectors and the independent rebuild
```

Expected: the last lines of `node verify.js` read

```
VERDICT: PROVABLY FAIR — Full Pass
Reproduction vs the committed outputs/verification-results.json on Node 22.23.1: REPRODUCED
```

with exit code 0. `verify` re-runs the whole simulation rather than trusting the stored results, on one thread: on an Apple M2 Max (12 cores, Node 22.23.1) it took
54.7 s of CPU time and 53.6 s of wall time (load average 8 at the start; `/usr/bin/time -p node verify.js`
on a fresh copy), so more cores do not shorten it. The independent rebuild in `npm test` needs `python3` (standard library
only); without it that one test is reported as skipped. `npm run mutate` runs the falsifiability battery (each mutation must
be caught by the step it names); `npm run gate:fresh` (run it in a disposable copy of the package: a passing run rewrites the pinned record
`outputs/fresh-copy.json`, which names the Node version, so on another Node 22 patch the rewritten record no longer equals its pin) re-runs the package from a fresh copy and compares the regenerated
artifacts with the committed ones. `node scripts/release-manifest.mjs --check` confirms every pinned file (every file of
the package except `RELEASE-MANIFEST.json` itself) and rebuilds `site-verifier/derive.js` with bun. `verify.js` and
`site-verifier/derive.js` were built with bun 1.3.9 (`STANDALONE.json`, `RELEASE-MANIFEST.json`); a rebuild with another
bun version can differ in local variable names without any change of the sources.

## Verdict and exit codes

`node verify.js` (and `npm run verify`) ends with one `VERDICT:` line and its exit code. Framework 1.1; RTP-CLAIM 1.2.0 is
switched on (Methodology v1.1). The codes and their order are the same in all 11 HouseBets new-engine packages:

| exit | verdict | when |
|---|---|---|
| 0 | PROVABLY FAIR — Full Pass | every scored check passes (a capture-origin FLAG is disclosed and does not move the verdict) |
| 2 | PROVABLY FAIR — Conditional Pass | an operator-origin FLAG, nothing worse |
| 5 | RTP FIGURE OVERSTATED | KENO-19: the published RTP figure is missed on the house side by more than 0.1 pp; the draws pass |
| 3 | INCOMPLETE | a scored check of the profile has no status from this run, or `src/profile-map.ts` departs from `profile/profile.json`, and no check FAILs; or the run aborted on an exception |
| 1 | NOT PROVABLY FAIR | a scored check fails; or a step throws (a file missing, a dataset field null or absent: the checks it scores print FAIL with the error, the other steps still run); or a release-gate record (`outputs/fresh-copy.json`, `outputs/mutation-results.json`) is missing or is not the bytes RELEASE-MANIFEST.json pins (its check prints FAIL) |
| 4 | (no verdict) | `verify.js` was not built from the sources beside it, or its generated body was edited; rebuild with `npm run build:standalone` |

When more than one applies: NOT PROVABLY FAIR > INCOMPLETE > RTP FIGURE OVERSTATED > Conditional Pass > Full Pass.

## Verify a bet

Check your bet at [provablyfair.org/verify-bets/housebets](https://www.provablyfair.org/verify-bets/housebets); the
page runs `site-verifier/derive.js` from this release (sha256 `d5256fbef8117a5174e92b7eac971966a18a2c64dcb9bcf2e0de59009352f6a9`).
KENO-24 runs that file side by side with `src/rng.ts` on every captured bet (MANIFEST.md, Player verifiers). The steps
and the snippet below check a bet by hand, without the page.

0. **Save the commitment before you bet.** Copy the hashed server seed of your active seed pair and keep it. The seeds
   answer of the game's API carries it (`GET /housegames/seeds?gameType=keno2`, field `hashedServerSeed`, beside
   `hashedNextServerSeed`); where the game's screen shows it was not checked by this audit. A match against a hash read
   after your bets shows only that the seed and the hash agree; the assurance that the seed was fixed before you played
   comes from the copy you saved before playing.
1. **Reveal the seed.** A bet can only be checked once its server seed is revealed, which happens when you rotate the seed
   pair: the server's answer to the rotation (`POST /housegames/change_seed`) carries the previous server seed (its field
   `oldServerSeed`). The game's page code
   also fetches a rotated-away seed by its hash (`/unhash?hs=<hash>` on the House Games API); that was read in a copy of the
   page bundle this package does not ship. The rendered verify screen itself was not captured (MANIFEST.md DL-6).
2. **Collect the fields:** the revealed server seed, your client seed, the bet's nonce (HouseBets nonces start at 1 on a
   fresh seed pair), your risk and your picks. The game shows tiles as 1 to 40; the spec numbers them 0 to 39.
3. **Check the commitment:** `sha256` of the server seed's text (UTF-8), as lowercase hex, must equal the hashed server seed
   you saved in step 0.
4. **Recompute the draw:** take `HMAC-SHA256(key = server seed, message = "clientSeed:nonce:0")` and the same with `:1`, and
   join the two 32-byte results. The key is the server seed's 64-character hex **text** encoded as UTF-8, not the 32 bytes it
   hex-decodes to (HouseBets does not hex-decode the seed). On this package's data a hex-decoded key
   gives the served draw on 0 of 7,278 bets, against 7,278 of 7,278 with the text key. For ball i = 0 … 9, read bytes
   4i … 4i+3 as a big-endian 32-bit integer `u`; the ball is the number at position `floor(u × (40 − i) / 2^32)` in the
   ascending list of numbers not yet drawn, and is then removed from that list.
5. **Settle:** hits = how many of your picks are among the ten balls; the multiplier is the paytable cell for your risk,
   your number of picks and your hits (E01); the payout is stake × multiplier, rounded down to 0.00000001 once.

Steps 3 and 4 in Node (paste into `node`, or save as a `.cjs` file and run it with `node`), with the values of one real bet of the Phase A file
(docs/ALGORITHM.md V3, round `8dde6be8-59f1-4147-8d43-ccf531b9b17c`, high risk, 10 picks):

```js
const { createHash, createHmac } = require('node:crypto');
const serverSeed = 'aa920684c812b9e4e40c002f45c9258df4d1542a9250613f19635a0a73893c39';   // (worked example)
const clientSeed = 'pfkenostart4ae63dcedd7cd58fff476b2bffd0272b', nonce = 19;
console.log('commitment', createHash('sha256').update(serverSeed, 'utf8').digest('hex'));
const key = Buffer.from(serverSeed, 'utf8');   // the 64-character text as UTF-8, NOT Buffer.from(serverSeed, 'hex')
const bytes = Buffer.concat([0, 1].map((b) => createHmac('sha256', key).update(`${clientSeed}:${nonce}:${b}`).digest()));
const left = Array.from({ length: 40 }, (_, i) => i), balls = [];
for (let i = 0; i < 10; i++) balls.push(left.splice(Math.floor(bytes.readUInt32BE(4 * i) * (40 - i) / 2 ** 32), 1)[0]);
console.log('balls', balls.join(' '));
```

It prints the two lines below, as the server served that bet (the words in brackets mark this example on the page; the
script does not print them):

```
commitment 0b1afa37356fd15c07681bf119fbdf484c63adb5edab8956f47c11fd2f3121ed   (worked example)
balls 24 37 14 23 26 38 33 4 13 36
```

The picks 14 6 36 4 9 27 33 30 23 29 hit 5 of them (14, 36, 4, 23, 33); high risk, 10 picks, 5 hits pays 8×, so the stake
0.01000311 paid 0.08002488. `src/rng.ts` and `src/rules.ts` are the same five steps in code.

## Files and evidence

`docs/` the algorithm written out ([ALGORITHM.md](docs/ALGORITHM.md), with test vectors) and the interface of `src/rng.ts`
([INTERFACE.md](docs/INTERFACE.md)) · `data/` the datasets (pinned in `src/loader.ts`) · `evidence/` E01–E08 · `profile/` the
framework's KENO profile 1.0.4-public (byte copy, sha256 checked by verify) · `outputs/` the pinned simulation census, RTP table,
verification record, mutation-battery record and fresh-copy record · `capture/` reference copies of the capture scripts (not
the as-run files; MANIFEST.md Dataset and capture) · `src/` the derivation · `tests/verify.ts` the 32 checks of the KENO
profile · `tests/independent/` the independent rebuild, run by `tests/independent.test.ts` · `scripts/` split, mutation
battery, fresh-copy gate, standalone build, release manifest, evidence builder, profile map, code fingerprint,
site-verifier build · `site-verifier/derive.js` the ProvablyFair.org verifier module for this game, generated from
`src/rng.ts` · `STANDALONE.json` the sources `verify.js` was built from. See MANIFEST.md#evidence.

The release commit and tag are signed with the ProvablyFair.org release key (SSH,
`SHA256:gEujiJm2pRyq7lQsfYQfQ1r97H/J7GdaKHbOW8GtikY`), which the release manifest records.
