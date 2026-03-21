/**
 * Fungril Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Fungril.md
 */

export const FungrilNetwork = {
  name: 'Fungril Network',
  description:
    'Make an Instinct Roll (12) to use your mycelial array to speak with others of your ancestry. On a success, you can communicate across any distance.',
  chips: [
    {
      description:
        'Make an Instinct Roll (12) to communicate with other Fungril across any distance.',
      placements: ['card'],
      onUse(table) {
        // Trigger an action loop for the Instinct roll
        table.me.actionLoop(
          'Fungril Network',
          'Using mycelial array to communicate with other Fungril. Make an Instinct Roll (DC 12).'
        );
      },
    },
  ],
};

export const DeathConnection = {
  name: 'Death Connection',
  description:
    'While touching a corpse that died recently, you can mark a Stress to extract one memory from the corpse related to a specific emotion or sensation of your choice.',
  chips: [
    {
      description:
        'Mark 1 Stress to extract one memory from a recently deceased corpse related to a specific emotion or sensation of your choice.',
      placements: ['card'],
      stressCost: 1,
      onUse(table) {
        table.me.actionLoop(
          'Death Connection',
          'Extracting a memory from a corpse related to a specific emotion or sensation.'
        );
      },
    },
  ],
};
