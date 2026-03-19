export default {
  name: 'Brave',
  description: '-1 to Evasion; +3 to Severe damage threshold.',
  onCharacterRender(ctx) {
    ctx.addStatMod('evasion', -1);
    ctx.addStatMod('severeThreshold', 3);
  },
};
