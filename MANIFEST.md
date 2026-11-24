# HouseBets Keno — Consolidated Audit Overview (new engine)

**Release:** `v1.0.0` · **Audit ID:** PF-2026-HB05 · **Auditor:** ProvablyFair.org · **Framework:** 1.1 ·
[Audit report](https://audit.provablyfair.org/casino/housebets/games/keno/overview) · [Public repository](https://github.com/ProvablyFair-org/housebets-keno)

**Result: PROVABLY FAIR — Full Pass**, 0 FAIL, one capture-origin FLAG (KENO-32, DL-9), verdict-neutral: the
verdict `node verify.js` prints, the verdict of record. Theoretical RTP: 99 % to within one millionth on all 40 paytables, before the payout is rounded down to 1e-8.
The machine-readable release identity is [RELEASE-MANIFEST.json](RELEASE-MANIFEST.json); the written algorithm is
[docs/ALGORITHM.md](docs/ALGORITHM.md). Profile: the framework's KENO profile 1.0.4-public, shipped as `profile/profile.json`
(sha256 checked at run time; `src/profile-map.ts` is generated from it): 1.0.2 as approved on 14 Oct 2026 (Methodology
v1.1), with the generated status fields removed (1.0.3), that adoption recorded in the file (1.0.4), and internal notes and
source references removed from its text for publication (1.0.4-public; every check's id, name, layer, kind, policy,
parameters and floor unchanged). Framework 1.1
(Methodology v1.1, 14 Oct 2026): RTP-CLAIM 1.2.0 is switched on, so an RTP figure overstated on the house side is reported as
**RTP FIGURE OVERSTATED** (exit 5), never NOT PROVABLY FAIR. Since 14 Oct 2026 that holds from the evidence, not only from a
code constant: KENO-19 reads every published figure from the exhibits at run time and takes its status from the rule alone,
so a paytable that pays less than the published 99 % and a published figure raised in the exhibits both end RTP FIGURE
OVERSTATED (mutations M19c and M19b, exit 5). Exit codes under [Reproduce the audit](#reproduce-the-audit).

## Contents

[Conclusion and scope](#conclusion-and-scope) · [Dataset and capture](#dataset-and-capture) ·
[Game and algorithm](#game-and-algorithm) · [Payouts and RTP](#payouts-and-rtp) ·
[Verification results](#verification-results) · [Fairness-integrity matrix](#fairness-integrity-matrix) ·
[Player verifiers](#player-verifiers) · [Reproduce the audit](#reproduce-the-audit) · [Evidence](#evidence) ·
[Limitations and trust](#limitations-and-trust) · [Release history](#release-history)

## Conclusion and scope

Every one of the 7,278 keno bets in this package's datasets (Phase A 6,650, its tail 28, Phase C 200, the $10 set 200,
Phase D 200) recomputes exactly from its revealed server seed under the algorithm HouseBets publishes: the ten balls in
their draw order, the hits, the paytable cell and the payout, compared at 1e-8. Every one of those bets appears in the
platform's own bet history with the same stake and payout. The paytable the server publishes, the one the game page carries
and the one every bet was paid from are the same 40 rows. The draw is within 2^-32 of uniform at every step (worst
deviation 2.07 × 10^-10), every one of the 40 paytables returns exactly the fraction HouseBets publishes, within one
millionth of 99 %, and replaying every revealed seed of the shipped datasets (146) over 10,000 nonces each shows no sign, at
the rule's 1 % level, that the early nonces of those 7,278 bets were selected against the player: z −1.693, p 0.0452, at the
power that sample allows, a uniform deficit of 6.77 pp per bet at 80 % power over all of them, 43.5 pp on the high-risk bets
alone (DL-4).

Scope: HouseBets House Games **keno** (`keno2`) on the October 2026 engine (fairness version `canonical`), the USDT wallet,
all four risks and 1 to 10 picks, one audit account in a logged-in browser session. Not in scope: other House Games (their
own packages), the security of the platform, adversarial requests to the API beyond one empty client seed (DL-12), and
anything a client-side capture cannot reach (server-side code, concurrency inside the server).
The fairness-integrity tests run separately on HouseBets' running service by ProvablyFair.org are in the ProvablyFair.org
report for this game, Section 5 (Fairness Integrity Testing); the fairness-integrity matrix below names them row by row.

## Dataset and capture

| file | what | bets | seeds |
|---|---|---|---|
| `data/housebets-keno-phaseA-6650bets.json` | **Phase A, primary**: 133 whole seed pairs of exactly 50 bets, platform minimum stake 0.01000311 USDT, 12 Oct 2026 17:07–19:53 UTC | 6,650 | 133 |
| `data/housebets-keno-phaseA-tail-28bets.json` | the capture's short last seed pair, own file (DL-1) | 28 | 1 |
| `data/as-captured/housebets-keno2-sp1-6678bets.json` | the capture as written; the two files above are split from it unchanged (`src/split.ts`, re-run by KENO-05) | 6,678 | 134 |
| `data/supplementary/housebets-keno2-phaseC-200bets.json` | **Phase C**: low risk, 1 pick, at 1.000311 (100 × minimum), 13 Oct 2026 | 200 | 4 |
| `data/supplementary/housebets-keno2-phaseC-10usd-200bets.json` | **Phase C, $10 set**: low risk, 1 pick, at 10.00, 13 Oct 2026 | 200 | 4 |
| `data/supplementary/housebets-keno2-phaseD-200bets.json` | **Phase D**: one auditor-typed client seed per pair, minimum stake, 13 Oct 2026 | 200 | 4 |

The capture placed bets through the game's own API (`POST /keno2/bet`) on an account opened for the audit, in a logged-in
browser session. For every seed pair it read the pair (the hash of the server seed and the hash of the next one), drew the
client seed from `node:crypto randomBytes(16)` after reading the hash, except on the 4 Phase D pairs, whose client seeds were chosen before the capture (DL-2), placed 50 bets, read the server's nonce count, and
rotated, which reveals the server seed. A pre-capture read anchors the chain before the first pair. The Phase A plan
(as-captured `meta.planDoc`) is 14 repeats of 4 risks × 1–10 picks × 12, each pick set a CSPRNG sample of the 40 tiles, in a
CSPRNG-shuffled order: 6,720 planned bets. During the capture, at 17:19:23Z with 585 bets already placed, the plan was
trimmed to 6,700 by dropping its last 20 entries before they were played, so every pair holds 50 (`meta.planTruncated`).
The server refused 22 of them with a transient error (DL-1), so 6,678 were placed. Played in Phase A: all 40 configurations
(163–168 bets each), all 40 tiles drawn, 2,597 paying bets (2,093 above the stake, 504 below it) and 4,053 at 0.

**Capture scripts.** The as-captured file's meta records the sha256 of the scripts that wrote it (`meta.captureScript`:
`capture-hb-keno2.mjs` `fc8bbe91…`, `common/hb-sp-core.mjs` `74a3e47c…`), and so do the two Phase A files split from it; the three supplementary files record other values, each in its own `meta.captureScript`. Those as-run copies were not kept. `capture/`
ships **reference copies**: the workshop's later copies of the same scripts and of the helper library they import
(`capture-hb-keno2.reference.mjs` from source `377889ee…`, `hb-sp-core.reference.mjs` from `86266dae…`,
`hb-capture-lib.reference.mjs` from `433b6847…`, which the capture recorded no hash for). They do not hash to the as-run
record, and the data show one way the as-run Phase A code differed: the as-captured file lists its 22 transient refusals under
`meta.rejected` and skipped them (DL-1), where the reference copy retries such a refusal and logs it under
`meta.transientRetries` (no keno file has an entry). They were checked for tokens, cookies, passwords, account ids and e-mail
addresses before publication (none). Changes from their sources: a provenance header ("Reference copy; the as-run copy was not kept"), and comment text only — the comment naming who runs the captures, one quote naming a person, two comments naming earlier rigs and a source file, one naming another audit, and comments pointing at internal rig files reworded; every code line is unchanged (checked line by line against the source when the copies were made). No step of
the package reads or runs them, and no claim of this audit rests on them; the claims about the client seeds rest on the
timestamps and generator labels each dataset records (KENO-02, KENO-06). No screenshot of the game or of its fairness panel
ships: the capture recorded the API answers, not the rendered screens.

**Pilot run.** The account's history also holds a pilot run of 480 same-engine keno bets (12 Oct 2026,
13:36–13:39 UTC, 10 seed pairs, minimum stake), outside the capture plan this package audits; E05 lists it as
`housebets-keno2-sp1-480bets.json`, and `npm run pilot -- <that file>` recomputes it with this package's code (sha256 in
`src/loader.ts` `PILOT_SHA256`). It is not shipped.

## Game and algorithm

From HouseBets' published spec (E01, `GET /housegames/keno2/fairness`), the rules panel of the game page (E02) and the game
page's own code (E07):

- **Draw.** `block_i = HMAC-SHA256(key = serverSeed as UTF-8, message = "clientSeed:nonce:i")`; ball i (i = 0 … 9) reads
  bytes 4i … 4i+3 of `block_0 ‖ block_1` big-endian as `u` and is the number at position `floor(u × (40 − i) / 2^32)` among
  the numbers not yet drawn, kept in ascending order. The key is the 64-character text of the seed, not the bytes it
  hex-decodes to: E01 does not say which (docs/ALGORITHM.md O1), and on this package's data a hex-decoded key gives the
  served draw on 0 of 7,278 bets, the text key on 7,278 of 7,278. The four worked draws the spec publishes recompute
  (KENO-09), and the captured bets recompute in their draw order (KENO-07).
- **Where the draw code comes from.** `src/rng.ts` was written from E01's published derivation (its header: "derived from
  the published spec only") and checked against E01's four worked draws and the captured bets; [docs/ALGORITHM.md](docs/ALGORITHM.md)
  was written afterwards from E01 and that code. It is not a clean-room rebuild. A second implementation ships as a
  cross-check: `tests/independent/keno-rebuild.py`, a byte copy (sha256 `69bd9fcb…`) of a rebuild written in Python on
  14 Oct 2026 independently of this package's code, from E01 and the exhibits (its header: no package code; it
  imports only Python's standard library). `npm test` runs it (`tests/independent.test.ts`, which needs `python3` and is
  reported as skipped without it): its own draw, cell and payout code reproduces the ten balls in order, the hits, the cell
  and the payout of 7,278 of 7,278 shipped bets (and the 6,678 of the as-captured file), E01's 4 worked draws and 8 worked
  settlements, and the exact RTP of 40 of 40 paytables.
- **Commitment.** The hashed server seed shown before the bets is `sha256` of the seed's UTF-8 text (146 of 146 revealed
  seeds, KENO-01); each pair also shows the hash of the next seed, and the chain links (KENO-02).
- **Nonces** start at 1 on a fresh pair and count every bet (KENO-04).
- **Bias.** For each of the ten ranges the draw uses (40 … 31 numbers left), every index gets ⌊2^32/range⌋ or ⌈2^32/range⌉
  of the 2^32 values of `u`: worst deviation 2.07 × 10^-10, below the profile's 2^-32 ceiling (KENO-08), so the draw is
  within 2^-32 of uniform, not exactly uniform. There is no modulo step and no rejection.
- **Picks never enter the draw**: the message holds only the client seed, the nonce and the block index; every pair whose
  bets carried different picks and risks draws by the one function (KENO-17).

## Payouts and RTP

- **Hits** = how many picks are among the ten balls, always from the recomputed draw; the served hit count is compared on
  6,650 of 6,650 Phase A bets (KENO-10). The chance of k hits with n picks is hypergeometric,
  C(n,k)·C(40−n,10−k)/C(40,10), checked exactly (KENO-18); the spec's own `hitChance` field matches it to the last bit and
  is never used.
- **Paytable.** 40 rows of micro-multipliers (E01). The server's published rows, the game page's own table (E07, the bundle's
  `Af`) and `src/spec.ts` agree cell for cell (40/40), and every bet of every dataset was paid from the cell at its
  recomputed hits (7,278 of 7,278; KENO-13). The top multiplier is 2,000× (high, 10 picks, 10 hits). Two rows pay on 0 hits
  (low 1 pick 0.7×, medium 1 pick 0.4×), no row decreases with more hits, and 6 cells pay less than the stake (KENO-14).
- **Payout** = stake × multiplier, rounded down to 1e-8 once (E01 rules[2]); equal at 1e-8 on 6,650 of 6,650 Phase A bets
  and every supplementary bet (KENO-11, KENO-12). Every money value and multiplier the server wrote, and every copy of it,
  lies on the 1e-8 grid; an off-grid value fails KENO-11: 116,430 of 116,430.
- **Max win** (E01 rules[3], E02): a stake whose top prize would pay more than the max win (1,000,310.0961298 USDT, E03)
  above it is refused before the draw. On high risk with 10 picks that binds above a stake of about 500.41, inside the bet
  limits (maximum 20,006.20192259); the largest captured stake was 10, so the refusal was never exercised. KENO-14's rule asks that
  the clip be declared, not that it be witnessed, so KENO-14 passes with the branch declared unwitnessed (DL-7).
- **No stake tiers**: the fairness and limits answers carry no tier or scaling field, and the minimum-stake, 100 × minimum
  and $10 bets are all paid from the same table (KENO-31).
- **RTP.** HouseBets states the return in six places in our evidence, each read in the game's answers or code, none on a
  rendered page (P-2): in the game settings the site loads, the fairness answer "99% at every risk and every number of
  picks, to within one millionth" (E01 "return"; the live game bundle requests it, `br("/"+je+"/fairness")`, in the bundle
  E02 and E07 cite, sha256 7afa2e0b…) and its own per-row figure (E01 `paytables[risk][picks − 1].rtp`); and in the rules
  panel of that bundle, "Every paytable returns 99% to the player (to one millionth), at every risk and every number of
  picks" (E02 rulesReturn) and, under the paytable, "Every row of this table returns 99% to the player" (E02
  rulesReturnLine). HouseBets reworded both lines after the capture: the live copy of the same bundle (fetched 19 Oct 2026,
  last-modified Fri, 16 Oct 2026 09:18:09 GMT) reads "Theoretical RTP is approximately 99% before payout rounding; table
  precision can differ by up to one millionth." for each (E08 rulesReturn and rulesReturnLine). KENO-19 reads all of them at
  run time and holds each configuration to the highest figure stated for it (a per-setting claim; here 99 % for all 40,
  since no E01 row figure is higher). The exact RTP of the 40 rows, taking every set of 10 drawn numbers as equally likely (the draw map is within 2^-32 of
  that at each step and not exactly equal, KENO-08; the difference is not carried into these figures), runs from 98.999972 % (classic, 7 picks) to 99.000000 % before the payout is rounded down to 1e-8,
  every one equal to the exact fraction E01 publishes for its row and inside E01's own band [99/100 − 10^-6, 99/100] (both
  printed as information). Under the framework rule RTP-CLAIM 1.2.0 (switched on, Methodology v1.1) the claim holds: 0
  configurations beyond the 0.1 pp band on the house side (`outputs/rtp-claim-table.json`, KENO-19 PASS).
