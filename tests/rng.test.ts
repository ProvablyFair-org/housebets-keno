// KENO-09 RNG reference vectors: the worked draws and settlements of HouseBets' own published keno spec
// (GET /housegames/keno2/fairness, read 12 Oct 2026: evidence/E01, "examples" and "payouts").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ballsOf } from '../src/rng.ts';
import { microOf, payout8, units8, hitsOf } from '../src/rules.ts';

const DEMO = 'housebets-demo-server-seed-0001';
const S64 = '5a1f7d2c9e4b8a3f6d0c2b5e8f1a4d7c0b3e6f9a2d5c8b1e4f7a0d3c6b9e2f5a';
test('spec example demo-client:1', () => assert.deepEqual(ballsOf(DEMO, 'demo-client', 1), [28, 7, 15, 11, 22, 3, 8, 38, 0, 34]));
test('spec example demo-client:2', () => assert.deepEqual(ballsOf(DEMO, 'demo-client', 2), [32, 34, 38, 36, 15, 25, 13, 2, 35, 20]));
test('spec example housebets:1', () => assert.deepEqual(ballsOf(S64, 'housebets', 1), [25, 10, 8, 18, 22, 28, 23, 37, 27, 38]));
test('spec example housebets:7', () => assert.deepEqual(ballsOf(S64, 'housebets', 7), [38, 32, 6, 15, 18, 9, 31, 13, 39, 1]));

const one = 100000000n;   // a stake of 1 in 1e-8 units
test('settlement: classic, 1 pick, 1 hit pays 3.96', () => assert.equal(payout8(one, microOf('classic', 1, 1)), units8('3.96')));
test('settlement: classic, 3 picks, 1 hit pays 0.999586', () => assert.equal(payout8(one, microOf('classic', 3, 1)), units8('0.999586')));
test('settlement: classic, 10 picks, 10 hits pays 100', () => assert.equal(payout8(one, microOf('classic', 10, 10)), units8('100')));
test('settlement: low, 1 pick, 0 hits pays 0.7', () => assert.equal(payout8(one, microOf('low', 1, 0)), units8('0.7')));
test('settlement: low, 10 picks, 2 hits pays 1.107732', () => assert.equal(payout8(one, microOf('low', 10, 2)), units8('1.107732')));
test('settlement: medium, 5 picks, 5 hits pays 391.46', () => assert.equal(payout8(one, microOf('medium', 5, 5)), units8('391.46')));
test('settlement: high, 10 picks, 10 hits pays 2000', () => assert.equal(payout8(one, microOf('high', 10, 10)), units8('2000')));
test('settlement: high, 4 picks, 3 hits pays 10', () => assert.equal(payout8(one, microOf('high', 4, 3)), units8('10')));
// a real bet from the primary dataset (its draw is recomputed from its seed in KENO-07/-09 of tests/verify.ts):
// idx 5, medium, picks [0], balls [29,16,25,10,28,38,22,36,12,4], 0 hits, stake 0.01000311, paid 0.00400124 (0.4× rounded down)
test('bet idx 5: medium, 1 pick, 0 hits pays floor(0.01000311 × 0.4) = 0.00400124', () => {
  assert.equal(hitsOf([0], [29, 16, 25, 10, 28, 38, 22, 36, 12, 4]), 0);
  assert.equal(payout8(units8(0.01000311), microOf('medium', 1, 0)), units8('0.00400124'));
});
