# HouseBets Keno: algorithm specification

HouseBets House Games **Keno** (`keno2`: 40 tiles, 10 drawn, 1 to 10 picks, four risks), the engine HouseBets serves since
October 2026 (fairness version `canonical`).

This document states, in one place, how a bet's ten balls, hits and payout follow from the seeds, the nonce, the picks, the
risk and the stake. It is written from HouseBets' published fairness spec (E01) and from this package's `src/rng.ts`,
`src/rules.ts` and `src/spec.ts`; every formula below is the one that code runs, and every step names where it came from:

- **PUBLISHED**: HouseBets' fairness spec, `GET /housegames/keno2/fairness`, answered to the capture on 12 Oct 2026
  17:07:28Z ([E01](../evidence/E01-keno-fairness-spec-2026-10-12.json)): derivation, tile numbering, rules, the 40
  paytables in micro-multipliers with their exact RTP, hit chances, four worked draws and eight worked payouts.
- **PAGE**: the rules panel strings in the game page's code (E02, 10 Oct 2026; the live copy of 19 Oct, E08) and the page's
  own paytable and auto-pick code (E07).
- **DATA**: the captured bets of this package (table below). The data fixes what E01 leaves unstated (the key encoding).
- **STANDARD**: the standard provably-fair construction (SHA-256 commitment to the server seed; HMAC-SHA256 keyed by the
  server seed over `clientSeed:nonce:cursor`).

Datasets:

