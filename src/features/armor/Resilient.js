/**
 * SRD: Before you mark your last Armor Slot, roll a d6. On a result of 6, reduce the severity by one threshold without marking an Armor Slot.
 */
export default {
  name: 'Resilient',
  description: 'When you mark your last Armor Slot, roll a d6. On a 6, the slot is not marked.',
  async onLastArmorSlot({ character, system }) {
    const charName = character?.name ?? 'Character';
    try {
      const rollData = await system?.postRoll?.('Resilient [d6]', charName);
      if ((rollData?.total ?? 0) === 6) {
        system?.addActionBanner?.({
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
