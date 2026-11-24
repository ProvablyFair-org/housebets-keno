#!/usr/bin/env python3
"""Independent rebuild of the HouseBets keno package (no package code). Reads only the datasets and the exhibits.
usage: python3 -I rebuild.py <package-root>
Draw: E01 derivation text. Paytable: E01 paytables (micro), cross-checked with E07. Payout: floor(stake*micro/1e6) at 1e-8 (E01 rules[2]).
RTP: exact Fraction over hypergeometric P(k|n) = C(n,k)C(40-n,10-k)/C(40,10)."""
import hashlib, hmac, json, sys
from decimal import Decimal, ROUND_FLOOR
from fractions import Fraction
from math import comb

root = sys.argv[1]
J = lambda p: json.load(open(f"{root}/{p}"))
E01 = J("evidence/E01-keno-fairness-spec-2026-10-12.json")["answer"]["body"]
E07 = J("evidence/E07-keno-bundle-paytable-autopick-2026-10-10.json")
E04 = J("evidence/E04-keno-bet-history-2026-10-13.json")
PT = {r: [row["micro"] for row in E01["paytables"][r]] for r in E01["paytables"]}
PT7 = {r: [[int(x) for x in row] for row in rows] for r, rows in E07["paytableMicro"].items()}
print("paytable E01 == E07 (40 rows, cell for cell):", PT == PT7, "risks", list(PT), "rows", sum(len(v) for v in PT.values()))

def balls(ss, cs, n):
    blk = b"".join(hmac.new(ss.encode(), f"{cs}:{n}:{i}".encode(), hashlib.sha256).digest() for i in (0, 1))
    left = list(range(40)); out = []
    for i in range(10):
        u = int.from_bytes(blk[4 * i:4 * i + 4], "big")
        out.append(left.pop((u * (40 - i)) >> 32))
    return out

# E01 worked examples
ex = sum(balls(x["serverSeed"], x["clientSeed"], x["nonce"]) == x["balls"] for x in E01["examples"])
print(f"E01 examples recomputed: {ex}/{len(E01['examples'])}")
pe = sum(Decimal(PT[x['risk']][x['picks'] - 1][x['hits']]) / Decimal(10**6) == Decimal(str(x['multiplier'])) for x in E01["payouts"])
print(f"E01 payout examples (cell == multiplier): {pe}/{len(E01['payouts'])}")

Q = Decimal("0.00000001")
D = lambda x: Decimal(str(x))
def pay(stake, micro):
    return (D(stake) * micro / Decimal(10**6)).quantize(Q, rounding=ROUND_FLOOR)

hist = {r["id"]: r for r in E04["rows"]}
files = ["data/housebets-keno-phaseA-6650bets.json", "data/housebets-keno-phaseA-tail-28bets.json",
         "data/supplementary/housebets-keno2-phaseC-200bets.json", "data/supplementary/housebets-keno2-phaseC-10usd-200bets.json",
         "data/supplementary/housebets-keno2-phaseD-200bets.json", "data/as-captured/housebets-keno2-sp1-6678bets.json"]
