/**
 * Grace domain — Inspirational Words (Tier 1)
 * SRD: After long rest, tokens = Presence; spend a token when speaking with an ally for clear Stress, clear HP, or gain Hope.
 */

function presenceTokenCount(table) {
  const p = table.me?.traits?.presence;
  return Math.max(0, Math.floor(Number(p)) || 0);
}

export const InspirationalWords = {
  name: 'Inspirational Words',
  description:
    'Your speech is imbued with power. After a long rest, place a number of tokens on this card equal to your Presence. When you speak with an ally, you can spend a token from this card to give them one benefit from the following options: your ally clears a Stress; your ally clears a Hit Point; your ally gains a Hope. When you take a long rest, clear all unspent tokens.',
  hooks: {
    onRest(table) {
      if (table.action?.type !== 'longRest') return;
      table.feature.set('inspirationalWordsTokens', presenceTokenCount(table));
    },
  },
  chips: [
    {
      placements: ['card'],
      name: 'Inspirational Words',
      description:
        'While speaking with an ally, spend 1 token to let them clear a Stress, clear a Hit Point, or gain a Hope (choose one).',
      isDisabled: (table) =>
        (table.feature.get('inspirationalWordsTokens') ?? 0) < 1
          ? 'No Inspirational Words tokens (gain tokens after a long rest).'
          : false,
      isSelect: () => [
        {
          id: 'clearStress',
          name: 'Clear a Stress',
          description: 'Your ally clears a Stress.',
        },
        {
          id: 'clearHp',
          name: 'Clear a Hit Point',
          description: 'Your ally clears a Hit Point.',
        },
        {
          id: 'gainHope',
          name: 'Gain a Hope',
          description: 'Your ally gains a Hope.',
        },
      ],
      onUse(table, chip) {
        const id = chip.get?.('selectedId');
        const cur = table.feature.get('inspirationalWordsTokens') ?? 0;
        if (cur < 1 || !id) return;
        table.feature.set('inspirationalWordsTokens', cur - 1);
        const label =
          id === 'clearStress'
            ? 'ally clears a Stress'
            : id === 'clearHp'
              ? 'ally clears a Hit Point'
              : 'ally gains a Hope';
        table.me.actionLoop(
          'Inspirational Words',
          `Spend 1 token while speaking with an ally: ${label} (GM applies to chosen ally).`
        );
      },
    },
  ],
};
