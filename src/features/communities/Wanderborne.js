/**
 * Wanderborne community builder.
 *
 * Features:
 *   Nomadic Pack — Once per session, spend 1 Hope to pull out a mundane item (onCard chip).
 */
export default {
  name: 'Wanderborne',
  description: "Being part of a wanderborne community means you've lived as a nomad, forgoing a permanent home and experiencing a wide variety of cultures. Unlike many communities that are defined by their locale, wanderborne are defined by their traveling lifestyle. Because of their frequent migration, wanderborne put less value on the accumulation of material possessions in favor of acquiring information, skills, and connections. While some wanderborne are allied by a common ethos, such as a religion or a set of political or economic values, others come together after shared tragedy, such as the loss of their home or land. No matter the reason, the dangers posed by life on the road and the choice to continue down that road together mean that wanderborne are known for their unwavering loyalty.",

  onCharacterBuild(char) {
    char.addFeature(
      'Nomadic Pack',
      'Add a Nomadic Pack to your inventory. Once per session, you can **spend a Hope** to reach into this pack and pull out a mundane item that\'s useful to your situation. Work with the GM to figure out what item you take out.',
      {
        onCard(card) {
          card.addChip({
            label: 'Spend 1 Hope to pull a mundane item from your pack',
            hopeCost: 1,
            resetsOn: 'session',
            onUse: (context) => context.postAction(),
          });
        },
      }
    );
  },
};
