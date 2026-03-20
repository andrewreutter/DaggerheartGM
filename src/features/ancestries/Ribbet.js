/**
 * Ribbet ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Ribbets resemble anthropomorphic frogs with protruding eyes and webbed hands and feet. They have
 * smooth (though sometimes warty) moist skin and eyes positioned on either side of their head. Some ribbets have hind
 * legs more than twice the length of their torso, while others have short limbs. No matter their size (which ranges from
 * about 3 feet to 4 ½ feet), ribbets primarily move by hopping. All ribbets have webbed appendages, allowing them to
 * swim with ease. Ribbets live for approximately 100 years.
 *
 * SRD (Amphibious): You can breathe and move naturally underwater.
 *
 * SRD (Long Tongue): You can use your long tongue to grab onto things within Close range. **Mark a Stress** to use your
 * tongue as a Finesse Close weapon that deals **d12** physical damage using your Proficiency.
 */
export default {
  'Long Tongue': {
    virtualWeapon: {
      trait: 'Finesse',
      range: 'Close',
      damage: 'd12',
      damageProficiency: true,
      description: 'd12 physical damage using Proficiency; mark 1 Stress on use',
      stressCost: 1,
    },
  },
  Amphibious: {},
};
