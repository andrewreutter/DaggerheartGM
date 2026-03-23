/**
 * SRD item — Glider (roll table 27). daggerheart-srd/items/Glider.md
 */

export const Glider = {
  name: 'Glider',
  description:
    'While falling, you can mark a Stress to deploy this small parachute and glide safely to the ground.',
  stressCost: 1,
  onUse(table) {
    table.me.actionLoop(
      'Glider',
      'Deploy the parachute and glide safely to the ground. (Use while falling.)'
    );
  },
};
