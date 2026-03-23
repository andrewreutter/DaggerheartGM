/**
 * Grace domain — Copycat (Tier 3 / level 9 spell)
 * SRD: daggerheart-srd/abilities/Copycat.md
 *
 * Hope cost for a mimicked card of level L uses half of L rounded up (L1→1, L8→4).
 */

/** Hope for a mimicked card of level L (SRD: half the card's level; minimum 1 Hope at L1). */
function hopeForMimicLevel(level) {
  return Math.ceil(level / 2);
}

function mimicLevelOptions() {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    id: String(n),
    label: `Level ${n} card (${hopeForMimicLevel(n)} Hope)`,
  }));
}

export const Copycat = {
  name: 'Copycat',
  description:
    "Once per long rest, this card can mimic the features of another domain card of level 8 or lower in another player's loadout. **Spend Hope equal to half the card's level** to gain access to the feature. It lasts until your next rest or they place the card in their vault.",
  chips: [
    {
      placements: ['card'],
      name: 'Copycat',
      frequency: 'longRest',
      isSelect: () => mimicLevelOptions(),
      hopeCost: (table) => table.feature.get('_copycatHopeCost') ?? 0,
      description:
        "Once per long rest: pick the level of the domain card you mimic from another PC's loadout (8 or lower). Hope equals half that level (rounded up). The mimic lasts until you take a short or long rest, or they vault the card.",
      onUse(table, chip) {
        const raw = chip.get?.('selectedId');
        const level = Number.parseInt(String(raw), 10);
        if (!Number.isFinite(level) || level < 1 || level > 8) {
          table.feature.set('_copycatHopeCost', 0);
          return;
        }
        const hope = hopeForMimicLevel(level);
        table.feature.set('_copycatHopeCost', hope);
        table.feature.set('copycatMimicLevel', level);
        table.feature.set('copycatActive', true);
        table.me.actionLoop(
          'Copycat',
          `Once per long rest — spend ${hope} Hope to mimic a level ${level} domain card from another player's loadout. You can use that card's features until your next rest or until they vault the card (coordinate with the GM and the other player).`,
          {}
        );
      },
    },
  ],
  hooks: {
    onRest(table) {
      table.feature.set('copycatActive', false);
      table.feature.set('copycatMimicLevel', null);
    },
  },
};
