/**
 * Adversary reaction — Searing Glance (SRD)
 *
 * TODO REACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO REACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO REACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 */
export const SearingGlance = {
  name: "Searing Glance",
  type: 'reaction',
  description: "When a PC within Close range makes a Presence Roll, you can **mark a Stress** to cast a gaze toward the aftermath. On the target's failure, they must mark 2 Stress and are _Vulnerable_ until the scene ends or they succeed on a social action against the Courtesan. On the target's success, they must mark a Stress.",
};
