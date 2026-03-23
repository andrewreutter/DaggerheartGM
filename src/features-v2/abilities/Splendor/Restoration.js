/**
 * Splendor domain — Restoration (Tier 2 / SRD level 6 spell)
 * SRD: After long rest, tokens = Spellcast trait; touch in Melee to spend tokens for healing, cleanse, etc.
 */

function spellcastTraitScore(table) {
  const key = table.me?.spellcastTrait;
  const traits = table.me?.traits || {};
  if (key && traits[key] != null) {
    return Math.max(0, Math.floor(Number(traits[key])) || 0);
  }
  return Math.max(0, Math.floor(Number(traits.presence)) || 0);
}

/** Creatures you can touch: any actor in Melee range (including yourself). */
function creaturesInMelee(table) {
  return table.actors.filter((a) => table.me.rangeFrom(a) === 'melee');
}

function restorationCardDisabled(table) {
  const tokens = table.feature.get('restorationTokens') ?? 0;
  const melee = creaturesInMelee(table);
  if (tokens < 1) return 'No Restoration tokens (gain tokens equal to Spellcast after a long rest).';
  if (melee.length === 0) return 'No creature in Melee range to touch.';
  return false;
}

export const Restoration = {
  name: 'Restoration',
  description:
    'After a long rest, place a number of tokens equal to your Spellcast trait on this card. Touch a creature and spend any number of tokens to clear 2 Hit Points or 2 Stress for each token spent.\n\nYou can also spend a token from this card when touching a creature to clear the _Vulnerable_ condition or heal a physical or magical ailment (the GM might require additional tokens depending on the strength of the ailment).\n\nWhen you take a long rest, clear all unspent tokens.',
  hooks: {
    onRest(table) {
      if (table.action?.type !== 'longRest') return;
      table.feature.set('restorationTokens', spellcastTraitScore(table));
    },
  },
  chips: [
    {
      placements: ['card'],
      name: 'Restoration — Clear Hit Points',
      description:
        'Spend 1 token while touching a creature in Melee range: clear 2 Hit Points on them (repeat for additional tokens).',
      selectTargets: (table) => creaturesInMelee(table),
      isDisabled: (table) => restorationCardDisabled(table),
      onUse(table, chip) {
        const ids = chip.get?.('selectedTargetIds') ?? [];
        const tid = ids[0];
        const cur = table.feature.get('restorationTokens') ?? 0;
        if (cur < 1 || !tid) return;
        const target = table.actors.find((a) => a.instanceId === tid);
        if (!target || table.me.rangeFrom(target) !== 'melee') return;
        table.feature.set('restorationTokens', cur - 1);
        target.clearHP(2);
      },
    },
    {
      placements: ['card'],
      name: 'Restoration — Clear Stress',
      description:
        'Spend 1 token while touching a creature in Melee range: clear 2 Stress on them (repeat for additional tokens).',
      selectTargets: (table) => creaturesInMelee(table),
      isDisabled: (table) => restorationCardDisabled(table),
      onUse(table, chip) {
        const ids = chip.get?.('selectedTargetIds') ?? [];
        const tid = ids[0];
        const cur = table.feature.get('restorationTokens') ?? 0;
        if (cur < 1 || !tid) return;
        const target = table.actors.find((a) => a.instanceId === tid);
        if (!target || table.me.rangeFrom(target) !== 'melee') return;
        table.feature.set('restorationTokens', cur - 1);
        target.clearStress(2);
      },
    },
    {
      placements: ['card'],
      name: 'Restoration — Cleanse',
      description:
        'Spend 1 token while touching a creature in Melee range: clear the Vulnerable condition, or work with the GM to heal a physical or magical ailment (may cost extra tokens).',
      selectTargets: (table) => creaturesInMelee(table),
      isDisabled: (table) => restorationCardDisabled(table),
      onUse(table, chip) {
        const ids = chip.get?.('selectedTargetIds') ?? [];
        const tid = ids[0];
        const cur = table.feature.get('restorationTokens') ?? 0;
        if (cur < 1 || !tid) return;
        const target = table.actors.find((a) => a.instanceId === tid);
        if (!target || table.me.rangeFrom(target) !== 'melee') return;
        table.feature.set('restorationTokens', cur - 1);
        if (target.hasCondition('Vulnerable')) {
          target.removeCondition('Vulnerable');
        }
        table.me.actionLoop(
          'Restoration',
          `Spend 1 token while touching ${target.name ?? 'a creature'}: clear Vulnerable or address an ailment with the GM.`
        );
      },
    },
  ],
};
