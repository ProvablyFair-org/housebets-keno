#!/usr/bin/env node
// Generates src/profile-map.ts from the framework profile (id, name, layer, kind, policy) — regenerate rather than edit.
// usage: node scripts/gen-profile-map.mjs <path/to/profile.json> <PREFIX> <framework-relative path for the header>
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const [src, prefix, rel] = process.argv.slice(2);
const raw = readFileSync(src); const p = JSON.parse(raw.toString('utf8'));
const sha = createHash('sha256').update(raw).digest('hex');
const lines = p.checks.map((c) => `  { id: ${JSON.stringify(c.id)}, name: ${JSON.stringify(c.name)}, layer: ${JSON.stringify(c.layer)}, kind: ${JSON.stringify(c.kind)}, policy: ${JSON.stringify(c.policy)} },`);
const out = `// The ${prefix} profile's ${p.checks.length} checks (id, name, layer, kind, policy), generated from ${rel}
// (profileVersion ${p.profileVersion}, sha256 ${sha}). Regenerate rather than edit (scripts/gen-profile-map.mjs).
export type Policy = 'HARD_FAIL' | 'FLAG' | 'INFORMATIONAL' | 'GRADED' | 'RELEASE_GATE';
export interface ProfileCheck { id: string; name: string; layer: string; kind: 'verifier-step' | 'package-check'; policy: Policy }
export const PROFILE_SHA256 = '${sha}';
export const PROFILE_VERSION = ${JSON.stringify(p.profileVersion)};
export const PROFILE: readonly ProfileCheck[] = [
${lines.join('\n')}
];
`;
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'profile-map.ts'), out);
console.log(`wrote src/profile-map.ts: ${p.checks.length} checks, profile sha256 ${sha}`);
