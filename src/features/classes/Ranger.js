/**
 * Ranger class features — per-feature descriptors.
 *
 * SRD (class): Rangers are highly skilled hunters who, despite their martial abilities, rarely lend their skills to an
 * army. Through mastery of the body and a deep understanding of the wilderness, rangers become sly tacticians.
 *
 * SRD (Ranger's Focus): **Spend a Hope** and make an attack against a target. On a success, deal your attack's normal
 * damage and temporarily make the attack's target your _Focus_. Until this feature ends or you make a different
 * creature your _Focus_, you gain: You know precisely what direction they are in; when you deal damage to them, they
 * must mark a Stress; when you fail an attack against them, you can end your Ranger's Focus to reroll your Duality Dice.
 *
 * SRD (Hold Them Off, Hope): **Spend 3 Hope** when you succeed on an attack with a weapon to use that same roll against
 * two additional adversaries within range of the attack.
 *
 * Implementation: onFeatureActivated set focusTargetId; onHpDealt mark 1 Stress on Ranger when dealing HP to focus target.
 */

/** @type {Record<string, object>} */
const features = {
  "Ranger's Focus": {
    name: "Ranger's Focus",
    class: 'Ranger',
    onFeatureActivated({ targetEl, selfEl, updateActiveElement }) {
      if (!selfEl?.instanceId) return;
      updateActiveElement(selfEl.instanceId, { focusTargetId: targetEl?.instanceId ?? null });
    },

    onHpDealt({ character, hpDealt, target }) {
      if (hpDealt < 1) return;
      if (!character.focusTargetId) return;
      if (target?.instanceId !== character.focusTargetId) return;
      character.markStress(1);
    },
  },
};

export default features;
