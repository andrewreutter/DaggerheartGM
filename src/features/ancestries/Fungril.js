/**
 * Fungril ancestry builder.
 *
 * Features:
 *   Fungril Network — Instinct Roll (12) to communicate with other Fungril across distance (narrative/display).
 *   Death Connection — Mark Stress to extract one memory from a recent corpse (narrative/display).
 */
export default {
  name: 'Fungril',
  description: 'Fungril resemble humanoid mushrooms and display incredible variety in appearance, with colors ranging from earth tones to bright reds, yellows, purples, and blues, and heights varying from 2 to 7 feet tall. They typically live about 300 years, though some live longer. Their features reflect a fungal nature and connection to networks and natural cycles.',

  onCharacterBuild(char) {
    char.addFeature(
      'Fungril Network',
      'Make an Instinct Roll (12) to use your mycelial array to speak with others of your ancestry. On a success, you can communicate across any distance.',
      {
        onCard(card) {
          card.addChip({
            label: 'Use mycelial array to speak with others of your ancestry',
            onUse: (context) => context.postTraitRoll('Instinct', { difficulty: 12 })
          });
        },
      }
    );

    char.addFeature(
      'Death Connection',
      'While touching a corpse that died recently, you can **mark a Stress** to extract one memory from the corpse related to a specific emotion or sensation of your choice.',
      {
        onCard(card) {
          card.addChip({
            label: 'Mark a Stress to extract a memory from a corpse',
            stressCost: 1,
            onUse: (context) => context.postAction()
          });
        },
      }
    );
  },
};
