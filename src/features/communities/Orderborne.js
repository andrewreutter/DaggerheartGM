/**
 * Orderborne community — feature hooks keyed by feature name.
 *
 * SRD (community): Being part of an orderborne community means you're from a collective that focuses on discipline or
 * faith, and you uphold a set of principles that reflect your experience there. By aligning around a common value or
 * goal, orderborne can mobilize larger populations with less effort.
 *
 * SRD (Dedicated): Record three sayings or values your upbringing instilled in you. Once per rest, when you describe
 * how you're embodying one of these principles through your current action, you can roll a **d20** as your Hope Die.
 */
export default {
  Dedicated: {
    chips: [
      {
        placement: 'preroll',
        label: 'Apply one of your three values to roll a d20 as your Hope Die',
        resetsOn: 'rest',
        onUse({roll}) {
          roll.setFromText(roll.rollText.replace(/Hope \[d12\]/, 'Hope [d20] (Dedicated)'));
        },
      },
    ],
  },
};
