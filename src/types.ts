// Shapes of the HouseBets new-engine keno capture (schema housebets-keno2-capture-sp1, rig 12 Oct 2026).
// Only the fields the verifier reads are typed; the dataset carries more (raw answers under `_raw`).

export interface Bet {
  idx: number;
  epoch: number;
  nonce: number;
  cls: string;
  at: string;
  setting: { cls: string; risk: string; spots: number[] };
  request: { amount: number; risk: string; spots: number[] };
  stake: number;
  outcome: number[];            // the balls the server answered, in draw order
  echoedSpots: number[];
  echoedRisk: string;
  hits: number;
  micro: number;
  payoutMultiplier: number;
  payout: number;
  gameStake: number;
  roundStake: number;
  roundPayout: number;
  roundId: string;
  respClientSeed: string;
  respHashedSeed: string;
  balance: number;
  _raw: { game?: { roundId: string; risk: string; spots: number[]; balls: number[]; hits: number; micro: number; multiplier: number; stake: number | string; payout: number | string; outcome: string };
          round?: { roundId: string; stake: string | number; payout: string | number } };
}

export interface Seed {
  seedId: string | number;
  epoch: number | string;
  clientSeed: string;
  clientSeedSource?: string;
  hashedServerSeed: string;
  hashedNextServerSeed: string;
  revealedServerSeed: string;
  nonceStart: number | string;
  nonceEnd: number | string;
  serverNonceAtRotation: number | string;
}

export interface Dataset {
  meta: { epochSize: number; schema: string; split?: { part: string; epochs: [number, number] } };
  preCapture?: { clientSeed: string; hashedServerSeed: string; hashedNextServerSeed: string };
  seeds: Seed[];
  bets: Bet[];
}
