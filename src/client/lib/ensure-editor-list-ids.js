import { generateId } from './helpers.js';

/**
 * List rows for item editors (features, experiences, etc.): ensure each entry has `id`.
 * @param {Array|undefined} arr
 * @returns {Array}
 */
export function ensureEditorListIds(arr) {
  return (arr || []).map(entry => (entry && entry.id ? entry : { ...entry, id: generateId() }));
}
