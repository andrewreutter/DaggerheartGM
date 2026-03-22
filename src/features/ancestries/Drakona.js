/**
 * Drakona ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Drakona resemble wingless dragons in humanoid form and possess a powerful elemental breath. All
 * drakona have thick scales that provide excellent natural armor against both attacks and the forces of nature. They
 * are large in size, ranging from 5 feet to 7 feet on average, with long sharp teeth. Drakona don't have wings and
 * can't fly without magical aid. Members of this ancestry pass down the element of their breath through generations.
 *
 * SRD (Scales): Your scales act as natural protection. When you would take Severe damage, you can **mark a Stress** to
 * mark 1 fewer Hit Points.
 *
 * SRD (Elemental Breath): Choose an element for your breath (such as electricity, fire, or ice). You can use this
 * breath against a target or group of targets within Very Close range, treating it as an Instinct weapon that deals
 * **d8** magic damage using your Proficiency.
 */
export default {
  Scales: {
    chips: [
      {
        placement: 'banner',
        label: 'Mark 1 Stress to mark 1 fewer HP (Severe)',
        stressCost: 1,
        isVisible: (ctx) => ctx.roll.target.isMe && ctx.roll.hpLoss >= 3,
        onChipAck: ({ roll }) => roll.reduceHPLoss(1),
      },
    ],
  },
  'Elemental Breath': {
    virtualWeapon: {
      trait: 'Instinct',
      range: 'Very Close',
      damage: 'd8',
      damageType: 'Mag',
      damageProficiency: true,
      multiTarget: true,
      multiTargetMax: 10,
      description: 'd8 magic damage using Proficiency',
    },
  },
};
