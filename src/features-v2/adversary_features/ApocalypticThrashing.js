/**
 * Adversary passive — Apocalyptic Thrashing (SRD)
 *
 * TODO PASSIVE [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO PASSIVE [COUNTDOWN]: Countdown activation, ticks, maximum value, and trigger effects (per SRD).
 * TODO PASSIVE [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO PASSIVE [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO PASSIVE [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO PASSIVE [AURA]: Range-limited effect on PCs (per SRD).
 * TODO PASSIVE [ENVIRONMENT]: Environmental hazard damage and Restrained from terrain (per SRD).
 * TODO PASSIVE [NARRATIVE_BANNER]: Purely narrative / reminder clause — banner or log only: If the Ashen Tyrant is defeated while this countdown is active, trigger the countdown immediately as the destruction caused by their death throes.
 */
// TODO(adversary): Aura/range reminder removed from Guide UI; add onUse if this should automate at the table.
export const ApocalypticThrashing = {
  name: "Apocalyptic Thrashing",
  type: 'passive',
  description: "**Spend a Fear** to activate. It ticks down when a PC rolls with Fear. When it triggers, the Ashen Tyrant thrashes about, causing environmental damage (such as an earthquake, avalanche, or collapsing walls). All targets within Far range must make a Strength Reaction Roll. Targets who fail take **2d10+10** physical damage and are _Restrained_ by the rubble until they break free with a successful Strength Roll. Targets who succeed take half damage. If the Ashen Tyrant is defeated while this countdown is active, trigger the countdown immediately as the destruction caused by their death throes.",
};
