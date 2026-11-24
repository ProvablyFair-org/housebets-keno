// HouseBets House Games keno (keno2), new engine ("canonical"), derived from the published spec only
// (E01, GET /housegames/keno2/fairness, answered to the capture 12 Oct 2026 17:07:28Z; the same derivation
// capture-2026-10-12/check_specs.py matched on the spec's examples).
//   block_i = HMAC-SHA256(key = serverSeed as UTF-8, message = `${clientSeed}:${nonce}:${i}`)
//   u_i     = bytes 4i..4i+3 of block_0 ‖ block_1, big-endian (i = 0 … 9)
//   ball i  = the number at position floor(u_i × (40 − i) / 2^32) among the numbers not yet drawn, kept in ascending order
// Integer arithmetic: u × 40 < 2^38, exact in binary64, and the division is by a power of two.
import { createHmac, createHash } from 'node:crypto';
import { GRID, DRAWN } from './spec.ts';

export function hmacBlock(serverSeed: string, clientSeed: string, nonce: number, block: number): Buffer {
  return createHmac('sha256', Buffer.from(serverSeed, 'utf8')).update(`${clientSeed}:${nonce}:${block}`).digest();
}

/** The declared map from a 32-bit draw u to a position among `range` remaining numbers: floor(u · range / 2^32).
 *  KENO-08 censuses THIS function for every range the draw uses (40 … 31). */
export const indexFromU = (u: number, range: number): number => Math.floor((u * range) / 4294967296);

/** The ten balls of (serverSeed, clientSeed, nonce), in draw order. The message carries no pick, risk or stake (KENO-17). */
export function ballsOf(serverSeed: string, clientSeed: string, nonce: number): number[] {
  const bytes = Buffer.concat([hmacBlock(serverSeed, clientSeed, nonce, 0), hmacBlock(serverSeed, clientSeed, nonce, 1)]);
  const left = Array.from({ length: GRID }, (_, i) => i), out: number[] = [];
  for (let i = 0; i < DRAWN; i++) out.push(left.splice(indexFromU(bytes.readUInt32BE(4 * i), GRID - i), 1)[0]);
  return out;
}

export const sha256Hex = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
