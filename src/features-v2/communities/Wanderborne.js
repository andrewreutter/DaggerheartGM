export const NomadicPack = {
  name: "Nomadic Pack",
  description:
    "Add a Nomadic Pack to your inventory. Once per session, you can **spend a Hope** to reach into this pack and pull out a mundane item that's useful to your situation. Work with the GM to figure out what item you take out.",
  chips: [
    {
      description: "Add a Nomadic Pack to your inventory.",
      placements: ["create"],
      onUse(table) {
        table.me.inventory.add({ name: "Nomadic Pack", id: "nomadic-pack" });
      },
    },
    {
      description:
        "Spend 1 Hope to pull a mundane item from your Nomadic Pack (once per session). Work with the GM to decide what you take out.",
      placements: ["card"],
      hopeCost: 1,
      frequency: "session",
      onUse(table) {
        table.me.actionLoop(
          "Nomadic Pack",
          `${table.me.name} reaches into their Nomadic Pack — work with the GM to name the mundane item they pull out.`
        );
      },
    },
  ],
};
