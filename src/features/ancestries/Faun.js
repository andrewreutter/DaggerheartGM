/**
 * Faun ancestry builder.
 *
 * Features:
 *   Caprine Leap — Narrative only; display is the final state, no automation needed.
 *   Kick         — Banner Chip Ack: on a successful Melee attack, mark 1 Stress to add +2d6 damage to current attack and knockback narration.
 */
export default {
  name: 'Faun',
  description: 'Fauns resemble humanoid goats with curving horns, square pupils, and cloven hooves. Though their appearances may vary, most fauns have a humanoid torso and a goatlike lower body covered in dense fur. Faun faces can be more caprine or more humanlike, and they have a wide variety of ear and horn shapes. Faun horns range from short with minimal curvature to much larger with a distinct curl. The average faun ranges from 4 feet to 6 ½ feet tall, but their height can change dramatically from one moment to the next based on their stance. The majority of fauns have proportionately long limbs, no matter their size or shape, and are known for their ability to deliver powerful blows with their split hooves. Fauns live for roughly 225 years, and as they age, their appearance can become increasingly goatlike.',

  features: [
    {
      name: 'Caprine Leap',
      description: 'You can leap anywhere within Close range as though you were using normal movement, allowing you to vault obstacles, jump across gaps, or scale barriers with ease.',
    },
    {
      name: 'Kick',
      description: 'When you succeed on an attack against a target within Melee range, you can **mark a Stress** to kick yourself off them, dealing an extra **2d6** damage and knocking back either yourself or the target to Very Close range.',
      onBanner(banner) {
        banner.addChip({
          label: 'Mark 1 Stress for +2d6 and knockback',
          stressCost: 1,
          isVisible: (roll) => roll.attacker && roll.attacker.isMe && roll.isSuccess && roll.attackRange === 'Melee',
          onChipAck(roll, character, ctx) {
            ctx.addDamage('2d6');
            ctx.addNarration(`${character.name} or ${roll.target.name} is knocked back to Very Close range`);
          },
        });
      },
    },
  ],
};
