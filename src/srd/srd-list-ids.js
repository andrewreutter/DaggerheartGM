/**
 * Slugs and top-level list IDs for SRD collections (`/api/srd`, unified library).
 * Must stay in sync with historical `src/srd/parser.js` behavior.
 */

export function slugifySrdListName(name) {
  if (name == null || typeof name !== 'string') return '';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Prefixes for `makeSrdListId` — same as legacy parser `COLLECTION_PREFIXES`. */
export const SRD_LIST_COLLECTION_PREFIXES = {
  abilities: 'srd-abl',
  adversaries: 'srd-adv',
  ancestries: 'srd-anc',
  armor: 'srd-arm',
  beastforms: 'srd-bst',
  classes: 'srd-cls',
  communities: 'srd-com',
  consumables: 'srd-cns',
  domains: 'srd-dom',
  environments: 'srd-env',
  items: 'srd-itm',
  subclasses: 'srd-sub',
  weapons: 'srd-wpn',
};

/**
 * @param {string} collection — key in {@link SRD_LIST_COLLECTION_PREFIXES}
 * @param {string} name — display name from SRD / registry row
 * @returns {string} e.g. `srd-abl-a-soldier-s-bond` for "A Soldier's Bond"
 */
export function makeSrdListId(collection, name) {
  const prefix = SRD_LIST_COLLECTION_PREFIXES[collection] || 'srd';
  return `${prefix}-${slugifySrdListName(name)}`;
}
