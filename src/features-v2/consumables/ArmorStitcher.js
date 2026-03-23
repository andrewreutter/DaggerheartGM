/**
 * SRD consumable — Armor Stitcher (common roll table 21).
 * daggerheart-srd/consumables/Armor Stitcher.md
 */

/** @returns {{ id: string, name: string, description: string }[]} */
function stitcherSpendOptions(table) {
  const hope = Math.max(0, Math.floor(table.me?.hope ?? 0));
  const maxArmor = Math.max(0, Math.floor(table.me?.maxArmor ?? 0));
  const avail = Math.max(0, Math.floor(table.me?.armor ?? 0));
  const marked = Math.max(0, maxArmor - avail);
  const cap = Math.min(hope, marked);
  if (cap < 1) return [];
  return Array.from({ length: cap }, (_, i) => {
    const n = i + 1;
    return {
      id: String(n),
      name: `Spend ${n} Hope — clear ${n} armor slot${n === 1 ? '' : 's'}`,
      description: `Spend ${n} Hope and clear ${n} marked armor slot${n === 1 ? '' : 's'}.`,
    };
  });
}

export const ArmorStitcher = {
  name: 'Armor Stitcher',
  description:
    'You can use this stitcher to spend any number of Hope and clear that many Armor Slots.',
  isSelect: (table) => stitcherSpendOptions(table),
  isDisabled: (table) =>
    stitcherSpendOptions(table).length < 1
      ? 'Need Hope and at least one marked armor slot to clear.'
      : false,
  /**
   * Variable Hope is applied here (not `hopeCost` on the card): some hosts run
   * `deductChipCosts` before `activateChip`, so costs tied to `selectedId` must be manual.
   */
  onUse(table, chipState) {
    const raw = chipState.get?.('selectedId');
    const n = Math.max(0, Math.floor(Number(raw)) || 0);
    if (n < 1) return;

    const maxArmor = Math.max(0, Math.floor(table.me?.maxArmor ?? 0));
    const avail = Math.max(0, Math.floor(table.me?.armor ?? 0));
    const marked = Math.max(0, maxArmor - avail);
    const hope = Math.max(0, Math.floor(table.me?.hope ?? 0));
    const cap = Math.min(hope, marked);
    if (n > cap) return;

    table.me.spendHope(n);
    table.me.clearArmor(n);
  },
};
