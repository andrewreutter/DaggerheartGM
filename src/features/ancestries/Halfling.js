/**
 * Halfling ancestry builder.
 *
 * Features:
 *   Luckbringer — On session start, grant 1 Hope to each party character.
 *   Internal Compass — When the Hope die shows a 1, spend to reroll the Hope die (onChipAck: roll.reroll('Hope')).
 */
export default {
  name: 'Halfling',
  description: 'Halflings are small humanoids known for their luck and keen sense of direction. They typically stand between 2 and 3 feet tall and have a strong connection to fortune and place.',

  features: [
    {
      name: 'Luckbringer',
      description: 'When you start a session, you and each of your allies gain 1 Hope.',
      onSessionStart(feature, characters) {
        characters.forEach(char => char.gainHope(1));
      },
    },
    {
      name: 'Internal Compass',
      description: 'When your Hope die shows a 1, you can **spend a Hope** to reroll your Hope die.',
      onBanner(banner) {
        banner.addChip({
          label: 'Spend 1 Hope to reroll Hope die (Internal Compass)',
          hopeCost: 1,
          isVisible: (roll) => roll.isMine && roll.hasDuality && roll.sub('Hope')?.hasValue(1),
          onChipAck: (roll) => roll.reroll('Hope'),
        });
      },
    },
  ],
};
