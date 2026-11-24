// The KENO profile's 32 checks (id, name, layer, kind, policy), generated from the framework's games/keno/profile.public.json
// (profileVersion 1.0.4-public, sha256 aee3e8e3b581622e6fbb93142cf90e7fd9c4ebf3b0fe3c77e7cd7353ce0740a8). Regenerate rather than edit (scripts/gen-profile-map.mjs).
export type Policy = 'HARD_FAIL' | 'FLAG' | 'INFORMATIONAL' | 'GRADED' | 'RELEASE_GATE';
export interface ProfileCheck { id: string; name: string; layer: string; kind: 'verifier-step' | 'package-check'; policy: Policy }
export const PROFILE_SHA256 = 'aee3e8e3b581622e6fbb93142cf90e7fd9c4ebf3b0fe3c77e7cd7353ce0740a8';
export const PROFILE_VERSION = "1.0.4-public";
export const PROFILE: readonly ProfileCheck[] = [
  { id: "KENO-01", name: "Seed hash integrity", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-02", name: "Forward commitment chain", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-03", name: "Hash consistency within epoch", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-04", name: "Nonce continuity", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-05", name: "Population & epoch size (G-BIND)", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-06", name: "Client-seed influence & Phase D recomputation", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-07", name: "Outcome recomputation (drawn set)", layer: "S2", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-08", name: "Draw bias bound", layer: "S2", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-09", name: "RNG reference vectors", layer: "S2", kind: "package-check", policy: "GRADED" },
  { id: "KENO-10", name: "Draw structure & hit counting", layer: "S2", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-11", name: "Payout arithmetic", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-12", name: "Bet-size invariance (Phase C)", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-13", name: "Paytable provenance & served-vs-declared", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-14", name: "Paytable shape & bounds", layer: "S3", kind: "verifier-step", policy: "FLAG" },
  { id: "KENO-15", name: "Configuration & cell coverage", layer: "S3", kind: "verifier-step", policy: "FLAG" },
  { id: "KENO-16", name: "Wallet / balance reconciliation", layer: "S3", kind: "verifier-step", policy: "FLAG" },
  { id: "KENO-17", name: "Pick-set independence", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-18", name: "Anti-circularity (hit probability)", layer: "S4", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-19", name: "Per-config RTP by exact enumeration vs claim", layer: "S4", kind: "verifier-step", policy: "FLAG" },
  { id: "KENO-20", name: "Simulation Pass 1 (fresh seeds)", layer: "S4", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-21", name: "Simulation Pass 2 (cherry-pick)", layer: "S4", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-22", name: "Live-sample fit", layer: "S4", kind: "verifier-step", policy: "INFORMATIONAL" },
  { id: "KENO-23", name: "S5 fairness-integrity matrix", layer: "S5", kind: "package-check", policy: "GRADED" },
  { id: "KENO-24", name: "Player-verifier parity", layer: "S6", kind: "package-check", policy: "GRADED" },
  { id: "KENO-25", name: "Player check path documented", layer: "S6", kind: "package-check", policy: "GRADED" },
  { id: "KENO-26", name: "Dataset & config pins", layer: "S7", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-27", name: "Artifacts of record", layer: "S7", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-28", name: "Fresh-clone reproduction", layer: "S7", kind: "package-check", policy: "RELEASE_GATE" },
  { id: "KENO-29", name: "Mutation battery", layer: "S7", kind: "package-check", policy: "GRADED" },
  { id: "KENO-30", name: "Disclosure register & evidence appendix", layer: "S7", kind: "package-check", policy: "GRADED" },
  { id: "KENO-31", name: "Scaling-edge / bet-size tier audit", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "KENO-32", name: "Auto-pick vs manual pick", layer: "S3", kind: "verifier-step", policy: "FLAG" },
];
