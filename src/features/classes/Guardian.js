/**
 * Guardian class features — per-feature descriptors.
 *
 * SRD (class): The title of guardian represents an array of martial professions, speaking more to their moral compass
 * and unshakeable fortitude than the means by which they fight. While many guardians join groups of militants for
 * either a country or cause, they're more likely to follow those few they truly care for, majority be damned.
 * Guardians are known for fighting with remarkable ferocity even against overwhelming odds, defending their cohort
 * above all else. Woe betide those who harm the ally of a guardian, as the guardian will answer this injury in kind.
 *
 * SRD (Unstoppable): Once per long rest, you can become _Unstoppable._ You gain an Unstoppable Die. At level 1, your
 * Unstoppable Die is a **d4.** Place it on your character sheet in the space provided, starting with the 1 value
 * facing up. After you make a damage roll that deals 1 or more Hit Points to a target, increase the Unstoppable Die
 * value by one. When the die's value would exceed its maximum value or when the scene ends, remove the die and drop
 * out of _Unstoppable_. At level 5, your Unstoppable Die increases to a **d6.** While _Unstoppable_, you gain the
 * following benefits: You reduce the severity of physical damage by one threshold (Severe to Major, Major to Minor,
 * Minor to None). You add the current value of the Unstoppable Die to your damage roll. You can't be _Restrained_
 * or _Vulnerable_.
 *
 * Implementation: onHpDealt ratchet Unstoppable Die (d4→d6→d8→d10); modifyPreThresholdDamage reduce by one tier.
 */

/** @type {Record<string, object>} */
const features = {
  Unstoppable: {
    name: 'Unstoppable',
    class: 'Guardian',
    onHpDealt({ character, hpDealt, updateActiveElement }) {
      if (hpDealt < 1) return;
      const mods = character.activeModifiers ?? [];
      const modIdx = mods.findIndex(m => m.id?.startsWith('unstoppable-die'));
      if (modIdx === -1) return;

      const mod = mods[modIdx];
      const RATCHET = { d4: 'd6', d6: 'd8', d8: 'd10', d10: 'd10' };
      const next = RATCHET[mod.dice] ?? mod.dice;
      if (next === mod.dice) return;

      const updated = mods.map((m, i) => i === modIdx ? { ...m, dice: next } : m);
      updateActiveElement(character.instanceId, { activeModifiers: updated });
    },

    modifyPreThresholdDamage({ target, roll }) {
      const dmgTotal = roll.damageTotal;
      if (dmgTotal <= 0) return dmgTotal;
      const active = (target.activeModifiers ?? []).some(m => m.id?.startsWith('unstoppable-die'));
      if (!active) return dmgTotal;

      const thresholds = target.thresholds ?? {};
      const severe = thresholds.severe ?? Infinity;
      const major = thresholds.major ?? Infinity;

      if (dmgTotal >= severe) return severe - 1;
      if (dmgTotal >= major) return major - 1;
      return 0;
    },
  },
};

export default features;
