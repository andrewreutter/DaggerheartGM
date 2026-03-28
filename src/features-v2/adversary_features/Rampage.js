/**
 * Adversary passive — Rampage (SRD)
 *
 * TODO PASSIVE [COUNTDOWN]: Countdown activation, ticks, maximum value, and trigger effects (per SRD).
 * TODO PASSIVE [SPOTLIGHT]: Spotlight/Fear interactions (per SRD).
 * TODO PASSIVE [AURA]: Range-limited effect on PCs (per SRD).
 */
export const Rampage = {
  name: "Rampage",
  type: 'passive',
  description: "When the Hunter is in the spotlight for the first time, activate the countdown. When it triggers, move the Hunter in a straight line to a point within Far range and make an attack against all targets in their path. Targets the Hunter succeeds against take **2d8+2** physical damage.",
};
