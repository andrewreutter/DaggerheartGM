/**
 * Halfling ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Halflings are small humanoids with large hairy feet and prominent rounded ears. On average, halflings
 * are 3 to 4 feet in height. Members of this ancestry live for around 150 years. Halflings are naturally attuned to
 * the magnetic fields of the Mortal Realm, granting them a strong internal compass.
 *
 * SRD (Luckbringer): At the start of each session, everyone in your party gains a Hope.
 *
 * SRD (Internal Compass): When you roll a 1 on your Hope Die, you can reroll it.
 */
export default {
  Luckbringer: {
    sessionStartOnce: true,
    onSessionStart({ characters }) {
      characters.forEach(char => char.gainHope(1));
    },
  },
  'Internal Compass': {
    chips: [
      {
        placement: 'banner',
        label: 'Spend 1 Hope to reroll Hope die (Internal Compass)',
        hopeCost: 1,
        isVisible: ({roll}) => roll.isMine && roll.hasDuality && roll.sub('Hope')?.hasValue(1),
        onChipAck: ({ roll }) => roll.reroll('Hope'),
      },
    ],
  },
};
