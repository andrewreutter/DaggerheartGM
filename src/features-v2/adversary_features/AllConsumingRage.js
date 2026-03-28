/**
 * Adversary passive — All-Consuming Rage (SRD)
 *
 * TODO PASSIVE [COUNTDOWN]: Countdown activation, ticks, maximum value, and trigger effects (per SRD).
 * TODO PASSIVE [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO PASSIVE [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO PASSIVE [SUMMON]: Summon placement, tier, and count (per SRD).
 * TODO PASSIVE [SPOTLIGHT]: Spotlight/Fear interactions (per SRD).
 * TODO PASSIVE [AURA]: Range-limited effect on PCs (per SRD).
 * TODO PASSIVE [NARRATIVE_BANNER]: Purely narrative / reminder clause — banner or log only: When it triggers, create a torrent of incarnate rage that rends flesh from bone.
 */
export const AllConsumingRage = {
  name: "All-Consuming Rage",
  type: 'passive',
  description: "When the Realm-Breaker is in the spotlight for the first time, activate the countdown. When it triggers, create a torrent of incarnate rage that rends flesh from bone. All targets within Far range must make a Presence Reaction Roll. Targets who fail take **2d6+10** direct magic damage. Targets who succeed take half damage. For each HP marked from this damage, summon a Fallen Shock Troop within Very Close range of the target who marked that HP. If the countdown ever decreases its maximum value to 0, the Realm-Breaker marks their remaining HP and all targets within Far range must mark all remaining HP and make a death move.",
  adversaryAuraReminder: "Far — must make a Presence Reaction Roll.",
};
