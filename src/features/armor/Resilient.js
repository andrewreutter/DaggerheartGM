export default {
  name: 'Resilient',
  description: 'When you mark your last Armor Slot, roll a d6. On a 6, the slot is not marked.',
  async onLastArmorSlot({ character, postRoll, addActionBanner }) {
    const charName = character?.name ?? 'Character';
    try {
      const rollData = await postRoll('Resilient [d6]', charName);
      if ((rollData?.total ?? 0) === 6) {
        addActionBanner?.({
          _action: true,
          rollUser: charName,
          actionName: 'Resilient!',
          actionText: 'Rolled a 6 — armor slot saved!',
        });
        return { saveSlot: true };
      }
    } catch (err) {
      console.error('[Resilient] roll failed:', err);
    }
    return { saveSlot: false };
  },
};
