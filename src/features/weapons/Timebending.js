export default {
  name: 'Timebending',
  description: 'You choose the target of your attack after making your attack roll.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Timebending', 'You choose the target of your attack after making your attack roll.', {});
  },
};
