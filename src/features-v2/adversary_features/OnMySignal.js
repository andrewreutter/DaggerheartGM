/**
 * Adversary passive — On My Signal (SRD)
 *
 * TODO PASSIVE [COUNTDOWN]: Countdown activation, ticks, maximum value, and trigger effects (per SRD).
 * TODO PASSIVE [ROLL]: Advantage on stated attacks or rolls (per SRD).
 * TODO PASSIVE [SPOTLIGHT]: Spotlight/Fear interactions (per SRD).
 * TODO PASSIVE [AURA]: Range-limited effect on PCs (per SRD).
 * TODO PASSIVE [HEAD]: Head count, lose head on Major+ damage, spotlight cap (per SRD).
 */
export const OnMySignal = {
  name: "On My Signal",
  type: 'passive',
  description: "When the Head Guard is in the spotlight for the first time, activate the countdown. It ticks down when a PC makes an attack roll. When it triggers, all Archer Guards within Far range make a standard attack with advantage against the nearest target within their range. If any attacks succeed on the same target, combine their damage.",
};
