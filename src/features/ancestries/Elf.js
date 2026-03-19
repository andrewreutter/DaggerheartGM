/**
 * Elf ancestry builder.
 *
 * Features:
 *   Quick Reactions  — Mark 1 Stress to gain advantage on a reaction roll (onAct chip; pre-roll banner).
 *   Celestial Trance — During rest, choose an additional downtime move (onRest adds one short + one long slot).
 */
export default {
  name: 'Elf',
  description: 'Elves are typically tall humanoids with pointed ears and acutely attuned senses. Their ears vary in size and pointed shape, and as they age, the tips begin to droop. While elves come in a wide range of body types, they are all fairly tall, with heights ranging from about 6 to 6 ½ feet. All elves have the ability to drop into a celestial trance, rather than sleep. This allows them to rest effectively in a short amount of time.\n\nSome elves possess what is known as a "mystic form," which occurs when an elf has dedicated themself to the study or protection of the natural world so deeply that their physical form changes. These characteristics can include celestial freckles, the presence of leaves, vines, or flowers in their hair, eyes that flicker like fire, and more. Sometimes these traits are inherited from parents, but if an elf changes their environment or magical focus, their appearance changes over time. Because elves live for about 350 years, these traits can shift more than once throughout their lifespan.',

  features: [
    {
      name: 'Quick Reactions',
      description: '**Mark a Stress** to gain advantage on a reaction roll.',
      onAct(ctx) {
        ctx.canvas.addChip({
          label: 'Mark a stress to gain advantage on this reaction roll',
          stressCost: 1,
          isVisible: (r) => r.isMine && r.isReaction,
          onUse: (r) => r.addAdvantageDie('Quick Reactions'),
        });
      },
    },
    {
      name: 'Celestial Trance',
      description: 'During a rest, you can drop into a trance to choose an additional downtime move.',
      onRest(rest) {
        rest.addShortMoveSlot('Celestial Trance');
        rest.addLongMoveSlot('Celestial Trance');
      },
    },
  ],
};
