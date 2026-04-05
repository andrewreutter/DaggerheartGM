/**
 * Server-side tool payload for the character AI builder: full SRD rows by id.
 * Hydrates from {@link loadSrdDataForV2Engine} maps (no DB).
 */

export const CHARACTER_BUILDER_DETAIL_COLLECTIONS = [
  'classes',
  'subclasses',
  'ancestries',
  'communities',
  'armor',
  'weapons',
  'abilities',
];

export const CHARACTER_BUILDER_DETAIL_COLLECTION_SET = new Set(CHARACTER_BUILDER_DETAIL_COLLECTIONS);

export const MAX_CHARACTER_BUILDER_FETCH_ITEMS = 120;

const COLLECTION_TO_BYID = {
  classes: 'classesById',
  subclasses: 'subclassesById',
  ancestries: 'ancestriesById',
  communities: 'communitiesById',
  armor: 'armorById',
  weapons: 'weaponsById',
  abilities: 'abilitiesById',
};

function cloneRow(row) {
  if (row == null || typeof row !== 'object') return null;
  try {
    return structuredClone(row);
  } catch {
    return JSON.parse(JSON.stringify(row));
  }
}

/**
 * @param {Array<{ collection?: string, id?: string }>} items
 * @param {object} srdData — shape from loadSrdDataForV2Engine()
 * @returns {{
 *   items: Record<string, Record<string, object>>,
 *   notFound: { collection: string, id: string }[],
 *   truncated: boolean,
 *   skippedInvalid: { collection?: string, id?: string, reason: string }[],
 * }}
 */
export function fetchCharacterBuilderDetails(rawItems, srdData) {
  /** @type {{ collection?: string, id?: string, reason: string }[]} */
  const skippedInvalid = [];
  const notFound = [];

  if (!Array.isArray(rawItems)) {
    return {
      items: {},
      notFound: [],
      truncated: false,
      skippedInvalid: [{ reason: 'items must be a non-empty array' }],
    };
  }

  const normalized = [];
  for (const entry of rawItems) {
    if (!entry || typeof entry !== 'object') {
      skippedInvalid.push({ reason: 'entry not an object' });
      continue;
    }
    const collection = typeof entry.collection === 'string' ? entry.collection.trim() : '';
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!collection || !id) {
      skippedInvalid.push({ collection, id, reason: 'missing collection or id' });
      continue;
    }
    if (!CHARACTER_BUILDER_DETAIL_COLLECTION_SET.has(collection)) {
      skippedInvalid.push({ collection, id, reason: 'unknown collection' });
      continue;
    }
    normalized.push({ collection, id });
  }

  const truncated = normalized.length > MAX_CHARACTER_BUILDER_FETCH_ITEMS;
  const slice = truncated ? normalized.slice(0, MAX_CHARACTER_BUILDER_FETCH_ITEMS) : normalized;

  /** @type {Record<string, Record<string, object>>} */
  const items = {};

  for (const { collection, id } of slice) {
    const byIdKey = COLLECTION_TO_BYID[collection];
    const map = srdData[byIdKey];
    const row = map && typeof map === 'object' ? map[id] : null;
    if (!row) {
      notFound.push({ collection, id });
      continue;
    }
    if (!items[collection]) items[collection] = {};
    items[collection][id] = cloneRow(row);
  }

  if (truncated) {
    skippedInvalid.push({
      reason: `only first ${MAX_CHARACTER_BUILDER_FETCH_ITEMS} items were processed; call the tool again with additional ids if needed`,
    });
  }

  return { items, notFound, truncated, skippedInvalid };
}
