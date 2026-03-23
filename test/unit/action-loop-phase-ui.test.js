import { describe, it, expect } from 'vitest';
import { ACTION_LOOP_PHASE_LABELS } from '../../src/client/lib/action-loop-phase-ui.js';

describe('action-loop-phase-ui', () => {
  it('exposes aligned tooltip and section header for each phase', () => {
    expect(ACTION_LOOP_PHASE_LABELS.intent.tooltip).toBe('Before a roll');
    expect(ACTION_LOOP_PHASE_LABELS.intent.sectionHeader).toBe('BEFORE ROLL');
    expect(ACTION_LOOP_PHASE_LABELS.reviewAction.tooltip).toBe('After a roll');
    expect(ACTION_LOOP_PHASE_LABELS.reviewAction.sectionHeader).toBe('AFTER ROLL');
    expect(ACTION_LOOP_PHASE_LABELS.reviewOutcome.tooltip).toBe('After thresholds');
    expect(ACTION_LOOP_PHASE_LABELS.reviewOutcome.sectionHeader).toBe('AFTER THRESHOLDS');
  });
});
