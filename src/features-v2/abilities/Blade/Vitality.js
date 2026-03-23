/**
 * Blade domain — Vitality (Tier 2 / level 5)
 * SRD: daggerheart-srd/abilities/Vitality.md
 * When you choose this card, permanently gain two of: +1 Stress, +1 HP, +2 Major/Severe thresholds; then vault the card.
 */

export const Vitality = {
  name: 'Vitality',
  description:
    'When you choose this card, permanently gain two of the following benefits:\n\n- One Stress slot\n- One Hit Point slot\n- +2 bonus to your damage thresholds\n\nThen place this card in your vault permanently.',
  passiveStatMods: {
    maxStress: (table) => ((table.feature.get('picks') ?? []).includes('stress') ? 1 : 0),
    maxHP: (table) => ((table.feature.get('picks') ?? []).includes('hp') ? 1 : 0),
    majorThreshold: (table) => ((table.feature.get('picks') ?? []).includes('thresholds') ? 2 : 0),
    severeThreshold: (table) => ((table.feature.get('picks') ?? []).includes('thresholds') ? 2 : 0),
  },
  chips: [
    {
      name: 'Choose two permanent benefits',
      placements: ['card', 'create'],
      description:
        'Select exactly two options. They apply permanently to your character. Then move this card to your vault.',
      multiSelect: true,
      maxSelections: 2,
      isSelect: () => [
        {
          id: 'stress',
          name: '+1 Stress slot',
          description: 'Permanently increase your maximum Stress by 1.',
        },
        {
          id: 'hp',
          name: '+1 Hit Point slot',
          description: 'Permanently increase your maximum Hit Points by 1.',
        },
        {
          id: 'thresholds',
          name: '+2 to damage thresholds',
          description: 'Permanently gain +2 to your Major and Severe damage thresholds.',
        },
      ],
      isDisabled: (table) => {
        const picks = table.feature.get('picks');
        if (Array.isArray(picks) && picks.length === 2) return 'You already chose two permanent benefits.';
        return false;
      },
      onUse(table, chipState) {
        const ids = chipState?.get?.('selectedIds');
        if (!Array.isArray(ids) || ids.length !== 2) return;
        const valid = new Set(['stress', 'hp', 'thresholds']);
        const chosen = [...new Set(ids.filter((id) => valid.has(id)))];
        if (chosen.length !== 2) return;
        chosen.sort();
        table.feature.set('picks', chosen);
        const lines = chosen.map((id) =>
          id === 'stress'
            ? '+1 Stress slot'
            : id === 'hp'
              ? '+1 Hit Point slot'
              : '+2 Major and Severe thresholds'
        );
        table.me.actionLoop(
          'Vitality',
          `Permanent Vitality benefits recorded: ${lines.join('; ')}. Move this card to your vault on your sheet (host).`,
          {}
        );
      },
    },
  ],
};
