/**
 * Grace domain — Troublemaker (Tier 1)
 * SRD: Taunt/provoke within Far — Presence vs target. Once per rest on a success, roll Proficiency d4s; target marks Stress equal to highest die.
 */

export const Troublemaker = {
  name: 'Troublemaker',
  description:
    'When you taunt or provoke a target within Far range, make a **Presence Roll** against them. Once per rest on a success, roll a number of **d4s** equal to your Proficiency. The target must mark Stress equal to the highest result rolled.',
  chips: [
    {
      placements: ['card'],
      name: 'Troublemaker',
      frequency: 'rest',
      description:
        'Taunt or provoke a target within Far range: make a Presence roll vs them. On a success, roll one d4 per point of Proficiency; the target marks Stress equal to the highest die (GM).',
      onUse(table) {
        const prof = table.me?.proficiency ?? 1;
        table.me.actionLoop(
          'Troublemaker',
          `Taunt or provoke a target within Far range: Presence vs their Difficulty. On a success, roll ${prof}d4 and the target marks Stress equal to the highest result (once per rest; GM).`
        );
      },
    },
  ],
};