| File | Bets | Seed pairs | Captured |
|---|---|---|---|
| `data/housebets-keno-phaseA-6650bets.json` (Phase A) | 6,650 | 133 | 12 Oct 2026 |
| `data/housebets-keno-phaseA-tail-28bets.json` (the capture's short last pair) | 28 | 1 | 12 Oct 2026 |
| `data/supplementary/housebets-keno2-phaseC-200bets.json` | 200 | 4 | 13 Oct 2026 |
| `data/supplementary/housebets-keno2-phaseC-10usd-200bets.json` | 200 | 4 | 13 Oct 2026 |
| `data/supplementary/housebets-keno2-phaseD-200bets.json` | 200 | 4 | 13 Oct 2026 |

---

## 1. Inputs and commitment

### 1.1 Inputs

| Input | Form | Source |
|---|---|---|
| `serverSeed` | 64 lowercase hex characters; secret until the seed pair is rotated | DATA: 146 of 146 revealed seeds |
| `clientSeed` | text set by the player | DATA: `pfkeno` + hex (CSPRNG, Phases A–C); `provablyfair-1`, `provablyfair-2`, `player-seed-abc`, `1234567890` (Phase D). An empty client seed is refused (E06) |
| `nonce` | positive integer, **1** on the first bet after a rotation, +1 per bet | PUBLISHED (E01 examples start at nonce 1) + DATA: nonces 1 … 50 |
| `picks` | 1 to 10 different tiles, integers 0 … 39 | PUBLISHED (E01 rules[0]; E01 `tiles`: "Numbers are the tiles 0 to 39 from left to right, top to bottom, shown as 1 to 40") + DATA: request `spots` |
| `risk` | one of `classic`, `low`, `medium`, `high` | PUBLISHED (E01 rules[0]) + DATA |
| `stake` | decimal, 8 decimals in the audited USDT wallet | DATA; E03 limits |

The draw reads **only** `serverSeed`, `clientSeed` and `nonce`. Picks, risk and stake never enter it (profile check KENO-17):
the HMAC message has no pick, risk or stake field.

### 1.2 Commitment

```
commitment = lowercase_hex( SHA-256( UTF-8(serverSeed) ) )
```

i.e. hash the **64-character text** of the seed, not the 32 bytes it encodes.

- SOURCE: STANDARD (SHA-256 commitment) + DATA (encoding): 146 of 146 revealed seeds hash to their commitment as text.
- Code: `sha256Hex` in `src/rng.ts`.
- Verify: every bet's hashed server seed must equal `commitment` of one revealed seed. Each pair also shows the hash of the
  next server seed; it equals the next pair's commitment (KENO-02).

---

## 2. Outcome derivation

### 2.1 Two HMAC blocks

```
key           = UTF-8(serverSeed)                                   # the 64-character text, NOT hex-decoded
block(i)      = HMAC-SHA256(key, UTF-8( clientSeed + ":" + decimal(nonce) + ":" + decimal(i) ))   # 32 bytes
bytes         = block(0) ‖ block(1)                                 # 64 bytes; the draw reads the first 40
u(i)          = bytes[4i .. 4i+3] as an unsigned 32-bit BIG-ENDIAN integer,  i = 0 … 9
```

- `decimal(x)`: base 10, no padding, no sign. Example: `pfkenostart4ae63dcedd7cd58fff476b2bffd0272b:5:0`.
- SOURCE: PUBLISHED (E01 `derivation`: "block_i = HMAC_SHA256(key = serverSeed, message = clientSeed:nonce:i). Ball i of a
  round (i = 0 … 9) is bytes 4i..4i+3 of block_0 ‖ block_1 read as a big-endian number u") + DATA (key encoding: E01 says
  "key = serverSeed" without an encoding; the seed's text as the key gives the ten balls in order on 6,650 of 6,650 Phase A
  bets, the hex-decoded 32 bytes on 0 of 6,650).
- Code: `hmacBlock(serverSeed, clientSeed, nonce, i)` in `src/rng.ts`.

### 2.2 Draw: index into the numbers not yet drawn

```
left = [0, 1, 2, …, 39]                      # kept in ascending order
for i = 0 … 9:
    r     = 40 − i                           # 40, 39, …, 31
    index = floor( u(i) × r / 2^32 )         # 0 ≤ index < r
    ball(i) = left[index]
    remove left[index]
balls = ball(0) … ball(9)                    # in this order
```

`balls` is 10 different tiles in 0 … 39, **in the order the round record serves them** (field `balls`). Compare as an
ordered list. The game shows each tile t as t + 1.

- `u × r < 2^38` is exact in binary64 and the division is by a power of two, so the index is exact in floating point. E01
  states the same map as `floor(float × (40 − i))` with `float = Σ byte_j / 256^(j+1)`.
- There is no modulo step, no rejection and no swap: the ball is taken out of the ascending list of the numbers still in.
  A forward Fisher-Yates swap on the same indices gives the served balls on 0 of 6,650 Phase A bets, in order or as a set.
- **Bias.** For each range r = 40 … 31 every index gets ⌊2^32/r⌋ or ⌈2^32/r⌉ of the 2^32 values of `u`; the worst deviation
  from 1/r is 2.07 × 10^-10 (r = 36), below 2^-32, and r = 32 is exact (KENO-08). The draw is within 2^-32 of uniform, not
  exactly uniform.
- SOURCE: PUBLISHED (E01 `derivation`) + DATA (7,278 of 7,278 bets, ordered).
- Code: `indexFromU(u, range)` and `ballsOf(serverSeed, clientSeed, nonce)` in `src/rng.ts`; `GRID = 40`, `DRAWN = 10` in
  `src/spec.ts`.

### 2.3 Hits

```
hits = | set(picks) ∩ set(balls) |           # 0 … len(picks)
```

SOURCE: PUBLISHED (E01 rules[1]: "the bet pays by how many of the picks are among them") + DATA (served `hits` equals this
on 7,278 of 7,278). Code: `hitsOf` in `src/rules.ts`. The chance of k hits with n picks is hypergeometric,
C(n,k)·C(40−n,10−k)/C(40,10) (`hitWeight`, over `D` = C(40,10) = 847,660,528).

---

## 3. Win condition and payout

### 3.1 Paytable

PUBLISHED (E01 `paytables`): `micro[risk][picks − 1][hits]`, multipliers × 10^6, so the multiplier is `micro / 10^6`. Each
risk has 10 rows; the row for n picks has n + 1 cells for hits 0 … n. The game page's own table (E07, the bundle's `Af`) and
`src/spec.ts` `PAYTABLE` equal E01 cell for cell (40 of 40 rows, KENO-13):

