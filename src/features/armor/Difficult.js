export default {
  name: 'Difficult',
  description: '-1 to all traits and Evasion.',
  onCharacterRender(ctx) {
    ctx.addStatMod('evasion', -1);
    ctx.addStatMod('agility', -1);
    ctx.addStatMod('strength', -1);
    ctx.addStatMod('finesse', -1);
    ctx.addStatMod('instinct', -1);
    ctx.addStatMod('presence', -1);
    ctx.addStatMod('knowledge', -1);
  },
};
