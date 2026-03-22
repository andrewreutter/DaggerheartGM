/**
 * SRD: You gain a +2 bonus to rolls you make to move silently.
 */
export default {
  name: 'Quiet',
  description: '+2 to stealth rolls.',
  passiveStatMods: { rollModifiers: [{ trait: 'stealth', bonus: 2, label: 'Quiet' }] },
};
