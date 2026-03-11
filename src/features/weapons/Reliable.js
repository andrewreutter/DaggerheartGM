export default {
  name: 'Reliable',
  automated: true,
  tagText: '+1 to attack roll (applied)',
  description: '+1 to attack rolls',
  /** Adds +1 modifier to the action roll. */
  prependRollParts() {
    return ['Reliable [1]'];
  },
};