- **Simulation.** Ten streams of 1,000,000 fresh rounds, one per pick count and each on its own seeds (10,000,000 rounds;
  the four risk levels of a pick count settle on its stream, so every one of the 40 configurations has 1,000,000 rounds).
  Every cell of the hit histograms lands in its exact binomial band N·P(k | n) ± (5σ + 1) on its stream's N = 1,000,000
  rounds, every tile count over the T = 10,000,000 rounds in T/4 ± (5σ + 1) = 2,493,153 … 2,506,847, and every
  configuration's RTP converges to within 5 SE (worst 2.67 SE; KENO-20). The RTP band is printed, not scored: its half-width 5·SE runs from
  0.251 pp (low, 1 pick) to 8.338 pp (high, 6 picks), and on 23 of the 40 configurations it is wider than the 1 pp house
  edge, so those bands cannot detect an edge of that size from this sample; the scored form is the hit histogram.
  The tile chi² carries the without-replacement correction X² · 39/30 (10 of 40 tiles drawn per round): 28.25 (df 39),
  p 0.899.
- **Observed return** (variance, not RTP evidence): Phase A paid 59.62628271 on 66.52068150 staked, 89.6357 % (KENO-22
  prints it). RTP evidence is the exact enumeration and the simulation.

## Verification results

