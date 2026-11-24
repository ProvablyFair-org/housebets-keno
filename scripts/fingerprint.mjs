// The code fingerprint that binds a record to the code and data it ran against (14 Oct 2026; the same
// codeFingerprint as the mines and road packages' scripts/fingerprint.mjs, with profile/ added). Plain JavaScript so the .mjs scripts (mutate,
// fresh-copy-check) and tests/verify.ts (and its bundle verify.js) share ONE definition.
//   codeFingerprint(root): every file the verification depends on — src/, tests/, scripts/, data/, evidence/, profile/ (the
//                          vendored framework profile), package.json and the three pinned outputs — as sorted
//                          "path<TAB>sha256" lines, hashed. The mutation and fresh-copy records carry it; KENO-28 and KENO-29
//                          reject a record whose fingerprint is not the current one (a record of other code is not evidence).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);
const listed = (root, paths) => paths.map((p) => relative(root, p).split('\\').join('/')).sort().map((r) => `${r}\t${sha(readFileSync(join(root, r)))}`).join('\n') + '\n';

export const PINNED_OUTPUTS = ['outputs/simulation-results.json', 'outputs/rtp-claim-table.json', 'outputs/verification-results.json'];

export function codeFingerprint(root) {
  const files = [...['src', 'tests', 'scripts', 'data', 'evidence', 'profile'].flatMap((d) => walk(join(root, d))),
    ...['package.json', ...PINNED_OUTPUTS].map((f) => join(root, f)).filter((p) => existsSync(p))];
  return sha(listed(root, files));
}
