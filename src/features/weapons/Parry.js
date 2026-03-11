import { extractDetailsValues } from '../../client/lib/dice-utils.js';

export default {
  name: 'Parry',
  skipTag: true,
  description: "When attacked, roll this weapon's damage dice. Matching results are discarded from the attacker's damage.",

  /**
   * Before damage is applied to a character with a Parry weapon, roll its
   * damage dice and cancel any matching attack dice, reducing the incoming
   * damage total.
   *
   * Context provides:
   *   target          — lightweight target object
   *   roll            — incoming roll data
   *   parryWeapon     — the Parry weapon found on the target
   *   postRoll(text, displayName) — server dice roll callback
   *   addActionBanner(notification) — show a banner in the DiceRoller
   */
  async onBeforeDamageApplied(effectiveDmgTotal, { target, roll, parryWeapon, postRoll, addActionBanner }) {
    if (!parryWeapon || !roll?.subItems) return effectiveDmgTotal;

    const damageSub = roll.subItems.find(s => /damage/i.test(s.pre || '') && s.input);
    if (!damageSub) return effectiveDmgTotal;

    const attackValues = extractDetailsValues(damageSub.details);
    const parryDice = (parryWeapon.damage || '').trim().match(/^([^\s+\-]+)/)?.[1];
    if (!parryDice || attackValues.length === 0) return effectiveDmgTotal;

    try {
      const parryRollData = await postRoll(`Parry [${parryDice}]`, `${target.name} Parry`);
      const parryDamageSub = (parryRollData.subItems || []).find(s => /parry/i.test(s.pre || '') && s.input);
      const parryValues = extractDetailsValues(parryDamageSub?.details);

      const remaining = [...attackValues];
      for (const pv of parryValues) {
        const idx = remaining.indexOf(pv);
        if (idx !== -1) remaining.splice(idx, 1);
      }
      const cancelled = attackValues.length - remaining.length;

      if (cancelled === 0) return effectiveDmgTotal;

      const modifierMatch = (damageSub.input || '').match(/([+-]\d+)$/);
      const modifier = modifierMatch ? parseInt(modifierMatch[1], 10) : 0;
      const newDieTotal = remaining.reduce((a, b) => a + b, 0);
      const newDmgTotal = Math.max(0, newDieTotal + modifier);

      const cancelledValues = [];
      const attackCopy = [...attackValues];
      const remainingCopy = [...remaining];
      for (const v of attackCopy) {
        const rIdx = remainingCopy.indexOf(v);
        if (rIdx !== -1) remainingCopy.splice(rIdx, 1);
        else cancelledValues.push(v);
      }

      addActionBanner?.({
        _action: true,
        rollUser: target.name,
        actionName: 'Parry!',
        actionText: `Discarded [${cancelledValues.join(', ')}] — damage reduced to ${newDmgTotal}`,
        tags: [{ name: 'Parry', text: `${cancelled} die${cancelled !== 1 ? 's' : ''} cancelled — final damage: ${newDmgTotal}` }],
      });

      return newDmgTotal;
    } catch (err) {
      console.error('[Parry] roll failed:', err);
      return effectiveDmgTotal;
    }
  },
};
