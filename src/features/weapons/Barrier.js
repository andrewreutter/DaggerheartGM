export default {
  name: 'Barrier',
  description: 'Bonus to Armor Score; -1 to Evasion.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Barrier', 'Bonus to Armor Score; -1 to Evasion.', {
      onCharacterRender(ctx) {
        ctx.addStatMod('armorScore', 1);
        ctx.addStatMod('evasion', -1);
      },
    });
  },
};
