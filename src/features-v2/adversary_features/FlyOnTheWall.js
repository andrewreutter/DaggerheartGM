/**
 * Adversary reaction — Fly on the Wall (SRD)
 *
 * TODO REACTION [FEAR_GAIN]: GM gains Fear — wire to Fear track (per SRD trigger).
 * TODO REACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 */
export const FlyOnTheWall = {
  name: "Fly on the Wall",
  type: 'reaction',
  description: "When a PC or group is discussing something sensitive, you can **mark a Stress** to reveal that the Spy is present in the scene, observing them. If the Spy escapes the scene to report their findings, you gain **1d4** Fear.",
};