`node verify.js` runs the 32 checks of the framework's KENO profile 1.0.4-public, shipped as `profile/profile.json` (a byte copy of the framework's `games/keno/profile.public.json`, sha256 aee3e8e3…, the file as committed in the framework at 19f8dc7, 27 Oct 2026); verify checks that sha256, takes the scored list and every policy from that file, and requires `src/profile-map.ts` to carry the same rows. 17 Nov 2026, Node 22.23.1: 23 of 24 scored checks PASS (the committed record and RELEASE-MANIFEST.json count 22 because they leave out KENO-27, the check that compares the record with the run), 1 capture-origin FLAG
(KENO-32), 0 FAIL; KENO-22 informational; package checks 7 of 7 PASS; verdict **PROVABLY FAIR — Full
Pass**. The full per-check output is `outputs/verification-results.json`. That record holds every check of the run except
KENO-27, KENO-28 and KENO-29, which attest the record itself: KENO-27 compares it with the run, and KENO-28 and KENO-29 read
the gate records (`outputs/fresh-copy.json`, `outputs/mutation-results.json`), which are bound to a code fingerprint that
includes the record; verify prints those three and does not record them. The verdict is bound to the profile: before it is
computed, the 24 scored ids are compared with the rows this run recorded, and a scored check with no status (deleted, skipped
or aborted) prints ABSENT and makes the verdict INCOMPLETE (exit 3), as does a `src/profile-map.ts` that departs from
`profile/profile.json`; a FAIL in the same run ranks first (NOT PROVABLY FAIR, exit 1). Neither prints PROVABLY FAIR. A step
that throws is scored FAIL, the other steps still run, and the run ends NOT PROVABLY FAIR, exit 1.

