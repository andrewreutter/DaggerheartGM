export default {
  name: 'Reliable',
  description: '+1 to attack rolls',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Reliable', '+1 to attack rolls', {
      showTag: true,
      automated: true,
      tagText: '+1 to attack roll (applied)',
      prependRollParts() {
        return ['Reliable [1]'];
      },
    });
  },
};
