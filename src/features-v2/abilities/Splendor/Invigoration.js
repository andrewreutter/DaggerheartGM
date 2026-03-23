/**
 * Splendor domain — Invigoration (Level 10 / Tier 3 spell, Recall 3)
 * SRD: When you or an ally within Close range has used a limited-use feature, spend any number of Hope
 * and roll that many d6s; if any roll a 6, that feature can be used again.
 */

const ID_SEP = '\x1f';

function invigorationSelectOptions(table) {
  const me = table.me;
  if (!me?.instanceId) return [];
  const maxSpend = Math.max(0, Math.floor(Number(me.hope)) || 0);
  if (maxSpend < 1) return [];
  const out = [];
  for (const c of table.characters ?? []) {
    const band = me.rangeFrom(c);
    if (band == null || band === 'far' || band === 'veryFar') continue;
    const fu = c.featureUsage || {};
    for (const featureKey of Object.keys(fu)) {
      const u = fu[featureKey];
      if (!u?.used) continue;
      for (let n = 1; n <= maxSpend; n++) {
        out.push({
          id: `${c.instanceId}${ID_SEP}${featureKey}${ID_SEP}${n}`,
          name: `${c.name ?? 'Ally'} — ${featureKey} (${n} Hope, ${n}d6)`,
        });
      }
    }
  }
  return out;
}

export const Invigoration = {
  name: 'Invigoration',
  description:
    'When you or an ally within Close range has used a feature that has an exhaustion limit (such as once per rest or once per session), you can **spend any number of Hope** and roll that many **d6s**. If any roll a 6, the feature can be used again.',
  chips: [
    {
      placements: ['card'],
      name: 'Invigoration',
      description:
        'Choose a creature within Close range who has an exhausted limited-use feature, and how much Hope to spend. Roll that many d6; if any show a 6, that feature is available again.',
      isSelect: (table) => invigorationSelectOptions(table),
      isDisabled: (table) =>
        invigorationSelectOptions(table).length === 0
          ? 'No valid option (need marked HP/Stress to clear or conditions to fix).'
          : false,
      onUse(table, chip) {
        const raw = chip.get?.('selectedId');
        if (raw == null || raw === '') return;
        const parts = String(raw).split(ID_SEP);
        if (parts.length !== 3) return;
        const [targetId, featureKey, hopeStr] = parts;
        const n = Math.max(0, Math.floor(Number(hopeStr)) || 0);
        if (!targetId || !featureKey || n < 1) return;
        const target = table.characters.find((c) => c.instanceId === targetId);
        if (!target) return;
        const band = table.me.rangeFrom(target);
        if (band == null || band === 'far' || band === 'veryFar') return;
        const usage = target.featureUsage?.[featureKey];
        if (!usage?.used) return;
        if ((table.me.hope ?? 0) < n) return;
        table.me.spendHope(n);
        const faces = [];
        for (let i = 0; i < n; i++) {
          faces.push(table.rollDie('d6'));
        }
        const any6 = faces.some((v) => v === 6);
        if (any6) {
          target.refreshExhaustedFeature(featureKey);
        }
        table.me.actionLoop(
          'Invigoration',
          `Spend ${n} Hope. Rolled ${n}d6: ${faces.join(', ')}. ${
            any6
              ? `${featureKey} can be used again on ${target.name ?? 'the target'}.`
              : 'No 6 — that feature stays exhausted until it would normally refresh.'
          }`
        );
      },
    },
  ],
};
