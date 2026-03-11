export default {
  name: 'Resilient',
  description: 'When you mark your last Armor Slot, roll a d6. On a 6, the slot is not marked.',

  /**
   * On the last armor slot, roll a d6. Returns `{ saveSlot: true }` on a 6,
   * which tells handleApplyDamage to skip marking the slot.
   *
   * Context:
   *   target          — lightweight target object
   *   charName        — display name for the roll
   *   postRoll        — server dice roll callback
   *   addActionBanner — show a banner in the DiceRoller
   */
  async onLastArmorSlot({ charName, postRoll, addActionBanner }) {
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