| check | status | result |
|---|---|---|
| KENO-01 seeds | PASS | 146/146 revealed seeds hash to their commitments (133 Phase A) |
| KENO-02 chain | PASS | 132/132 Phase A links, pre-capture anchor, Phase A → tail, tail → the pair active after the capture; supplementary chains anchored |
| KENO-03 / 04 | PASS | 133/133 pairs: one hash and client seed per pair; nonces exactly 1..50, N == the server's count; the tail pair 1..28, N == 28; the server's own answer (`_raw.game.fairness` nonce, seed hash, client seed) == the copies the recomputation uses on 7,278/7,278 bets of every dataset |
| KENO-05 population | PASS | 6,650 / 133 / 133 × 50 against code constants; the split re-run reproduces both files byte for byte |
| KENO-06 client seed | PASS | a wrong client seed changes the draw on 6,650/6,650 bets; Phase D 200/200 recompute under 4 player seeds; empty seed refused (E06) |
| KENO-07 / 10 / 11 | PASS | draws in order, hits, cells and payouts 6,650/6,650; served balls are 10 different tiles of 0..39; capture copy == server round record; the 28 tail bets recompute the same way |
| KENO-08 | PASS | bias ≤ 2^-32 at each of the 10 draw steps (worst 2.07 × 10^-10) |
| KENO-09 | PASS | the 4 worked draws and 8 worked settlements of E01, and captured bet idx 5, recompute |
| KENO-12 | PASS | Phase C config recomputed (low, 1 pick: every bet pays); Phase C 200/200 and the $10 set 200/200 recompute and pay by the base rule |
| KENO-13 | PASS | the code's table == E01 == the game page's table (E07), 40/40 rows; 7,278/7,278 bets paid from the declared cell |
| KENO-14 | PASS | 7,278/7,278 stakes within 0.01000311 … 20,006.20192259; max-win clip declared and reachable within the bet limits (above a stake of about 500.41 on high/10), never exercised: declared unwitnessed (DL-7); 2 consolation cells, 0 decreasing steps |
| KENO-15 | PASS | 40/40 configurations ≥ 50 bets (163–168); 192 of 260 cells reached; the RTP share of never-reached cells printed |
| KENO-16 | PASS | 7,278/7,278 package rounds in the platform's bet history with the same stake, payout and status (E04); E05's numbers re-added: 60/60 rows paid − staked == net, TOTAL == the sum of the rows, 86,979 ledger entries = 86,966 matched + 0 open + 13 earlier, this package's 4 datasets give E05's rounds, stake and paid at 1e-8; the before-balance is derived (after − net), not read; the pass rests on that bet history and that account reconciliation: the comparison of consecutive balances the profile describes was not possible in this capture (DL-8) |
| KENO-17 / 18 | PASS | the draw takes no pick, risk or stake; the hypergeometric law exact for n = 1 … 10, with negative controls |
| KENO-19 | PASS | RTP claim holds; 40/40 rows equal E01's exact fractions |
| KENO-20 | PASS | 10 pick-count streams × 1,000,000 rounds, each on its own seeds (40 configurations): tile chi² 28.25 (df 39, without-replacement correction) p 0.899, first-ball lag-1 z 0.021, runs z 0.255; 65/65 hit cells in band (worst 2.67σ) |
| KENO-21 | PASS | every revealed seed, 146 (Phase A 133, tail 1, C 4, C $10 4, D 4), × 10,000 nonces: standardized early-window z −1.693, p 0.0452 over the 7,278 played bets (the rule fails below 0.01); 91 pairs below expectation, 55 at or above; reference window z −0.233; power: a 6.77 pp RTP deficit at 80 % (DL-4). The Phase A seeds alone give z −1.423, p 0.0774; the 13 seeds the widening added give z −1.133 over 628 bets on their own |
| KENO-22 | info | 6,650 live draws: tile chi² 43.06 (df 39, without-replacement correction) p 0.302; 9,165 hits vs 9,152.5 expected; Phase A observed return 89.6357 % (variance) |
| KENO-23 | PASS | the fairness-integrity matrix below: rows S5-1 … S5-8 under the framework's names, each with a result |
| KENO-24 | PASS | `site-verifier/derive.js`, sha256 `d5256fbef8117a5174e92b7eac971966a18a2c64dcb9bcf2e0de59009352f6a9`, generated from `src/rng.ts`: equals its pins (`src/artifact-pins.ts`, RELEASE-MANIFEST.json) and returns what `src/rng.ts` returns on all 7,278 captured bets (94,760 calls, 0 differing results) |
| KENO-25 | PASS | README "Verify a bet" carries the reveal, the fields, the commitment encoding and the draw formula |
| KENO-26 / 27 | PASS | 6 datasets, 8 exhibits and 3 artifacts match their pins; regenerated census and RTP table == committed |
| KENO-28 / 29 | PASS | fresh-copy record and mutation battery record bound to this code and data; audit ID PF-2026-HB05; a record that is missing or is not the bytes its pin names prints FAIL and fails the verdict (exit 1) |
| KENO-30 | PASS | disclosure register and evidence appendix |
| KENO-31 | PASS | no stake tiers; 6,878 minimum-stake, 200 × 1.000311 and 200 × 10 bets all paid from the one table |
| KENO-32 | FLAG (capture) | the game's auto-pick is a browser CSPRNG whose picks go in the same request field as manual ones; no captured bet used it (DL-9) |

### False-alarm rates

Pass 1 tile screen α/3 = 0.0033 under the χ²(39) law of the corrected statistic, measured 0.00339 ± 0.00013 (mean
statistic 38.99 against 39) by `src/false-alarm-tiles.ts` over 200,000 replicates of 2,000 rounds; serial screens 0.0059,
tile bands ≤ 2.3 × 10^-5, hit cells ≤ 7.7 × 10^-4; Pass 2 0.00622 ± 0.000176 (`src/false-alarm-pass2.ts`, 200,000
replicates over the 7,278 played bets of every revealed seed) — all under the 1 % cap for a failing step. Before 14 Oct the
tile statistic used the factor 0.73125 instead of 1.3, so it read 1.78 times too low and the screen was far blinder than the
α/3 it stated.

## Fairness-integrity matrix

S5: fairness-integrity matrix (Framework S5-1 … S5-8). KENO-23 reads the block
between the markers below and requires the eight framework rows, once each and in order, under the framework matrix's names
(the KENO profile's -23 rule names the ids S5-1 … S5-8; the names are the framework matrix's), each with a result and what it
is tied to.

