#!/usr/bin/env python3
"""Builds evidence/ for a HouseBets new-engine package from the HouseBets workshop (run once by the auditor; the outputs are
pinned in src/loader.ts and listed in MANIFEST.md#evidence). Same script in the roulette and keno packages; the game is read
from package.json. Sources (outside this package):
  W = the HouseBets workshop folder two levels above the package (bundles, 13 Oct full capture + ledger)
Every exhibit records its source path and the sha256 of the source bytes it was cut from."""
import hashlib, json, os, re, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__)); PKG = os.path.dirname(HERE)
W = os.path.abspath(os.path.join(PKG, '..', '..', 'housebets-new-deal-2026-10-09'))
EV = os.path.join(PKG, 'evidence'); os.makedirs(EV, exist_ok=True)
pkg = json.load(open(os.path.join(PKG, 'package.json')))
GAME = pkg['name'].split('-')[1]                     # housebets-<game>-audit
SLUG = {'roulette': 'roulette2', 'keno': 'keno2'}[GAME]
LEDGER_GAME = {'roulette': 'housegames-roulette', 'keno': 'housegames-keno'}[GAME]
sha = lambda b: hashlib.sha256(b).hexdigest()
def dump(name, obj):
    open(os.path.join(EV, name), 'w', encoding='utf-8').write(json.dumps(obj, indent=2, ensure_ascii=False) + '\n'); print('wrote', name)

ac = [f for f in os.listdir(os.path.join(PKG, 'data', 'as-captured')) if f.endswith('.json')][0]
raw = open(os.path.join(PKG, 'data', 'as-captured', ac), 'rb').read(); cap = json.loads(raw)
pf = cap['meta']['preflight']
src = {'file': f'data/as-captured/{ac}', 'sha256': sha(raw)}

# E01 the server's published spec, as answered to the capture (GET /housegames/<slug>/fairness)
dump(f'E01-{GAME}-fairness-spec-2026-10-12.json', {'exhibit': 'E01', 'what': f'HouseBets House Games {GAME}: the server\'s published fairness spec (GET /housegames/{SLUG}/fairness)',
     'source': dict(src, field='meta.preflight.fairness'), 'answer': pf['fairness']})

# E02 the game page's rules panel (English), as shipped in the bundle the live page loads (checked 10 Oct 2026, bundles/LIVE-BUNDLES.md)
bp = os.path.join(W, 'bundles', f'platform-housegames-{SLUG}-game.js'); braw = open(bp, 'rb').read(); bt = braw.decode('utf-8', 'replace')
strings = {}
for m in re.finditer(r'\b(rules[A-Za-z]+):"((?:[^"\\]|\\.)*)"', bt):
    if m.group(1) in strings: break                  # the English block comes first; the first repeated key starts the next language
    strings[m.group(1)] = m.group(2)
assert len(strings) >= 15, 'rules panel not found'
dump(f'E02-{GAME}-rules-panel-2026-10-10.json', {'exhibit': 'E02', 'what': f'HouseBets {GAME} game page: the rules panel text (English) as shipped in the bundle the live page loads',
     'source': {'file': f'bundles/platform-housegames-{SLUG}-game.js (HouseBets workshop)', 'sha256': sha(braw), 'bytes': len(braw), 'checkedOnLivePage': '2026-10-10 (bundles/LIVE-BUNDLES.md)'},
     'rulesPanelEnglish': strings})

# E03 the limits answer (min bet, max bet, max win, wallet decimals)
dump(f'E03-{GAME}-limits-2026-10-12.json', {'exhibit': 'E03', 'what': f'HouseBets {GAME} limits (GET /housegames/limits/{SLUG})',
     'source': dict(src, field='meta.preflight.limits'), 'answer': pf['limits']})

