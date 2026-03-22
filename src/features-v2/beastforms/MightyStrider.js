/**
 * SRD: Mighty Strider — daggerheart-srd/beastforms/Mighty Strider.md
 */

export const Carrier = {
  name: 'Carrier',
  description: 'You can carry up to two willing allies with you when you move.',
};

export const Trample = {
  name: 'Trample',
  description:
    '**Mark a Stress** to move up to Close range in a straight line and make an attack against all targets within Melee range of the line. Targets you succeed against take **d8+1** physical damage using your Proficiency and are temporarily _Vulnerable_.',
};

export const features = [Carrier, Trample];