<!-- S5-MATRIX:START -->
| Test ID | Category | What the framework tests | Result | Tied to |
|---|---|---|---|---|
| S5-1 | Replay protection | A completed bet cannot be replayed to duplicate a payout | Not tested | The row's control, the replay of a completed bet, was exercised by no test of the report. Observed on another case, which does not close the row: HB-KENO-REPLAY-001: two identical bet requests were sent in parallel: one settled and the duplicate was refused; the wallet moved by the settled bet's result; no request was re-sent after its bet had settled. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no replay request was sent. Observed only: every captured bet settled once, with one round record and one bet-history row each, and the 7,278 round ids are distinct (KENO-05, KENO-11, KENO-16). DL-12 |
| S5-2 | Input validation | Invalid, out-of-range or malformed parameters are rejected | Pass | HB-KENO-PARAM-001, HB-KENO-PARAM-003, HB-KENO-PARAM-004, HB-KENO-SEED-001: Invalid risk values, empty, oversized, duplicate, out-of-pool, wrong-type and fractional picks, out-of-pool picks under every content type, and client seeds longer than 60 characters were rejected. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: one malformed input was sent: an empty client seed, which the server refused with HTTP 400 (E06, KENO-06). Every Phase A pick set was legal (1–10 different tiles of 0..39, 6,650/6,650, KENO-10); no other invalid, out-of-range or malformed parameter was sent. DL-12 |
| S5-3 | Seed integrity under adversarial input | Server and client seed fields cannot be injected or overridden via the API | Not tested — disclosed | No injection was attempted. Observed only: every bet's answer carries its epoch's committed hash and client seed (KENO-03), and the 4 auditor-typed Phase D seeds are the ones the draws recompute with (KENO-06). DL-12 |
| S5-4 | Cross-player isolation | One player's seeds, nonces or outcomes are not observable or influenced by another | Pass on 1 of 2 controls; 1 not tested | HB-KENO-AUTH-001: Bets carrying foreign and malformed user identifiers were rejected; the control bet stayed in the caller's own seed and balance chain and no bet was attributed to another account. Not covered: observation by another account was not tested; influence was tested from one account, by sending another account's identifier. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: single audit account. DL-12 |
| S5-5 | Payout field integrity | Client-supplied payout or multiplier values are ignored by the server | Pass | HB-KENO-MAXWIN-002: A bet carrying injected nonce, multiplier, payout and drawn-number fields was rejected at validation and nothing was reflected; the control bet settled as published and recomputed from the revealed seed. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: the capture sent the risk, the picks and the stake only, never a payout or multiplier field. Observed only: the served cell equals the declared cell at the recomputed hits on 7,278/7,278 bets (KENO-13), and the served payout equals stake × cell rounded down, in the answer and the round record, on 6,650/6,650 Phase A bets and every supplementary bet (KENO-11, KENO-12). DL-12 |
| S5-6 | Nonce sequence enforcement | Nonces cannot be forced, replayed or skipped via the API | Pass | HB-KENO-NONCE-001, HB-KENO-NONCE-002, HB-KENO-NONCE-003, HB-KENO-NONCE-004, HB-KENO-RACE-001, HB-KENO-RACE-003, HB-KENO-MAXWIN-002: Bets carrying reused, skipped-ahead, zero, negative and overflow-sized nonces, or an injected nonce field, were rejected at validation and only the control and recovery bets advanced the nonce; under bursts of parallel bets accepted nonces were unique and in sequence. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no nonce was supplied by the client. Observed only: nonces run 1..50 with no gap or repeat in 133/133 Phase A pairs and every supplementary pair, equal to the server's count, and the 22 refused requests used no nonce (KENO-04, DL-1). DL-12 |
| S5-7 | Parameter boundary enforcement | Bet amounts, configuration values and game parameters outside valid ranges are rejected | Pass | HB-KENO-MAXWIN-001, HB-KENO-PARAM-001: Stakes whose top payout would pass the max-win cap, stakes just above the maximum bet and picks just outside the pool of 0 to 39 were refused; both edges of the pool were accepted. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no out-of-range stake, risk or pick count was sent. Observed only: every captured stake lies within E03's limits (KENO-14), and stakes of 100 × the minimum and $10 pay by the same table (KENO-12, KENO-31); the max-win refusal, reachable within the limits, was never reached (DL-7). DL-12 |
| S5-8 | Game-specific state | For Keno: a repeated pick, a pick outside 0..39, more than 10 picks, or a draw that depends on the picks | Pass on 3 of 4 controls; 1 not tested | HB-KENO-PARAM-001: Empty, oversized, duplicate and out-of-pool pick sets were rejected. Not covered: a draw that depends on the picks was not tested adversarially. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no illegal pick set was sent. Observed only: every Phase A answer echoes the picks and risk that were sent (6,650/6,650, KENO-10), and the draw takes no pick (KENO-17). DL-12 |
<!-- S5-MATRIX:END -->

