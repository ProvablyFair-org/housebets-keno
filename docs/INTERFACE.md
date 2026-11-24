# Module interface of `src/rng.ts` (written by the auditor, not from the casino)

`src/rng.ts` is TypeScript (strict), uses only the Node `crypto` module and has no dependencies beyond `GRID` (40) and
`DRAWN` (10) from `src/spec.ts`. It exports exactly these names; their semantics are in [ALGORITHM.md](ALGORITHM.md), and
this file fixes only names, types and the package's own conventions. Server seeds are the 64-character lowercase hex text the
casino reveals; the HMAC key and the commitment both use that text as UTF-8, never the bytes it encodes. Tiles are integers
0 … 39 (the game shows tile t as t + 1).

```ts
// The HMAC-SHA256 block for (seeds, nonce, block): key = UTF-8(serverSeed), message = `${clientSeed}:${nonce}:${block}`.
// The draw reads blocks 0 and 1.
export function hmacBlock(serverSeed: string, clientSeed: string, nonce: number, block: number): Buffer;
// The declared map from a 32-bit draw u to a position among `range` remaining tiles: floor(u × range / 2^32).
export const indexFromU: (u: number, range: number) => number;
// The ten balls of (serverSeed, clientSeed, nonce), in draw order (= the order the round record serves them).
// Takes no pick, risk or stake.
export function ballsOf(serverSeed: string, clientSeed: string, nonce: number): number[];
// SHA-256 of a string's UTF-8 bytes, lowercase hex: the commitment of a server seed.
export const sha256Hex: (s: string) => string;
```

Hits, the paytable lookup and the payout are NOT part of this module; they are in `src/rules.ts` (`hitsOf`, `microOf`,
`payout8`, `units8`, `onGrid8`, `legalPicks`, `isRisk`, and the exact hypergeometric `choose`, `D`, `hitWeight`,
`hitChanceAlt`, `moments`), with the published paytable in `src/spec.ts`. `src/xoshiro.ts` (`xoshiro128ss`) is the
package's only non-cryptographic generator; it never draws a game ball (`ballsOf` draws every simulated round's balls). It
chooses the simulation's pick sets and drives the Monte Carlo replicates of the Pass 2 false-alarm rate and of the tile
screen's false-alarm rate (`src/false-alarm-tiles.ts`, which draws its uniform reference rounds of 10 tiles with it).