```
classic  1:[0,3960000]  2:[0,1899000,4500000]  3:[0,999586,3100000,10400000]  4:[0,800000,1800000,5000000,22671904]
         5:[0,250000,1400000,4100003,16500000,36370000]  6:[0,0,1001042,3680000,7000000,16500000,40000000]
         7:[0,0,470536,3000000,4500000,14000000,31000000,60000000]
         8:[0,0,0,2198973,4000000,13000000,22000000,55000000,70000000]
         9:[0,0,0,1550946,3000000,8000000,15000000,44000000,60000000,85000000]
        10:[0,0,0,1398703,2250000,4500000,8000000,17000000,50000000,80000000,100000000]
low      1:[700000,1860000]  2:[0,2000001,3826660]  3:[0,1100000,1380000,26110000]  4:[0,0,2199984,7900000,90340000]
         5:[0,0,1500000,4200006,13000000,302530000]  6:[0,0,1099739,2000000,6200000,100000000,700000000]
         7:[0,0,1101780,1600000,3500000,15000000,225000000,700000000]
         8:[0,0,1099879,1500000,2000000,5500000,39000000,100000000,800000000]
         9:[0,0,1097944,1300000,1700000,2500000,7500000,50000000,250000000,1000000000]
        10:[0,0,1107732,1200000,1300000,1800000,3500000,13000000,50000000,250000000,1000000000]
medium   1:[400000,2760000]  2:[0,1800000,5160000]  3:[0,0,2800000,50010000]  4:[0,0,1700000,9999750,100950000]
         5:[0,0,1400000,4000000,14000000,391460000]  6:[0,0,0,3000000,9000000,180000000,740220000]
         7:[0,0,0,2000000,7000000,30000000,400000000,859370000]
         8:[0,0,0,2003434,4000000,11000000,67000000,400000000,900000000]
         9:[0,0,0,2002225,2500000,5000000,15000000,100000000,500000000,1000000000]
        10:[0,0,0,1600891,2000000,4000000,7000000,26000000,100000000,500000000,1000000000]
high     1:[0,3960000]  2:[0,0,17160000]  3:[0,0,0,81510000]  4:[0,0,0,10000000,259410000]
         5:[0,0,0,4499993,48000000,452890000]  6:[0,0,0,0,10793609,350000000,800000000]
         7:[0,0,0,0,7200000,88290498,400000000,1000000000]
         8:[0,0,0,0,5003386,20000000,270000000,600000000,1200000000]
         9:[0,0,0,0,4003080,11000000,56000000,500000000,800000000,1500000000]
        10:[0,0,0,0,3499426,8000000,13000000,63000000,500000000,800000000,2000000000]
```

Two rows pay on 0 hits (low 1 pick 0.7×, medium 1 pick 0.4×). The top multiplier is 2,000× (high, 10 picks, 10 hits).

### 3.2 Payout

```
micro  = paytable[risk][len(picks) − 1][hits]
payout = floor( stake × micro / 10^6 , to 1e-8 )            # rounded DOWN to the wallet's smallest unit, once
```

