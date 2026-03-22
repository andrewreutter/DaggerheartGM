/**
 * Midnight domain — Chokehold (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

export const Chokehold = {
  name: 'Chokehold',
  description:
    'When you position yourself behind a creature who\'s about your size, you can **mark a Stress** to pull them into a chokehold, making them temporarily _Vulnerable_. When a creature attacks a target who is _Vulnerable_ in this way, they deal an extra **2d6** damage.',
  chips: [
    {
      placements: ['card'],
      name: 'Chokehold',
      stressCost: 1,
      description:
        'When behind a similar-sized creature: mark 1 Stress to apply a chokehold; target becomes Vulnerable. Attacks against that target deal +2d6 while Vulnerable from this chokehold (GM).',
      onUse(table) {
        table.me.actionLoop(
          'Chokehold',
          'When positioned behind a creature about your size, mark 1 Stress to pull them into a chokehold; they become temporarily Vulnerable. When any creature attacks that target while they are Vulnerable from this chokehold, the attack deals an extra 2d6 damage (GM resolves positioning and applies Vulnerable).'
        );
      },
    },
  ],
};
