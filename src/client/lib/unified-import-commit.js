import { postEncounterParseText } from './api.js';

/**
 * @param {string} ocrText
 * @param {string} additionalText
 */
export function mergeOcrAndAdditional(ocrText, additionalText) {
  const a = (additionalText || '').trim();
  const o = (ocrText || '').trim();
  if (!a) return o;
  if (!o) return a;
  return `${o}\n\n${a}`;
}

/** Defaults when OCR is skipped or empty (matches Game Table encounter import). */
export function defaultAdversaryStub(id, imageUrl = '') {
  return {
    id,
    name: 'New Adversary',
    tier: 1,
    role: 'standard',
    motive: '',
    description: '',
    imageUrl: imageUrl || '',
    difficulty: 10,
    hp_max: 6,
    hp_thresholds: { major: 3, severe: 5 },
    stress_max: 4,
    attack: { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' },
    experiences: [],
    features: [],
    is_public: false,
  };
}

export function defaultEnvironmentStub(id, imageUrl) {
  return {
    id,
    name: 'New Environment',
    tier: 1,
    type: 'exploration',
    difficulty: 10,
    description: '',
    impulses: '',
    imageUrl: imageUrl || '',
    features: [],
    potential_adversaries: [],
    is_public: false,
  };
}

export async function buildAdversaryFromSlice(payload, id, additionalText) {
  const merged = mergeOcrAndAdditional(payload.ocrText, additionalText);
  if (payload.ocrHasText && !payload.ignoreText && merged.trim()) {
    const result = await postEncounterParseText(merged, 'adversary');
    return { ...result.item, id, imageUrl: payload.dataUrl };
  }
  return { ...defaultAdversaryStub(id, payload.dataUrl), id, imageUrl: payload.dataUrl };
}

export async function buildEnvironmentFromSlice(payload, id, additionalText) {
  const merged = mergeOcrAndAdditional(payload.ocrText, additionalText);
  if (payload.ocrHasText && !payload.ignoreText && merged.trim()) {
    const result = await postEncounterParseText(merged, 'environment');
    return { ...result.item, id, imageUrl: payload.dataUrl };
  }
  return { ...defaultEnvironmentStub(id, payload.dataUrl), id, imageUrl: payload.dataUrl };
}

export async function buildNoteFromSlice(payload, id, additionalText) {
  const merged = mergeOcrAndAdditional(payload.ocrText, additionalText);
  if (payload.ocrHasText && !payload.ignoreText && merged.trim()) {
    const result = await postEncounterParseText(merged, 'note');
    return {
      id,
      name: result.item?.name || 'Note',
      body: result.item?.body ?? '',
      imageUrl: payload.dataUrl,
    };
  }
  return { id, name: 'Note', body: '', imageUrl: payload.dataUrl };
}
