/**
 * {@link ACTION_LOOP_PHASE_LABELS} plus Lucide icons (same as guide feature cards).
 * Import this from React components — not from Node/vitest (lucide-react is CDN-only in this repo).
 */

import { Crosshair, Activity, BadgeCheck, Sparkles } from 'lucide-react';
import { ACTION_LOOP_PHASE_LABELS } from './action-loop-phase-ui.js';

/** Feature card header: contextual chips exist but `when()` predicates are not met yet. */
export const FEATURE_CARD_HIDDEN_PHASE_CHIPS_UI = Object.freeze({
  tooltip: 'Additional action chips unlock when conditions are met',
  Icon: Sparkles,
});

export const ACTION_LOOP_PHASE_UI = Object.freeze({
  intent: Object.freeze({
    ...ACTION_LOOP_PHASE_LABELS.intent,
    Icon: Crosshair,
  }),
  reviewAction: Object.freeze({
    ...ACTION_LOOP_PHASE_LABELS.reviewAction,
    Icon: Activity,
  }),
  reviewOutcome: Object.freeze({
    ...ACTION_LOOP_PHASE_LABELS.reviewOutcome,
    Icon: BadgeCheck,
  }),
});
