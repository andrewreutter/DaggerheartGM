/**
 * Normalize LLM environment draft output into a safe form patch.
 */

import { randomUUID } from 'crypto';
import { ENV_TYPES } from './game-constants.js';

function clampInt(n, lo, hi) {
  const x = parseInt(n, 10);
  if (Number.isNaN(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function normalizeType(raw) {
  const t = String(raw || '').toLowerCase().trim();
  return ENV_TYPES.includes(t) ? t : 'exploration';
}

function normalizePotentialAdversaries(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (typeof x === 'string') {
          const name = x.trim();
          return name ? { name } : null;
        }
        if (x && typeof x === 'object') {
          const name = String(x.name || '').trim();
          if (!name) return null;
          const adversaryId = typeof x.adversaryId === 'string' && x.adversaryId ? x.adversaryId : undefined;
          return adversaryId ? { adversaryId, name } : { name };
        }
        return null;
      })
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  }
  return [];
}

/**
 * @param {object} raw — LLM `environment` object
 * @param {{ lockTier?: number, lockType?: string }} [opts] — when set, tier/type come from the form, not the draft
 * @returns {{ patch: object, warnings: string[] }}
 */
export function resolveEnvironmentAiDraft(raw, opts = {}) {
  const warnings = [];
  if (!raw || typeof raw !== 'object') {
    return { patch: {}, warnings: ['Empty environment draft'] };
  }

  const tier =
    opts.lockTier != null ? clampInt(opts.lockTier, 1, 4) : clampInt(raw.tier, 1, 4);
  const type =
    opts.lockType != null ? normalizeType(opts.lockType) : normalizeType(raw.type);
  let difficulty = parseInt(raw.difficulty, 10);
  if (Number.isNaN(difficulty)) difficulty = 10;
  difficulty = Math.max(1, Math.min(30, difficulty));

  const features = Array.isArray(raw.features)
    ? raw.features.map((f) => {
        const name = typeof f?.name === 'string' ? f.name.trim() : '';
        const description = typeof f?.description === 'string' ? f.description : '';
        const typeRaw = String(f?.type || 'action').toLowerCase();
        const ft = ['action', 'reaction', 'passive'].includes(typeRaw) ? typeRaw : 'action';
        return {
          id: typeof f?.id === 'string' && f.id ? f.id : randomUUID(),
          name,
          type: ft,
          description,
        };
      })
    : [];

  const patch = {
    name: typeof raw.name === 'string' ? raw.name.trim() : '',
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    impulses: typeof raw.impulses === 'string' ? raw.impulses.trim() : '',
    tier,
    type,
    difficulty,
    potential_adversaries: normalizePotentialAdversaries(raw.potential_adversaries),
    features,
  };

  if (!patch.name) warnings.push('Environment name was empty — user should set a name.');

  return { patch, warnings };
}
