/**
 * SRD item — Flickerfly Pendant (roll table 48).
 * Physical melee weapons reach Very Close while you carry the pendant.
 */

function resolveWeaponList(character, registry) {
  if (Array.isArray(character.weapons) && character.weapons.length) {
    const out = [...character.weapons];
    for (const vw of character.virtualWeapons ?? []) {
      if (vw && !out.some((x) => x?.id === vw?.id)) out.push(vw);
    }
    return out;
  }
  const out = [];
  const ids = [
    character.primaryWeaponId,
    character.secondaryWeaponId,
    ...(character.weaponIds || []),
  ].filter(Boolean);
  for (const id of ids) {
    const w = registry?.weapons?.[id];
    if (w) out.push({ ...w, id: w.id ?? id });
  }
  if (character.primaryWeapon) {
    const pw = character.primaryWeapon;
    if (!out.some((x) => x?.id === pw.id)) out.unshift(pw);
  }
  if (character.secondaryWeapon) {
    const sw = character.secondaryWeapon;
    if (!out.some((x) => x?.id === sw.id)) out.push(sw);
  }
  for (const vw of character.virtualWeapons ?? []) {
    if (vw && !out.some((x) => x?.id === vw?.id)) out.push(vw);
  }
  return out;
}

function isPhysicalMeleeWeapon(w) {
  if (!w || typeof w !== 'object') return false;
  const r = String(w.baseRange ?? w.range ?? '').toLowerCase();
  if (r !== 'melee') return false;
  if (w._otherworldly === 'magical') return false;
  if (w.damageType === 'Magical') return false;
  const dmg = String(w.damage ?? '').toLowerCase();
  if (dmg.includes('mag') && !dmg.includes('phy')) return false;
  return true;
}

export const FlickerflyPendant = {
  name: 'Flickerfly Pendant',
  description:
    'While you carry this pendant, your weapons with a Melee range that deal physical damage have a gossamer sheen and can attack targets within Very Close range.',
  computeWeaponRenderHints(_table, character, registry) {
    const hints = {};
    for (const w of resolveWeaponList(character, registry)) {
      if (!isPhysicalMeleeWeapon(w)) continue;
      if (w.id) hints[w.id] = { range: 'veryClose' };
    }
    return hints;
  },
};