Of the eight framework rows, **4 pass on every control the row names**, **2 pass on part of the controls they name** (S5-4,
S5-8: the row's status says how many of its controls were tested, and its evidence cell what was not) and **2 remain
Not tested** (S5-1: no test replayed a completed bet; S5-3). The passing rows rest on fairness-integrity tests run separately on HouseBets' running service by
ProvablyFair.org; they are recorded in the ProvablyFair.org report for this game, Section 5 (Fairness Integrity Testing),
not in this package's data, so nothing in this package reproduces them. The matrix names 14 of that section's 27 tests: 13
under the row whose control they test and one (HB-KENO-REPLAY-001) under S5-1 as an observation on another case; the other 13 tests check controls outside these eight rows (1 of them recorded there
as fixed by HouseBets) and are in the report only. This package's own capture recorded normal play, and the only adversarial
request it sent to the API was the empty client seed of S5-2. The "Observed only" notes state what the captured data shows;
none substitutes for the adversarial test, and reproducing a test from this package needs a deliberate probe capture
(DL-12).

The audit's offline consistency checks, its own ids:

| Check | Category | Question | Expected defence | Result | Evidence |
|---|---|---|---|---|---|
| EC-1 | Seed substitution | Can a revealed seed be swapped for a better one that still matches the commitment? | sha256 commitment shown before the bets | Pass | 146/146 seeds hash to their commitments and the chain links in order from a pre-capture anchor; these are consistency checks, the timing rests on the capture's reads before each pair (P-1). [KENO-01, KENO-02] |
| EC-2 | Client-seed manipulation | Does the client seed enter the derivation? | A different client seed changes the draw | Pass | 6,650/6,650 draws change under a wrong client seed; Phase D 200/200 recompute under player-set seeds, 0 of 200 equal to the previous seed's draws. [KENO-06] |
| EC-3 | Stake- or pick-conditional outcome | Do the captured higher-stake bets, and the pairs mixing picks and risks, recompute and settle by the same table and the one draw function? | Stake and picks enter only the settlement | Pass | Phase C at 100 × minimum (200 bets) and the $10 set (200 bets) recompute and pay by the same table as base stake; the derivation takes no stake or pick input and every pair mixing picks and risks draws by the one function. [KENO-12, KENO-17, KENO-31] |
| EC-4 | Server-seed cherry-picking | Can the operator pre-select seeds unfavourable for the early nonces? | Player-chosen client seed after the commitment; no early-window skew | Pass, structural + statistical (power stated) | The draw depends on the client seed, set after the hash is shown (P-1): drawn after the read on 142 of 146 pairs; the 4 Phase D client seeds were chosen before the capture (DL-2), so the structural argument does not cover those pairs, which are in the Pass 2 screen; Pass 2 over every revealed pair (146) × 10,000 nonces: standardized early-window z −1.693, p 0.0452, detection power 6.77 pp per bet (DL-4). Nothing here rules out selection across the capture as a whole. [KENO-21, KENO-06] |
| EC-5 | Seed-rotation race | Can a rotation during an in-flight bet change its seed? | Each bet settles on the seed committed when accepted | Not tested — disclosed | Keno settles in one request (E01 rules[4]); no bet is pending against an unrevealed seed. The capture places one bet at a time per game, so a concurrent rotate/bet race was not exercised. |
| EC-6 | Paytable tampering | Is any bet paid from a cell other than the published one? | The cell from the recomputed hits, never read from the served field | Pass | The served cell equals the published cell at the recomputed hits on 7,278/7,278 bets; the server's table, the page's table and the code's table agree on 40/40 rows; payouts exact. [KENO-13, KENO-11] |
| EC-7 | Nonce manipulation | Are nonces skipped, reused or reordered? | Contiguous 1..N, N == server count | Pass | 133/133 pairs run exactly 1..50 with the server's count equal to 50; the capture's refused requests used no nonce (DL-1). [KENO-04] |
| EC-8 | Range-mapping bias | Does the digest-to-ball map favour some numbers? | Bias ≤ 2^-32 | Pass | Counted over the 2^32 inputs from the two ends of each outcome's interval (the ends checked through the function; the values between them are not enumerated) at each of the 10 draw steps: worst deviation 2.07 × 10^-10. [KENO-08] |
| EC-9 | Scope limitation | Multi-account seed sharing | Per-account server seeds | Not tested — disclosed | Single account (S5-4). |

## Player verifiers

The ProvablyFair.org verifier for HouseBets is at
[provablyfair.org/verify-bets/housebets](https://www.provablyfair.org/verify-bets/housebets). The module it runs for this
game ships in this release as `site-verifier/derive.js`, sha256
`d5256fbef8117a5174e92b7eac971966a18a2c64dcb9bcf2e0de59009352f6a9`. The live verifier serves exactly these bytes.

**How the module is built.** `npm run build:site-verifier` (`scripts/build-site-verifier.mjs`, bun 1.3.9) bundles
`src/rng.ts` and the constants it imports from `src/spec.ts` into one ES module with no import, which exports the same
functions under the same names (`ballsOf`, `hmacBlock`, `indexFromU`, `sha256Hex`) and runs in a browser and in Node.
`src/rng.ts` takes SHA-256 and HMAC-SHA256 from Node; a browser page has no such module, so the build puts its own
implementation of the two inside the file. Nothing else differs from `src/rng.ts`. The same sources give the same bytes: the
file's header carries the sha256 of both source files and no date, host or path, the bun version is fixed, and
`node scripts/release-manifest.mjs --check` rebuilds the module in a throwaway folder and requires the shipped file to equal
the rebuild byte for byte.

**What KENO-24 checks, on every run.** The file on disk has the sha256 pinned in `src/artifact-pins.ts`
(`SITE_VERIFIER_PIN`) and in RELEASE-MANIFEST.json, and this document and the README quote it. The module is then loaded
from that file and run side by side with `src/rng.ts` on every captured bet of the five shipped datasets: 7,278 bets and
146 revealed seeds, 94,760 calls over its four functions (both HMAC blocks, the ten balls and the draw-to-index map on
each of the ten draws of every bet), 0 differing results. Two mutations cover the check (`tests/mutations.json`): M24a
changes the draw-to-index formula inside the module and re-pins it everywhere, so only the side-by-side run can catch it;
M24b breaks the pin and leaves the module alone. To confirm the bytes a page serves, compare the sha256 of the module it
loads with the one above.

HouseBets' own verify tab
was not tested against this package. The game's page code calls a seed lookup, `/unhash?hs=<hash>`; that was read in a copy
of the page bundle this package does not ship, so no exhibit here shows it (DL-6). README "Verify a bet" carries the player
steps and a Node snippet, run on a real bet of Phase A.

## Reproduce the audit

`node verify.js` on Node 22, or `npm test` on Node 22.6 or later, with nothing installed; `verify` runs on one thread, 54.7 s of CPU time (53.6 s of wall time,
load average 8) on an Apple M2 Max (12 cores, Node 22.23.1). `npm test` also runs the RNG reference vectors and the independent rebuild
(`tests/independent.test.ts`, which needs `python3`). Re-generation of the artifacts of record: `npm run simulate` (the
census, `outputs/simulation-results.json`), `npm run rtp-claim:write` (the RTP table), `npm run record` (the verification
record) — each re-pinned in `src/artifact-pins.ts` (and `src/rtp-settings.ts`) in the same change; `npm run
build:site-verifier` rebuilds `site-verifier/derive.js` from `src/rng.ts` and writes its pin; `npm run
build:standalone` rebuilds `verify.js` and `STANDALONE.json` (the sha256 of every source it was built from; `verify.js`
refuses to run when one differs). `verify.js` was built with bun 1.3.9 (`STANDALONE.json` `bundler`, also
`RELEASE-MANIFEST.json` `bundler`); a rebuild with another bun version can differ in local variable names alone. `npm run
false-alarm:pass2` and `npm run false-alarm:tiles` re-run the Pass 2 and tile-screen false-alarm Monte Carlos. `npm run
mutate` runs the mutation battery in throwaway copies and writes `outputs/mutation-results.json`; `npm run gate:fresh` runs
the package from a fresh copy and writes `outputs/fresh-copy.json`. Both records ship, carry no time or host, and are pinned
in `RELEASE-MANIFEST.json` (`npm run release-manifest`); KENO-28 and -29 read only those pinned records, each of which
carries the fingerprint of the code and data it ran against (`scripts/fingerprint.mjs`; a record of other code is rejected),
and check the battery record against `tests/mutations.json`. `verify.js` also refuses to run when its own generated body
differs from the one the build recorded (exit 4). The battery asserts the exit code of the mutations that name one: M13y
ends 3, M19b and M19c end 5, M16d ends 2, M11z, M19 and M26b end 1. `npm run gate:fresh` expects the committed record's
verdict with that verdict's exit code. `npm run pilot -- <file>` recomputes the 480-bet pilot run.
`node scripts/release-manifest.mjs --check` rebuilds `site-verifier/derive.js` from `src/rng.ts` in a throwaway folder (bun)
and requires the shipped file to equal the rebuild byte for byte; RELEASE-MANIFEST pins every file of the package except
itself.

A release-gate record that is missing or is not the bytes RELEASE-MANIFEST.json pins fails the verdict (exit 1), and every
mutant copy reads the fresh-copy record, so the records are regenerated in this order: `npm run build:standalone`,
`npm run gate:fresh`, `npm run release-manifest`, `npm run mutate`, `npm run release-manifest`. KENO-24 reads the
module's pin from RELEASE-MANIFEST.json, so after a change of `src/rng.ts` these come first: `npm run build:site-verifier`,
`npm run release-manifest`.

Exit codes of `node verify.js` / `npm run verify`, the same in all 11 HouseBets new-engine packages (the ranking of
RTP-CLAIM 1.2.0, `rtpClaimVerdict`): 0 PROVABLY FAIR — Full Pass · 2 PROVABLY FAIR — Conditional Pass · 5 RTP FIGURE
OVERSTATED · 3 INCOMPLETE · 1 NOT PROVABLY FAIR · 4 `verify.js` is a stale build of the sources beside it (no verdict). When
more than one applies: NOT PROVABLY FAIR > INCOMPLETE > RTP FIGURE OVERSTATED > Conditional Pass > Full Pass.

## Evidence

| exhibit | file | role |
|---|---|---|
| E01 | `evidence/E01-keno-fairness-spec-2026-10-12.json` | the server's published keno spec (derivation, tiles, rules, the 40 paytables with their exact RTP, hit chances, four worked draws, eight worked settlements) |
| E02 | `evidence/E02-keno-rules-panel-2026-10-10.json` | the game page's rules panel text (board, draw, payouts, return, max win, bet range), with the bundle's hash |
| E03 | `evidence/E03-keno-limits-2026-10-12.json` | the limits answer: minimum stake 0.01000311 USDT, maximum 20,006.20192259, max win 1,000,310.0961298, wallet decimals 8 (KENO-26 requires `src/spec.ts` MIN_STAKE, MAX_STAKE and MAX_WIN to equal it; KENO-12 and -14 use them) |
| E04 | `evidence/E04-keno-bet-history-2026-10-13.json` | the platform's bet-history rows of all 7,278 package rounds |
| E05 | `evidence/E05-account-reconcile-2026-10-13.txt` | the whole account's reconciliation (the workshop's `reconcile-full.py --ledger ledger/ledger-2026-10-13-final.json --before 986.84718000`, full output): 60 captured datasets of 11 games, 86,979 history entries = 86,966 captured rounds + 13 earlier bets, 0 unexplained, RECONCILED; among its rows, this package's 4 keno datasets and the 480-bet pilot run (Dataset and capture); the after-balance is the server's 8-dp read after the capture and the before-balance is derived from it |
| E06 | `evidence/E06-keno-empty-seed-control-2026-10-13.json` | the server's answer to an empty client seed: refused, HTTP 400 |
| E07 | `evidence/E07-keno-bundle-paytable-autopick-2026-10-10.json` | the game page's own paytable (the bundle's `Af`) and its auto-pick code, cut verbatim, with the bundle's hash |
| E08 | `evidence/E08-keno-rules-panel-live-2026-10-19.json` | the same rules panel text in the live copy of the game page's bundle, fetched 19 Oct 2026 (last-modified Fri, 16 Oct 2026 09:18:09 GMT, sha256 and etag recorded), with every key changed since E02 (the two return lines reworded; Min bet / Max bet lines replace the bet-range line) |

