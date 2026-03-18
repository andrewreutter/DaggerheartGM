export default {
  name: 'Timeslowing',
  description: 'When you mark an Armor Slot, gain a +1d4 bonus to Evasion until you take a rest.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Timeslowing', 'When you mark an Armor Slot, gain a +1d4 bonus to Evasion until you take a rest.', {
      async onAfterMarkArmor({ character, postRollSilent }) {
        const res = await postRollSilent(' [1d4]', character.name ?? 'Character');
        const value = res?.value ?? 0;
        const id = `timeslowing-${character.instanceId}`;
        character.addModifier({ id, name: 'Timeslowing', type: 'evasion', value, refreshOn: 'rest' });
      },
    });
  },
};
