/**
 * Goblin ancestry builder.
 *
 * Features:
 *   Danger Sense — When an adversary attack targets you or an ally in Very Close range, once per rest mark 1 Stress to reroll the entire roll (onBanner chip).
 *   Surefooted  — Ignore disadvantage on Agility rolls (strip disadvantage from addDisadvantage sources in roll builder).
 */
import { RANGE_BANDS_FT } from '../../client/lib/map-range.js';

export default {
  name: 'Goblin',
  description: 'Goblins are small, nimble humanoids known for their quick reflexes and ability to sense danger. They thrive in chaotic environments.',

  onCharacterBuild(char) {
    char.addFeature(
      'Danger Sense',
      'When an adversary attack would target you or an ally within Very Close range, you can **mark a Stress** (once per rest) to reroll the entire attack roll.',
      {
        onBanner(banner) {
          banner.addChip({
            label: 'Mark 1 Stress to reroll the entire roll (Danger Sense)',
            stressCost: 1,
            resetsOn: 'rest',
            isVisible: (roll) => roll.hasDamage && (roll.target?.isMe || (roll.target?.rangeFromMe ?? 1e4) <= RANGE_BANDS_FT.VERY_CLOSE),
            onChipAck(roll) { roll.fullReroll(); },
          });
        },
      }
    );

    char.addFeature(
      'Surefooted',
      'You ignore disadvantage on Agility rolls.',
      {
        onRoll(ctx) {
          const roll = ctx.roll;
          if (roll?._traitKey === 'agility') roll.removeDisadvantage();
        },
      }
    );
  },
};
