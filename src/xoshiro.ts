// xoshiro128** (Blackman & Vigna), seeded by splitmix32 — the package's only non-cryptographic generator. It never draws a
// ball: it chooses the simulation's pick sets (Pass 1) and the Monte Carlo replicates of the Pass 2 false-alarm rate.
export function xoshiro128ss(seed: number): () => number {
  let x = seed >>> 0;
  const sm = (): number => { x = (x + 0x9e3779b9) >>> 0; let z = x; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0; z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0; return (z ^ (z >>> 16)) >>> 0; };
  let a = sm(), b = sm(), c = sm(), d = sm();
  return (): number => {
    const r = Math.imul(((Math.imul(b, 5) << 7) | (Math.imul(b, 5) >>> 25)), 9) >>> 0;
    const t = b << 9;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
    return r / 4294967296;
  };
}