`scripts/make-evidence.py` records the source path and sha256 of each exhibit; `scripts/make-live-rules.py` builds E08 from the
live bundle copy of 19 Oct and stops unless its reading reproduces every key of E02 from the 10 Oct copy. No screenshot
ships (Dataset and capture). `capture/` holds the reference copies of the capture scripts, which are not evidence for any
figure; `tests/independent/keno-rebuild.py` is the independent rebuild (Game and algorithm).

## Limitations and trust

### Load-bearing premises

| ID | Premise | Why it holds | Could the data contradict it? |
|---|---|---|---|
| P-1 | Each commitment was shown before its bets. On the 142 of 146 pairs whose client seed the capture drew (every pair outside Phase D), the seed was drawn after the commitment was read; the 4 Phase D client seeds were chosen before the capture (DL-2), and each of their commitments was read before the pair's first bet | The capture's code reads the hash, then draws the seed, then bets. It also wrote two times per pair, but the verifier does not score them: on 134 of the 142 CSPRNG seeds they share the millisecond (8 a later one, 0 an earlier one; printed by KENO-02), so the order rests on the rig's code order. The as-run capture scripts were not kept: the reference copies in `capture/` do not hash to the sha256 the capture recorded (not verified) | Partly: a commitment that did not match its revealed seed would fail KENO-01; the order of reads is the capture's record, not the server's |
| P-2 | E02 and E07 are what players see | The live keno page's script tag names the bundle file they were cut from (bundles/LIVE-BUNDLES.md, 10 Oct 2026); the bytes the page loaded were not compared; E08 is the same URL's copy of 19 Oct (that the live page still loads it was not re-checked) | No: the rendered panel was not captured; a different panel would not show in the data |
| P-3 | Every bet is paid from the published cell at its hits, rounded down once | Published (E01 rules[2], paytables) and measured on every bet (KENO-11, KENO-13) | Yes: one bet paid from another cell or rounded otherwise would fail KENO-11 or KENO-13 |
| P-4 | The account was used only by the capture | E05: the history holds the captured rounds and 13 earlier bets, nothing else | Yes: any other bet would be an unexplained history entry |

