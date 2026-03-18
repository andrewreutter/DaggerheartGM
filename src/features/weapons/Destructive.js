export default {
  name: 'Destructive',
  skipTag: true,
  description: '-1 to Agility; on a successful attack, all adversaries within Very Close range must mark a Stress.',
  passiveStatMods: { traits: { agility: -1 } },
};