# E04 the platform bet-history rows of every round in this package's datasets
lp = os.path.join(W, 'capture-full-2026-10-12', 'ledger', 'ledger-2026-10-13-final.json'); lraw = open(lp, 'rb').read(); L = json.loads(lraw)
led = {x['id']: x for x in L['items']}
files = [f for f in sorted(os.listdir(os.path.join(PKG, 'data'))) if f.endswith('.json')] + ['supplementary/' + f for f in sorted(os.listdir(os.path.join(PKG, 'data', 'supplementary')))]
rows, missing = [], []
for f in files:
    for b in json.load(open(os.path.join(PKG, 'data', f)))['bets']:
        x = led.get(b['roundId'])
        if x is None: missing.append(b['roundId']); continue
        rows.append({k: x[k] for k in ('id', 'game', 'placed_at', 'stake', 'payout', 'currency', 'status')})
assert not missing, f'{len(missing)} rounds not in the ledger'
dump(f'E04-{GAME}-bet-history-2026-10-13.json', {'exhibit': 'E04', 'what': f'HouseBets bet history (GET /api/v1/transactions/bets?category=casino) rows of every {GAME} round in this package; fields id = roundId, stake, payout, status',
     'source': {'file': 'capture-full-2026-10-12/ledger/ledger-2026-10-13-final.json (HouseBets workshop)', 'sha256': sha(lraw), 'readAt': L['readAt'], 'entries': len(L['items'])},
     'rows': sorted(rows, key=lambda r: r['placed_at'])})

# E05 the whole-account reconciliation: the full stdout of the workshop's reconcile-full.py (every captured dataset of the
# 11 games against the platform's history and the wallet). The workshop's saved RECONCILE-2026-10-13-final.txt is only the
# last 8 lines of this output; the re-run must end in exactly those 8 lines and print RECONCILED.
import subprocess
CF = os.path.join(W, 'capture-full-2026-10-12')
out = subprocess.run([sys.executable, '-I', 'reconcile-full.py', '--ledger', 'ledger/ledger-2026-10-13-final.json'], cwd=CF, capture_output=True, text=True, check=True).stdout
saved = open(os.path.join(CF, 'ledger', 'RECONCILE-2026-10-13-final.txt'), encoding='utf-8').read()
assert out.endswith(saved) and out.rstrip().endswith('RECONCILED'), 'reconcile re-run differs from the saved tail'
open(os.path.join(EV, 'E05-account-reconcile-2026-10-13.txt'), 'w', encoding='utf-8').write(out); print('wrote E05 (full reconcile-full.py output)')

# E06 the empty-client-seed control of Phase D (POST /change_seed with clientSeed "")
dname = [f for f in os.listdir(os.path.join(PKG, 'data', 'supplementary')) if '-phaseD-' in f][0]
dp = os.path.join(PKG, 'data', 'supplementary', dname); draw = open(dp, 'rb').read()
dump(f'E06-{GAME}-empty-seed-control-2026-10-13.json', {'exhibit': 'E06', 'what': 'Phase D empty-seed control: the server\'s answer to POST /change_seed {clientSeed: ""}',
     'source': {'file': f'data/supplementary/{dname}', 'sha256': sha(draw), 'field': 'meta.emptySeedControl'}, 'record': json.loads(draw)['meta']['emptySeedControl']})

# E07 (keno only) the game bundle's own paytable and its auto-pick, cut verbatim from the bundle the live page loads
if GAME == 'keno':
    i = bt.index('Af={classic:'); j = i + 3; depth = 0
    for k in range(j, len(bt)):
        depth += {'{': 1, '}': -1}.get(bt[k], 0)
        if depth == 0: lit = bt[j:k + 1]; break
    table = json.loads(re.sub(r'([{,])(classic|low|medium|high):', r'\1"\2":', lit))
    a = bt.index('function ph(e){'); z = bt.index('function fh(e){')
    dump('E07-keno-bundle-paytable-autopick-2026-10-10.json', {'exhibit': 'E07', 'what': 'HouseBets keno2 game bundle: its own paytable (Af, micro-multipliers x1e6, index = hits) and its auto-pick code (ph, $A), cut verbatim',
         'source': {'file': f'bundles/platform-housegames-{SLUG}-game.js (HouseBets workshop)', 'sha256': sha(braw), 'bytes': len(braw), 'checkedOnLivePage': '2026-10-10 (bundles/LIVE-BUNDLES.md)'},
         'paytableLiteral': 'Af=' + lit, 'paytableMicro': table, 'autoPickCode': bt[a:z]})
