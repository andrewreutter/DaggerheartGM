import { when, isTargeted } from '../engine/when.js';

function wouldMarkLastHP(table) {
  const hp = table.action?.effects?.find(
    (e) =>
      e.stat === 'currentHP' &&
      e.target?.instanceId === table.me?.instanceId &&
      e.amount > 0
  );
  return !!hp && (table.me?.currentHP ?? 0) === 1;
}

export const Impenetrable = {
  name: 'Impenetrable',
  description:
    'Once per short rest, when you would mark your last Hit Point, you can instead mark a Stress.',
  chips: [
    when(isTargeted, wouldMarkLastHP, {
      name: 'Impenetrable',
      description: 'Mark a Stress instead of your last Hit Point (once per short rest).',
      placements: ['reviewOutcome'],
      frequency: 'shortRest',
      onUse(table) {
        const hp = table.action?.effects?.find(
          (e) =>
            e.stat === 'currentHP' &&
            e.target?.instanceId === table.me?.instanceId &&
            e.amount > 0
        );
        if (!hp) return;
        hp.stat = 'currentStress';
        hp.amount = 1;
      },
    }),
  ],
};
