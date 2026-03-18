export default {
  name: 'Impenetrable',
  description: 'When you would mark your last Hit Point, you can mark a Stress instead. Once per rest.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Impenetrable', 'When you would mark your last Hit Point, you can mark a Stress instead. Once per rest.', {});
  },
};
