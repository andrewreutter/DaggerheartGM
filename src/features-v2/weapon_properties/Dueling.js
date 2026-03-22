import { when, isActing } from '../engine/when.js';

export const Dueling = {
  name: 'Dueling',
  description:
    'When there are no other creatures within Close range of the target, gain advantage on your attack roll against them.',
  hooks: {
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => {
        const target = table.action?.target;
        const attacker = table.action?.attacker;
        const inClose = (actor) => {
          const band = target?.rangeFrom(actor);
          return band === 'melee' || band === 'veryClose' || band === 'close';
        };
        const near = table.actors.filter((a) => inClose(a));
        if (near.length !== 2) return false;
        const ids = new Set(near.map((a) => a.instanceId));
        return ids.has(attacker?.instanceId) && ids.has(target?.instanceId);
      },
      (table) => {
        table.rolls?.action?.addAdvantageDie('Dueling');
      }
    ),
  },
};
