/**
 * Fungril ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Fungril resemble humanoid mushrooms. They display an incredible variety of bodies, faces, and limbs.
 * While the common lifespan of a fungril is about 300 years, some have been reported to live much longer. They can
 * communicate nonverbally via a mycelial array.
 *
 * SRD (Fungril Network): Make an **Instinct Roll (12)** to use your mycelial array to speak with others of your ancestry.
 * On a success, you can communicate across any distance.
 *
 * SRD (Death Connection): While touching a corpse that died recently, you can **mark a Stress** to extract one memory
 * from the corpse related to a specific emotion or sensation of your choice.
 */
export default {
  'Fungril Network': {
    chips: [
      {
        placement: 'card',
        label: 'Use mycelial array to speak with others of your ancestry',
        onUse: ({character}) => system.postTraitRoll('Instinct', { difficulty: 12 }),
      },
    ],
  },
  'Death Connection': {
    chips: [
      {
        placement: 'card',
        label: 'Mark a Stress to extract a memory from a corpse',
        stressCost: 1,
        bannerOnUse: true,
      },
    ],
  },
};