- The code works in integer 1e-8 units: `payout8 = floor(stake8 × micro / 10^6)`.
- SOURCE: PUBLISHED (E01 rules[2]: "a payout is the stake × the multiplier, rounded down to the wallet's smallest unit (1e-8)
  once") + DATA: 7,278 of 7,278 bets. On the 6,650 Phase A bets, rounding half-up instead of down matches 5,467.
- Code: `microOf(risk, picks, hits)` and `payout8(stake8, micro)` in `src/rules.ts`, `MICRO_SCALE = 1000000` in
  `src/spec.ts`.
- **Max win** (E01 rules[3]): a stake whose top prize (every pick drawn) would pay more than the max win above it is refused
  before the draw. With the max win HouseBets answers (E03, 1,000,310.0961298 USDT) that binds on high risk with 10 picks above
  a stake of about 500.41; the largest captured stake was 10, so the refusal was not exercised (MANIFEST.md DL-7).

### 3.3 Return

Each row is solved so that Σ_k P(k hits) × multiplier is at most 99/100 and at least 99/100 − 10^-6 (E01 `return`; each row's
exact figure is E01 `paytables[risk][picks − 1].rtp`). `src/rules.ts` `moments` gives each configuration's exact mean and
variance from the table and the hypergeometric weights. The hypergeometric weights take every set of 10 drawn numbers as
equally likely; the map of §2.2 is within 2^-32 of that at each step, not exactly equal, and the difference is not carried
into these figures.

### 3.4 Fields an implementation must not read

`balls`, `hits`, `micro`, `multiplier`, `payout` and the round record's `payout` are the operator's claims, to be checked. The
derivation reads `serverSeed`, `clientSeed`, `nonce`, the picks, the risk, the stake and the paytable.

---

## 4. Source per step (summary)

| Step | Source | Evidence |
|---|---|---|
| Inputs: server seed, client seed, nonce from 1 | PUBLISHED + DATA | E01 examples; 7,278 bets, nonces 1 … 50 |
| Tiles 0 … 39 (shown 1 … 40), 1 to 10 picks, four risks | PUBLISHED + DATA | E01 `tiles`, rules[0]; captured picks 0 … 39, 1 to 10 per bet |
| Commitment = SHA-256 of the seed's UTF-8 text, hex | STANDARD + DATA | 146/146 |
| HMAC-SHA256, key = the seed's UTF-8 text, message `clientSeed:nonce:i`, blocks 0 and 1 | PUBLISHED + DATA | 6,650/6,650 Phase A (hex-decoded key 0/6,650) |
| u(i) = bytes 4i … 4i+3 of block 0 ‖ block 1, big-endian | PUBLISHED | E01 `derivation` |
| Ball i = ascending remaining list at floor(u(i) × (40 − i) / 2^32), removed | PUBLISHED + DATA | 7,278/7,278 ordered (Fisher-Yates swap 0/6,650) |
| hits = \|picks ∩ balls\| | PUBLISHED + DATA | 7,278/7,278 |
| Paytable = E01 micro-multipliers | PUBLISHED + PAGE | E01 == E07 == `src/spec.ts`, 40/40 rows |
| Payout = stake × micro / 10^6, rounded down to 1e-8 | PUBLISHED + DATA | 7,278/7,278 (half-up 5,467/6,650) |
| Worked examples | PUBLISHED | E01 `examples` 4/4 draws, `payouts` 8/8 (KENO-09) |

---

## 5. Test vectors

The first four are E01's published worked draws; the code reproduces all four. The others are copied from Phase A bets
(round id and public id given); the server seed is the revealed seed whose `commitment` equals the bet's hashed server seed.
"block 0" and "block 1" are `HMAC-SHA256(UTF-8(serverSeed), "clientSeed:nonce:0")` and `…:1`; "index" lists
`floor(u(i) × (40 − i) / 2^32)` for i = 0 … 9. Stakes and payouts are in USDT; tiles are 0 … 39.

**E01 examples**
```
serverSeed housebets-demo-server-seed-0001   clientSeed demo-client
  nonce 1  balls 28 7 15 11 22 3 8 38 0 34
  nonce 2  balls 32 34 38 36 15 25 13 2 35 20
serverSeed 5a1f7d2c9e4b8a3f6d0c2b5e8f1a4d7c0b3e6f9a2d5c8b1e4f7a0d3c6b9e2f5a   clientSeed housebets
  nonce 1  balls 25 10 8 18 22 28 23 37 27 38
  nonce 7  balls 38 32 6 15 18 9 31 13 39 1
```

**V1: round `085a6343-57e4-42f6-b6f6-0b9c67be07eb` (public id `pOv3sSs7OYh7Pj5d9Fxh3`)**, classic, 1 pick, a payout rounded down
```
serverSeed  aa920684c812b9e4e40c002f45c9258df4d1542a9250613f19635a0a73893c39
commitment  0b1afa37356fd15c07681bf119fbdf484c63adb5edab8956f47c11fd2f3121ed
clientSeed  pfkenostart4ae63dcedd7cd58fff476b2bffd0272b   nonce 5   risk classic   stake 0.01000311
picks       3
block 0     5edc15195cfdd79ddb7537fac39a35b419c76b093ed840e3faadeec6c4e1b992
block 1     e55c12536af42eb3a7e9a18c1970b8ebee6ccdb3f8aec3fb26d4a790d99a6e28
u           1591481625 1560139677 3681892346 3281663412 432499465 1054359779 4205702854 3303127442 3848016467 1794387635
index       14 14 32 28 3 8 33 25 28 12
balls       14 15 34 30 3 9 39 29 35 16                         (served identical)
hits 1 → classic[1][1] = 3960000 → 0.01000311 × 3.96 = 0.0396123156 → rounded down 0.03961231   (served 0.03961231)
```

**V2: round `aa0c7e52-1d34-4931-9e3a-90f87123a61e` (public id `sicWFGCyB1r0xjRTKvIod`)**, low, 1 pick
```
serverSeed  aa920684c812b9e4e40c002f45c9258df4d1542a9250613f19635a0a73893c39
clientSeed  pfkenostart4ae63dcedd7cd58fff476b2bffd0272b   nonce 14   risk low   stake 0.01000311
picks       25
block 0     a24f78ca6386c216c6f40e05a928bbf5fe1bd65872c34092419ac2258e88cff4
block 1     73dd57bca30a14944a9eda9016dc6ef6ec8662359444c654517226788b6e9aee
index       25 15 29 24 35 15 8 18 14 19
balls       25 15 31 26 39 16 8 21 17 24                        (served identical)
hits 1 → low[1][1] = 1860000 → 0.01000311 × 1.86 = 0.0186057846 → 0.01860578                    (served 0.01860578)
```

**V3: round `8dde6be8-59f1-4147-8d43-ccf531b9b17c` (public id `vzpcF0m3sWxVopqJkqS5a`)**, high, 10 picks
```
serverSeed  aa920684c812b9e4e40c002f45c9258df4d1542a9250613f19635a0a73893c39
clientSeed  pfkenostart4ae63dcedd7cd58fff476b2bffd0272b   nonce 19   risk high   stake 0.01000311
picks       14 6 36 4 9 27 33 30 23 29
block 0     9be44c30ed0ccb79629754089dac6263a93df06ef403076edb805fe525da2b58
block 1     674d1156f487d3ce070dd4c2fec9c0047ed3c0eddf66d2ec28830a0fc6fc9217
index       24 36 14 22 23 33 29 4 12 29
balls       24 37 14 23 26 38 33 4 13 36                        (served identical)
hits 5 (14 36 4 23 33) → high[10][5] = 8000000 → 0.01000311 × 8 = 0.08002488                     (served 0.08002488)
```

**V4: round `c7ffafd5-26c0-4045-ba1e-48e4de59db79` (public id `zKpKqXzshNwQL09zf1zoG`)**, medium, 7 picks
```
serverSeed  aa920684c812b9e4e40c002f45c9258df4d1542a9250613f19635a0a73893c39
clientSeed  pfkenostart4ae63dcedd7cd58fff476b2bffd0272b   nonce 31   risk medium   stake 0.01000311
picks       0 30 27 34 21 31 8
block 0     c51122c5009f4e575879e3af5054658673ca45da31c65fa304ca1b84bc725a4b
block 1     bd52c5fe8bb5873bcb34a2174d5534418b9c5a0c8257de91d82b02575367e4a9
index       30 0 13 11 16 6 0 24 23 16
balls       30 0 14 12 19 7 1 31 29 22                          (served identical)
hits 3 (0 30 31) → medium[7][3] = 2000000 → 0.01000311 × 2 = 0.02000622                          (served 0.02000622)
```

---

## 6. Open points the published spec and the data do not settle

- **O1: key encoding is not written down.** E01 says "key = serverSeed" without saying whether the key is the seed's text or
  the bytes it encodes. The data settles it for the text (§2.1). A player tool that hex-decodes the seed gets other balls:
  a hex-decoded key gives the served draw on 0 of the 7,278 shipped bets.
- **O2: the reveal path.** A server seed is revealed by rotating the pair (`POST /change_seed` answers the previous seed).
  The game's page code also fetches a rotated-away seed by its hash (`/unhash?hs=<hash>`); the rendered verify screen was not
  captured (MANIFEST.md DL-6).
- **O3: max-win refusal.** Declared (E01 rules[3]) and reachable inside the bet limits on high risk, 10 picks; not exercised
  (§3.2, MANIFEST.md DL-7).
- **O4: auto-pick.** The page's auto-pick (E07) draws picks in the browser with `crypto.getRandomValues` and sends them in the
  same field as manual picks; no captured bet used it (MANIFEST.md DL-9). The draw does not read picks, so it cannot change
  `balls`.
- **O5: other currencies.** Every captured bet is in the USDT wallet with 8 decimals (E03). The rounding unit of other wallets
  is not witnessed.

---

## 7. Reproduction of this specification

`npm test` (or `node verify.js`) recomputes every bet in the package with `src/rng.ts` and `src/rules.ts` (KENO-01, -07,
-09, -10, -11, -12, -13). The counts quoted above were taken on 21 Oct 2026, Node 22.23.1, with a script that imports those
modules and walks the five datasets, comparing the recomputed balls (in order) with the served `balls`, the recomputed hits
with `hits` and the recomputed payout with `_raw.game.payout` in integer 1e-8 units:

```
data/housebets-keno-phaseA-6650bets.json: bets 6650; commitments 133/133; balls (ordered) 6650/6650; hits 6650/6650; payout 6650/6650
data/housebets-keno-phaseA-tail-28bets.json: bets 28; commitments 1/1; balls (ordered) 28/28; hits 28/28; payout 28/28
data/supplementary/housebets-keno2-phaseC-10usd-200bets.json: bets 200; commitments 4/4; balls (ordered) 200/200; hits 200/200; payout 200/200
data/supplementary/housebets-keno2-phaseC-200bets.json: bets 200; commitments 4/4; balls (ordered) 200/200; hits 200/200; payout 200/200
data/supplementary/housebets-keno2-phaseD-200bets.json: bets 200; commitments 4/4; balls (ordered) 200/200; hits 200/200; payout 200/200
TOTAL bets 7278 balls 7278 hits 7278 payout 7278
```

A second implementation in Python (standard library `hmac`, `hashlib` and `decimal` only, not importing the package) gave,
on the 6,650 Phase A bets:

```
ordered pool-index utf8 key 6650/6650; hex-decoded key 0/6650; forward Fisher-Yates swap ordered 0/6650, as set 0/6650
payout floor 1e-8 6650/6650; round half-up 5467/6650
```

---

## 8. Files this specification was written from

`evidence/E01-keno-fairness-spec-2026-10-12.json`, `src/rng.ts`, `src/rules.ts`, `src/spec.ts`, the five dataset files
listed at the top, and MANIFEST.md (for the exhibit references).