### Declared limitations register

| ID | Limitation | Effect | Closure / evidence |
|---|---|---|---|
| DL-1 | The server refused 22 of the 6,700 planned Phase A bets with a transient 400 "Transaction temporarily unavailable" and the rig skipped them, so the last seed pair of the capture holds 28 bets, not 50 | Verdict-neutral: no nonce was used (KENO-04); those 28 bets are in their own file and recompute (`data/…tail-28bets.json`) | The 22 refusals are listed in the as-captured meta; KENO-14 checks every one is the transient error |
| DL-2 | Phase D client seeds are predictable strings chosen by the auditor (`provablyfair-1`, `provablyfair-2`, `player-seed-abc`, `1234567890`) | All 4 Phase D pairs are exposed to an operator who could foresee them; Phase D tests recomputation, not unpredictability; Pass 2 replays them with every other revealed seed (KENO-21) | Phases A–C use CSPRNG client seeds (142/142) |
| DL-3 | 68 of the 260 paytable cells were never reached in Phase A; no captured bet paid more than 88.290498× (high, 7 picks, 5 hits), so every prize of 100× and more is among them | Their payout rule is the published table (KENO-13), not witnessed on a live bet; KENO-15 prints the RTP share they carry | The simulation's hit histograms reach 62 of the 65 (picks, hits) cells; the three it does not are 9 of 9, 9 of 10 and 10 of 10, each under 1 expected in 1,000,000 rounds |
| DL-4 | Pass 2's power is bounded on the high-risk tables: the scored standardized statistic over every revealed seed detects a uniform 6.77 pp per-bet deficit at 80 % over all 7,278 bets, 43.5 pp on the high-risk bets alone; the raw return sum would detect only 21.46 pp. The early-window z is −1.693, p 0.0452: below expectation, and above the rule's pre-set 0.01 threshold, so a pass under that rule | A cherry-pick smaller than that would not show in KENO-21 | `src/sim-config.ts` says the statistic was chosen from the paytable before it was computed on the live data; no artifact orders the two computations, so that order is not verified. The structural defence (client seed after the commitment, P-1) does not depend on it |
| DL-5 | Commitment timing rests on the capture's reads (P-1) | Hash equality is a consistency check | — |
| DL-6 | The player-facing reveal path was observed in the API and in a copy of the game's page code (not shipped here), not on the rendered verify screen | README "Verify a bet" step 1 is scoped to that | — |
| DL-7 | The max-win refusal was not exercised: the largest captured stake was 10, and the clip binds above about 500.41 (high risk, 10 picks), inside the bet limits (max 20,006.20192259) | The rule is declared (E01 rules[3], E02) and no payout was cut, but the refusal itself was not observed. KENO-14 asks that the clip be declared, not witnessed, so it passes with this branch declared unwitnessed | A capture at a stake above the threshold would exercise it |
| DL-8 | The per-bet balance field cannot be checked bet to bet: other games' captures ran on the same account at the same time (6,579 of the 6,677 consecutive pairs of answers in the as-captured file, Phase A and its tail, moved by more than the keno bet's own net; 6 of the 6,678 answers carry no balance (null) and count as 0 in that figure) | Reconciliation uses the platform history (E04) and the account reconciliation (E05) instead | E05 RECONCILED |
| DL-9 | The game's auto-pick was not used by the capture: its code (E07) draws picks in the browser with `crypto.getRandomValues` and sends them in the same field as manual picks, but no auto-picked bet was placed | KENO-32 is a capture-origin FLAG, verdict-neutral; auto-pick vs manual outcomes were not compared | A later capture can place auto-picked bets |
| DL-10 | Resolved 14 Oct 2026: the KENO profile, proposed when this package was built, is 1.0.2, approved as cited with no content change (Methodology v1.1) | None: the check list is the one this package runs | Re-run against 1.0.2 on 14 Oct 2026 |
| DL-11 | User id: HouseBets packages ship the audit account's user id as "redacted" wherever a server answer carries it (decided 13 Oct). The keno answers carry no account identifier: a search of every file in this package for the audit account's user id finds 0 occurrences, so nothing was redacted and the as-captured file ships unchanged | None | The search is repeatable over the package |
| DL-12 | This package's capture sent no adversarial request to the API apart from one empty client seed (E06): no replay, no injected seed, payout or multiplier field, no forced nonce, no illegal pick set or out-of-range stake, and one account only | This package's data cannot reproduce a fairness-integrity test. The tests behind the S5 matrix were run separately on HouseBets' running service by ProvablyFair.org and are recorded in the ProvablyFair.org report for this game, Section 5 (Fairness Integrity Testing), not in this package: 6 of 8 rows Pass on them (4 on every control the row names, 2 on part), 2 remain Not tested (S5-1, where the test sent a duplicate in parallel and not the replay of a completed bet, and S5-3; Fairness-integrity matrix); the "Observed only" notes are what normal play shows | A deliberate probe capture would let this package reproduce a test |

## Terms

**G-BIND:** the framework's population rule (KENO-05): the counts a dataset is checked against are code constants in
`src/loader.ts`, never the dataset's own header.

## Release history

| Release | What changed | Verdict |
|---|---|---|
| `v1.0.0` | First public release, 24 Nov 2026. | PROVABLY FAIR — Full Pass, one capture-origin FLAG |

A pilot run of 480 same-engine bets on the same account (12 Oct 2026) is outside this audit's plan and not shipped;
E05 lists it (Dataset and capture).
