/**
 * Goblin ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Goblins are small humanoids easily recognizable by their large eyes and massive membranous ears.
 * With keen hearing and sharp eyesight, they perceive details both at great distances and in darkness. A typical goblin
 * stands between 3 feet and 4 feet tall. A goblin's lifespan is roughly 100 years.
 *
 * SRD (Surefooted): You ignore disadvantage on Agility Rolls.
 *
 * SRD (Danger Sense): Once per rest, **mark a Stress** to force an adversary to reroll an attack against you or an ally
 * within Very Close range.
 */
import { RANGE_BANDS_FT } from '../../client/lib/map-range.js';

export default {
  'Danger Sense': {
    chips: [
      {
        placement: 'banner',
        label: 'Mark 1 Stress to reroll the entire roll (Danger Sense)',
        stressCost: 1,
        resetsOn: 'rest',
        isVisible: (ctx) => ctx.roll.hasDamage && (ctx.roll.target?.isMe || (ctx.roll.target?.rangeFromMe ?? 1e4) <= RANGE_BANDS_FT.VERY_CLOSE),
        onChipAck({ roll }) { roll.fullReroll(); },
      },
    ],
  },
  Surefooted: {
    onRoll(ctx) {
      const roll = ctx.roll;
      if (roll?._traitKey === 'agility') roll.removeDisadvantage();
    },
  },
};
