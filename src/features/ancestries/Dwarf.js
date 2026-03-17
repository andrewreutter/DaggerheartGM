/**
 * Dwarf ancestry builder.
 *
 * Features:
 *   Thick Skin         — When taking Minor damage, mark 2 Stress instead of 1 HP (target chip).
 *   Increased Fortitude — Spend 3 Hope to halve incoming physical damage (target chip).
 *
 * Both are target chips: they match when the selected damage target is this character.
 * isVisible(roll) uses roll.hpLoss and roll.dmgType (enriched when a target is selected).
 */
export default {
  name: 'Dwarf',
  description: 'Dwarves are most easily recognized as short humanoids with square frames, dense musculature, and thick hair. Their average height ranges from 4 to 5 ½ feet, and they are often broad in proportion to their stature. Their skin and nails contain a high amount of keratin, making them naturally resilient. This allows dwarves to embed gemstones into their bodies and decorate themselves with tattoos or piercings. Their hair grows thickly—usually on their heads, but some dwarves have thick hair across their bodies as well. Dwarves of all genders can grow facial hair, which they often style in elaborate arrangements. Typically, dwarves live up to 250 years of age, maintaining their muscle mass well into later life.',

  onCharacterBuild(char) {
    char.addFeature(
      'Thick Skin',
      'When you take Minor damage, you can **mark 2 Stress** instead of marking a Hit Point.',
      {
        onBanner(banner) {
          banner.addChip({
            label: 'Mark 2 Stress instead of 1 HP for Minor damage',
            stressCost: 2,
            isVisible: (roll) => roll.target.isMe && roll.hpLoss === 1,
            onChipAck: (roll) => roll.reduceHPLoss(1),
          });
        },
      }
    );

    char.addFeature(
      'Increased Fortitude',
      '**Spend 3 Hope** to halve incoming physical damage.',
      {
        onBanner(banner) {
          banner.addChip({
            label: 'Spend 3 Hope to halve damage',
            hopeCost: 3,
            isVisible: (roll) => roll.target.isMe && roll.dmgType === 'phy',
            onChipAck: (roll) => roll.setDamageTotal(roll.damageTotal / 2),
          });
        },
      }
    );
  },
};
