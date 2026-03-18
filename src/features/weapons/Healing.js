export default {
  name: 'Healing',
  description: 'During downtime, automatically clear a Hit Point.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Healing', 'During downtime, automatically clear a Hit Point.', {});
  },
};
