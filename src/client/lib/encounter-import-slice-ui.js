/**
 * OCR keyword hints for which import action to emphasize (case-insensitive, word boundaries).
 *
 * @returns {{ map: boolean, adversary: boolean, environment: boolean, note: boolean }}
 */
export function inferEncounterImportSuggestions(ocrHasText, ocrText) {
  if (!ocrHasText) {
    return { map: true, adversary: false, environment: false, note: false };
  }
  const t = String(ocrText || '');
  const adversary = /\b(Motives|Tactics|Attack)\b/i.test(t);
  const environment = /\b(Impulses|Potential)\b/i.test(t);
  if (adversary || environment) {
    return {
      map: false,
      adversary,
      environment,
      note: false,
    };
  }
  return { map: false, adversary: false, environment: false, note: true };
}

/**
 * Subtext for encounter import modal action buttons (slice OCR + ignore checkbox).
 *
 * @param {'map'|'adversary'|'environment'|'note'} kind
 */
export function encounterImportSliceSubtitle(kind, hasText, ignoreText) {
  if (kind === 'map') return hasText ? 'Ignore text' : 'Use image';
  if (!hasText) {
    if (kind === 'adversary') return 'Attach to new adversary';
    if (kind === 'environment') return 'Attach to new environment';
    return 'Attach to new note';
  }
  if (ignoreText) {
    if (kind === 'adversary') return 'Attach to new adversary';
    if (kind === 'environment') return 'Attach to new environment';
    return 'Attach to new note';
  }
  if (kind === 'adversary') return 'Parse text';
  if (kind === 'environment') return 'Parse text';
  return 'Use text';
}