tot = {}
for f in files:
    d = J(f); seeds = {int(s["epoch"]): s for s in d["seeds"]}
    c = dict(n=0, balls=0, rawballs=0, hits=0, rawhits=0, micro=0, rawmicro=0, payout=0, rawpayout=0, roundpayout=0, mult=0, rawnonce=0, rawseed=0, e04=0)
    commits = sum(hashlib.sha256(s["revealedServerSeed"].encode()).hexdigest() == s["hashedServerSeed"] for s in d["seeds"])
    chain = sum(d["seeds"][i]["hashedNextServerSeed"] == d["seeds"][i + 1]["hashedServerSeed"] for i in range(len(d["seeds"]) - 1))
    pre = d.get("preCapture") and d["preCapture"]["hashedNextServerSeed"] == d["seeds"][0]["hashedServerSeed"]
    staked = paid = Decimal(0)
    for b in d["bets"]:
        c["n"] += 1; s = seeds[b["epoch"]]; g = b["_raw"]["game"]; r = b["_raw"]["round"]
        bl = balls(s["revealedServerSeed"], s["clientSeed"], b["nonce"])
        picks = b["request"]["spots"]; risk = b["request"]["risk"]
        h = len(set(picks) & set(bl)); m = PT[risk][len(picks) - 1][h]; p = pay(b["request"]["amount"], m)
        c["balls"] += bl == b["outcome"]; c["rawballs"] += bl == g["balls"]
        c["hits"] += h == b["hits"]; c["rawhits"] += h == g["hits"]
        c["micro"] += m == b["micro"]; c["rawmicro"] += m == g["micro"]
        c["mult"] += D(g["multiplier"]) == Decimal(m) / Decimal(10**6)
        c["payout"] += D(b["payout"]) == p; c["rawpayout"] += D(g["payout"]) == p; c["roundpayout"] += D(r["payout"]) == p
        c["rawnonce"] += g["fairness"]["nonce"] == b["nonce"]
        c["rawseed"] += g["fairness"]["hashedServerSeed"] == s["hashedServerSeed"] and g["fairness"]["clientSeed"] == s["clientSeed"]
        x = hist.get(b["roundId"])
        c["e04"] += bool(x) and D(x["stake"]) == D(b["request"]["amount"]) and D(x["payout"]) == p
        staked += D(b["request"]["amount"]); paid += p
    tot[f] = c
    print(f"{f}: bets {c['n']}, seeds {len(d['seeds'])}, commitments {commits}/{len(d['seeds'])}, chain {chain}/{len(d['seeds'])-1}, preCapture anchor {pre}")
    print("   " + ", ".join(f"{k} {v}/{c['n']}" for k, v in c.items() if k != "n") + f"; staked {staked}, paid {paid}")

# RTP: exact, per row, from E01's paytable; compared with E01's stated fraction and the claim 99/100
C40 = comb(40, 10)
rows = []
for r in PT:
    for n, row in enumerate(PT[r], start=1):
        rtp = sum(Fraction(comb(n, k) * comb(40 - n, 10 - k), C40) * Fraction(row[k], 10**6) for k in range(n + 1))
        stated = Fraction(E01["paytables"][r][n - 1]["rtp"])
        rows.append((r, n, rtp, stated, float(E01["paytables"][r][n - 1]["rtpFloat"])))
eq = sum(a == b for _, _, a, b, _ in rows)
band = sum(Fraction(99, 100) - Fraction(1, 10**6) <= a <= Fraction(99, 100) for _, _, a, _, _ in rows)
fl = sum(abs(float(a) - f) < 1e-15 for _, _, a, _, f in rows)
lo = min(rows, key=lambda x: x[2]); hi = max(rows, key=lambda x: x[2])
print(f"RTP exact == E01 stated fraction: {eq}/40; rtpFloat agrees: {fl}/40; inside [99/100 - 1e-6, 99/100]: {band}/40")
print(f"RTP min {float(lo[2])*100:.6f} % ({lo[0]}/{lo[1]}), max {float(hi[2])*100:.6f} % ({hi[0]}/{hi[1]})")
print(f"house-side shortfall vs 99 %: worst {float((Fraction(99,100)-lo[2])*100):.3e} pp; configs beyond 0.1 pp: {sum(Fraction(99,100)-a > Fraction(1,1000) for _,_,a,_,_ in rows)}")
for r, n, a, b, f in rows: print(f"   {r:7s} {n:2d}  {a.numerator}/{a.denominator}  {float(a)*100:.7f} %  ==E01 {a==b}")
# hypergeometric vs E01 hitChance
hc = E01["hitChance"]; worst = max(abs(comb(n, k) * comb(40 - n, 10 - k) / C40 - hc[str(n)][k]) for n in range(1, 11) for k in range(n + 1))
print(f"E01 hitChance vs exact hypergeometric: worst |diff| {worst:.3e}")
