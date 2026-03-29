import { ENV_TYPES } from './constants.js';

/** Align with SRD `ENV_TYPE_MAP` / game constants — never returns a value outside ENV_TYPES. */
export function coerceEnvironmentType(raw) {
  const k = String(raw ?? 'exploration').toLowerCase().trim();
  if (k === '') return 'exploration';
  const map = { exploration: 'exploration', social: 'social', traversal: 'traversal', event: 'event' };
  if (map[k]) return map[k];
  return ENV_TYPES.includes(k) ? k : 'exploration';
}

export function coerceEnvironmentTier(raw) {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : parseInt(String(raw ?? ''), 10);
  if (Number.isNaN(n) || n < 1 || n > 4) return null;
  return n;
}
