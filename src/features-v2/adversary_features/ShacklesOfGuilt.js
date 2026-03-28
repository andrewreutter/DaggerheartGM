/**
 * Adversary passive — Shackles of Guilt (SRD)
 *
 * TODO PASSIVE [COUNTDOWN]: Countdown activation, ticks, maximum value, and trigger effects (per SRD).
 * TODO PASSIVE [RESOURCE]: PC Hope loss (per SRD trigger).
 * TODO PASSIVE [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO PASSIVE [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO PASSIVE [SPOTLIGHT]: Spotlight/Fear interactions (per SRD).
 * TODO PASSIVE [AURA]: Range-limited effect on PCs (per SRD).
 */
export const ShacklesOfGuilt = {
  name: "Shackles of Guilt",
  type: 'passive',
  description: "When the Sorcerer is in the spotlight for the first time, activate the countdown. When it triggers, all targets within Far range become _Vulnerable_ and must mark a Stress as they relive their greatest regrets. A target can break free from their regret with a successful Presence or Strength Roll. When a PC fails to break free, they lose a Hope.",
};
