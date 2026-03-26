/**
 * Native `title` / hover text for {@link CharacterDisplay} `ModifierChip`.
 * Prefer `mod.description` when set so table/runtime modifiers show SRD prose.
 */

import { getFrequencyCycleWord } from './frequency-cycle-ui.jsx';

/**
 * @param {object} mod — modifier { name, mode?, bonus?, type?, refreshOn?, description? }
 * @param {{ tooltip?: string, eligible?: boolean }} [opts]
 * @returns {string}
 */
export function buildModifierChipHoverTitle(mod, { tooltip, eligible = true } = {}) {
  if (tooltip != null && tooltip !== '') return tooltip;
  const desc = typeof mod?.description === 'string' && mod.description.trim();
  if (desc) return mod.description.trim();

  const isRollMod = mod.mode === 'roll' || (mod.bonus != null && !mod.mode);
  const isClearStress = mod.mode === 'clearStress';
  const isPersistent = mod.type === 'persistent';

  if (!eligible) return `${mod.name} — not eligible right now`;
  if (isPersistent) {
    const w = getFrequencyCycleWord(mod.refreshOn) ?? 'rest';
    return `${mod.name} (active until ${w})`;
  }
  return `${mod.name} — click to ${isRollMod ? 'include in next roll' : isClearStress ? 'roll to clear Stress' : 'use'}`;
}
