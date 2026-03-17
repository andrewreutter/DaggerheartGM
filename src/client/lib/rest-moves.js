/**
 * Rest downtime move definitions for Short Rest and Long Rest banners.
 * Used by RestBanner for CustomSelect options and tooltips.
 */

export const SHORT_REST_MOVES = [
  {
    id: 'tend-to-wounds',
    name: 'Tend to Wounds',
    description: 'Describe how you hastily patch yourself up, then clear a number of Hit Points equal to 1d4 + your tier. You can do this to an ally instead.',
  },
  {
    id: 'clear-stress',
    name: 'Clear Stress',
    description: 'Describe how you blow off steam or pull yourself together, then clear a number of Stress equal to 1d4 + your tier.',
  },
  {
    id: 'repair-armor',
    name: 'Repair Armor',
    description: "Describe how you quickly repair your armor, then clear a number of Armor Slots equal to 1d4 + your tier. You can do this to an ally's armor instead.",
  },
  {
    id: 'prepare',
    name: 'Prepare',
    description: 'Describe how you prepare yourself for the path ahead, then gain a Hope. If you choose to Prepare with one or more members of your party, you each gain 2 Hope.',
  },
];

export const LONG_REST_MOVES = [
  {
    id: 'tend-to-all-wounds',
    name: 'Tend to All Wounds',
    description: 'Describe how you patch yourself up, then clear all Hit Points. You can do this to an ally instead.',
  },
  {
    id: 'clear-all-stress',
    name: 'Clear All Stress',
    description: 'Describe how you blow off steam or pull yourself together, then clear all Stress.',
  },
  {
    id: 'repair-all-armor',
    name: 'Repair All Armor',
    description: "Describe how you spend time repairing your armor, then clear all Armor Slots. You can do this to an ally's armor instead.",
  },
  {
    id: 'prepare-long',
    name: 'Prepare',
    description: "Describe how you prepare for the next day's adventure, then gain a Hope. If you choose to Prepare with one or more members of your party, you each gain 2 Hope.",
  },
  {
    id: 'work-on-project',
    name: 'Work on a Project',
    description: "Establish or continue work on a project (see the following 'Working on a Project in Downtime' section).",
  },
];
