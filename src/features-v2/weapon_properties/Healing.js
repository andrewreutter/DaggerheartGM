export const Healing = {
  name: "Healing",
  description: "During downtime, automatically clear a Hit Point.",
  hooks: {
    onRest(table) {
      table.me.clearHP(1);
    },
  },
};
