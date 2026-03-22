import { extractDetailsValues } from '../../client/lib/dice-utils.js';

/**
 * SRD: When you are attacked, roll this weapon's damage dice. If any of the attacker's damage dice rolled the same value as your dice, the matching results are discarded from the attacker's damage dice before the damage you take is totaled.
 */
export default {
  name: 'Parry',
  description: "When attacked, roll this weapon's damage dice. Matching results are discarded from the attacker's damage.",
  async onBeforeDamageApplied({target, roll, feature, system, effectiveDmgTotal, characters}) {
    if (!target.isMe) return effectiveDmgTotal;
    
    const damageRoll = roll.damageRoll;
    if (!damageRoll) return effectiveDmgTotal;
    
    // Find the Parry weapon from the target's weapons
    const parryWeapon = (target.weapons || []).find(w => w.feature?.name === 'Parry');
    if (!parryWeapon) return effectiveDmgTotal;
    
    const attackValues = extractDetailsValues(damageRoll.details);
    const parryDice = (parryWeapon.damage || '').trim().match(/^([^\s+\-]+)/)?.[1];
    if (!parryDice || attackValues.length === 0) return effectiveDmgTotal;
    
    const parryRollData = await system.postRollSilent(`Parry [${parryDice}]`, `${target.name} Parry`);
    if (!parryRollData) return effectiveDmgTotal;
    
    const parryDamageSub = (parryRollData.subItems || []).find(s => /parry/i.test(s.pre || '') && s.input);
    const parryValues = extractDetailsValues(parryDamageSub?.details);

    const remaining = [...attackValues];
    for (const pv of parryValues) {
      const idx = remaining.indexOf(pv);
      if (idx !== -1) remaining.splice(idx, 1);
    }
    const cancelled = attackValues.length - remaining.length;

    if (cancelled === 0) return effectiveDmgTotal;

    const damageSub = roll.subItems?.find(s => /damage/i.test(s.pre || '') && s.input);
    const modifierMatch = (damageSub?.input || '').match(/([+-]\d+)$/);
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

    system?.addActionBanner?.({
      _action: true,
      rollUser: target.name,
      actionName: 'Parry!',
      actionText: `Discarded [${cancelledValues.join(', ')}] — damage reduced to ${newDmgTotal}`,
      tags: [{ name: 'Parry', text: `${cancelled} die${cancelled !== 1 ? 's' : ''} cancelled — final damage: ${newDmgTotal}` }],
    });

    return newDmgTotal;
  },
  async OLDonBeforeDamageApplied(effectiveDmgTotal, { target, roll, parryWeapon, system }) {
        if (!parryWeapon || !roll?.subItems) return effectiveDmgTotal;

        const damageSub = roll.subItems.find(s => /damage/i.test(s.pre || '') && s.input);
        if (!damageSub) return effectiveDmgTotal;

        const attackValues = extractDetailsValues(damageSub.details);
        const parryDice = (parryWeapon.damage || '').trim().match(/^([^\s+\-]+)/)?.[1];
        if (!parryDice || attackValues.length === 0) return effectiveDmgTotal;

        try {
          const parryRollData = await system?.postRollSilent?.(`Parry [${parryDice}]`, `${target.name} Parry`);
          if (!parryRollData) return effectiveDmgTotal;
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

          system?.addActionBanner?.({
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
