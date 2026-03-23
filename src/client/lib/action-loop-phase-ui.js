/**
 * Single source for action-loop phase copy (tooltips + banner section headers).
 * Lucide icons live in {@link ./action-loop-phase-ui-icons.js} (browser bundle — vitest has no lucide-react).
 * Keys align with engine phases: `intent`, `reviewAction`, `reviewOutcome`.
 */

export const ACTION_LOOP_PHASE_LABELS = Object.freeze({
  intent: Object.freeze({
    /** Tooltip / accessible name on feature cards */
    tooltip: 'Before a roll',
    /** Uppercase strip label (e.g. result banner) */
    sectionHeader: 'BEFORE ROLL',
  }),
  reviewAction: Object.freeze({
    tooltip: 'After a roll',
    sectionHeader: 'AFTER ROLL',
  }),
  reviewOutcome: Object.freeze({
    tooltip: 'After thresholds',
    sectionHeader: 'AFTER THRESHOLDS',
  }),
});
