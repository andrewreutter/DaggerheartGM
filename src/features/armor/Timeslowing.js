export default {
  name: 'Timeslowing',
  description: 'When you mark an Armor Slot, gain a +1d4 bonus to Evasion until you take a rest.',
  /** On armor slot marked: roll 1d4 and add an Evasion modifier (refreshOn: rest). */
  async onArmorSlotMarked({ target, postRollSilent }) {
    if (!target?.instanceId || typeof postRollSilent !== 'function') return;
    const res = await postRollSilent(' [1d4]', target.name ?? 'Character');
    const value = res?.value ?? 0;
    const id = `timeslowing-${target.instanceId}`;
    const existing = (target.activeModifiers || []).filter(m => m.id !== id);
    target.setFlag('activeModifiers', [...existing, { id, name: 'Timeslowing', type: 'evasion', value, refreshOn: 'rest' }]);
  },
};
