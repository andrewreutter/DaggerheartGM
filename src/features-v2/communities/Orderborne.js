import { when, isActing } from '../engine/when.js';

export const Dedicated = {
  name: "Dedicated",
  description:
    "Record three sayings or values your upbringing instilled in you. Once per rest, when you describe how you're embodying one of these principles through your current action, you can roll a d20 as your Hope Die.",
  chips: [
    when(isActing, {
      description: "Roll a d20 as your Hope Die.",
      placements: ['intent'],
      frequency: 'rest',
      onUse(table) {
        table.rolls?.action?.hopeDie?.setDie('d20');
      }
    })
  ]
};
