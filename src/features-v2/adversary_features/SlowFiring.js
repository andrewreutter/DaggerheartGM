/**
 * Adversary passive — Slow Firing (SRD)
 *
 * TODO PASSIVE [TOKEN]: Two-step spotlight token: first spotlight sets intent, second clears and acts (per SRD).
 * TODO PASSIVE [SPOTLIGHT]: Spotlight/Fear interactions (per SRD).
 * TODO PASSIVE [NARRATIVE_BANNER]: “Describe …” — post action-notification / banner prompt for GM (no dice).
 */
export const SlowFiring = {
  name: "Slow Firing",
  type: 'passive',
  description: "When you spotlight the Turret and they don't have a token on their stat block, they can't make a standard attack. Place a token on their stat block and describe what they're preparing to do. When you spotlight the Turret and they have a token on their stat block, clear the token and they can attack.",
};
