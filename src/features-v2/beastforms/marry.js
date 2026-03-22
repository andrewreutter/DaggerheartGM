/**
 * Join authored V2 beastform sub-features with SRD row metadata (`id`, `type`) from
 * `srd-data.js` / `BEASTFORM_ITEMS`, matched by **`name`** (verbatim SRD feature name).
 *
 * V2 modules export clean `{ name, description, ... }` objects (no ids). This function is
 * the single place that attaches stable SRD ids for persistence and lookups.
 */

/**
 * @param {object} srdRow — one row from `BEASTFORM_ITEMS` (must include `id`, `features[]` from JSON)
 * @param {object[]} v2Features — ordered list of feature descriptors (`name` must match SRD)
 * @returns {object[]}
 */
export function marryBeastformFeatures(srdRow, v2Features) {
  const srdList = Array.isArray(srdRow.features) ? srdRow.features : [];
  return v2Features.map((feat) => {
    if (!feat || typeof feat !== 'object' || !feat.name) {
      throw new Error('marryBeastformFeatures: each feature must be an object with a name');
    }
    const srd = srdList.find((f) => f.name === feat.name);
    if (!srd) {
      throw new Error(
        `marryBeastformFeatures: no SRD feature named "${feat.name}" on beastform ${srdRow.id}`
      );
    }
    return {
      ...feat,
      id: srd.id,
      type: srd.type ?? feat.type ?? 'passive',
    };
  });
}
