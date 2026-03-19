/**
 * Drakona ancestry builder.
 *
 * Features:
 *   Scales — When taking Severe damage, mark 1 Stress to mark 1 fewer HP (target chip).
 *   Elemental Breath — Virtual weapon (Instinct, Very Close, d8 magic, +Proficiency).
 */
export default {
  name: 'Drakona',
  description: 'Drakona resemble wingless dragons in humanoid form and possess a powerful elemental breath. All drakona have thick scales that provide excellent natural armor against both attacks and the forces of nature. They are large in size, ranging from 5 feet to 7 feet on average, with long sharp teeth. New teeth grow throughout a Drakona\'s approximately 350-year lifespan, so they are never in danger of permanently losing an incisor. Unlike their dragon ancestors, drakona don\'t have wings and can\'t fly without magical aid. Members of this ancestry pass down the element of their breath through generations, though in rare cases, a drakona\'s elemental power will differ from the rest of their family\'s.',

  features: [
    {
      name: 'Scales',
      description: 'Your scales act as natural protection. When you would take Severe damage, you can **mark a Stress** to mark 1 fewer Hit Points.',
      onBanner(banner) {
        banner.addChip({
          label: 'Mark 1 Stress to mark 1 fewer HP (Severe)',
          stressCost: 1,
          isVisible: (roll) => roll.target.isMe && roll.hpLoss >= 3,
          onChipAck: (roll) => roll.reduceHPLoss(1),
        });
      },
    },
    {
      name: 'Elemental Breath',
      description: 'Choose an element for your breath (such as electricity, fire, or ice). You can use this breath against a target or group of targets within Very Close range, treating it as an Instinct weapon that deals **d8** magic damage using your Proficiency.',
      onCharacterRender(ctx) {
        ctx.addVirtualWeapon({
          trait: 'Instinct',
          range: 'Very Close',
          damage: 'd8',
          damageType: 'Mag',
          damageProficiency: true,
          multiTarget: true,
          multiTargetMax: 10,
          description: 'd8 magic damage using Proficiency',
        });
      },
    },
  ],
};
