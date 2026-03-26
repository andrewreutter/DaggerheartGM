/**
 * Resolve SRD domain spell pick lists (`domain.cards[].options`) to `abilities` collection rows.
 */

export function normalizeKey(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * @param {unknown} option - string name, or `{ id }`, or `{ name }`
 * @param {string} domainName - SRD domain display name (e.g. "Arcana")
 * @param {{ abilities?: object[], abilitiesById?: Record<string, object> }} srdData
 * @returns {object|null}
 */
export function resolveAbilityForDomainOption(option, domainName, srdData) {
  if (!srdData?.abilities?.length) return null;
  const dn = normalizeKey(domainName);
  const byId = srdData.abilitiesById || {};

  if (typeof option === 'string') {
    const on = normalizeKey(option);
    return (
      srdData.abilities.find(
        (a) => normalizeKey(a.domain) === dn && normalizeKey(a.name) === on,
      ) || null
    );
  }
  if (option && typeof option === 'object') {
    if (option.id && byId[option.id]) return byId[option.id];
    if (option.name) {
      const on = normalizeKey(option.name);
      return (
        srdData.abilities.find(
          (a) => normalizeKey(a.domain) === dn && normalizeKey(a.name) === on,
        ) || null
      );
    }
  }
  return null;
}

/**
 * @param {object} domainItem - normalized domain `{ name, cards: [{ level, options }] }`
 * @param {object} srdData
 * @returns {{ sections: Array<{ level: number, entries: Array<{ ability?: object, raw?: unknown }> }> }}
 */
export function expandDomainCardEntries(domainItem, srdData) {
  const sections = [];
  const cards = domainItem?.cards;
  if (!Array.isArray(cards)) return { sections: [] };
  const domainName = domainItem?.name || '';

  for (const tier of cards) {
    const level = tier?.level ?? 0;
    const opts = tier?.options;
    if (!Array.isArray(opts) || opts.length === 0) continue;
    const entries = opts.map((option) => {
      const ability = resolveAbilityForDomainOption(option, domainName, srdData);
      return ability ? { ability } : { raw: option };
    });
    sections.push({ level, entries });
  }
  return { sections };
}
