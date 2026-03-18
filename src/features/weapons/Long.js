export default {
  name: 'Long',
  description: "This weapon's attack targets all adversaries in a line within range.",
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Long', "This weapon's attack targets all adversaries in a line within range.", {});
  },
};
