export default {
  name: 'Eruptive',
  description: 'On a successful Melee attack, other adversaries within Very Close range must succeed on a reaction roll (14) or take half damage.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Eruptive', 'On a successful Melee attack, other adversaries within Very Close range must succeed on a reaction roll (14) or take half damage.', {});
  },
};
