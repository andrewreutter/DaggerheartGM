/**
 * Validates a relative path under the V2 features tree for safe file reads (no traversal).
 * @param {string} baseDir — absolute root (e.g. …/src/features-v2)
 * @param {string} raw — query value like `classes/Bard.js`
 * @returns {string|null} absolute path, or null if invalid
 */
import { resolve, sep } from 'node:path';

export function safeResolveUnderFeaturesRoot(baseDir, raw) {
  if (typeof raw !== 'string' || !raw) return null;
  const t = raw.trim();
  if (t.includes('..') || t.includes('\0')) return null;
  if (!/^[a-zA-Z0-9_./-]+\.js$/.test(t)) return null;
  const abs = resolve(baseDir, t);
  const root = resolve(baseDir);
  if (abs !== root && !abs.startsWith(root + sep)) return null;
  return abs;
}
