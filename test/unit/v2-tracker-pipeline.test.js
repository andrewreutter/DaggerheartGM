import { describe, it, expect } from 'vitest';
import {
  normalizeStateToken,
  updateFeatureRowLine,
  findNextWorkItem,
  loadTracker,
  loadToReviewText,
  trackerPathFromOpts,
  summarizeGatedCollections,
  formatTrackerStatsLine,
} from '../../scripts/lib/v2-tracker-pipeline.mjs';

describe('v2-tracker-pipeline', () => {
  it('normalizeStateToken maps tokens', () => {
    expect(normalizeStateToken('Done')).toBe('Done');
    expect(normalizeStateToken('NeedsFix')).toBe('Needs Fix');
    expect(normalizeStateToken('AwaitingHuman')).toBe('Awaiting Human');
    expect(normalizeStateToken('InProgress')).toBe('In Progress');
  });

  it('updateFeatureRowLine updates abilities and items rows', () => {
    const ab =
      '| Arcana   | Rune Ward            | abilities/Arcana/RuneWard.js           | Validated | val-x | note |';
    const ab2 = updateFeatureRowLine(ab, 'abilities/Arcana/RuneWard.js', { status: 'Done', agent: 'impl-y' });
    expect(ab2).toContain('| Done | impl-y |');

    const itRow =
      '| Mythic Dust Recipe          | items/MythicDustRecipe.js         | Unclaimed | —     | note |';
    const it2 = updateFeatureRowLine(itRow, 'items/MythicDustRecipe.js', { status: 'Validated', agent: 'val-z' });
    expect(it2).toContain('| Validated | val-z |');
  });

  it('updateFeatureRowLine appends Fix Notes when requested', () => {
    const ab =
      '| Grace | Test | abilities/Grace/Test.js | Validating | run-1 |  |  |  |';
    const out = updateFeatureRowLine(ab, 'abilities/Grace/Test.js', {
      status: 'Awaiting Human',
      agent: 'run-2',
      fixNotesAppend: '**escalation test**',
    });
    expect(out).toContain('**escalation test**');
    expect(out).toContain('Awaiting Human');
  });

  it('findNextWorkItem prefers Needs Fix over Done', () => {
    // Inline fixture — the real tracker may have no claimable rows (all Validated / Fixing / etc.),
    // which makes findNextWorkItem null; this test only checks priority ordering.
    const text = `
#### Tier 1

| Domain | Name | Source File | Status | Agent | Notes |
| --- | --- | --- | --- | --- | --- |
| Arcana | Rune Ward | abilities/Arcana/RuneWard.js | Done | val-x | |
| Grace | Share the Burden | abilities/Grace/ShareTheBurden.js | Needs Fix | — | |
`;
    const next = findNextWorkItem(text);
    expect(next).not.toBeNull();
    expect(next.kind).toBe('feature');
    expect(next.row.status).toBe('Needs Fix');
    expect(next.row.sourceFile).toBe('abilities/Grace/ShareTheBurden.js');
  });

  it('summarizeGatedCollections returns consistent totals', () => {
    const tp = trackerPathFromOpts();
    const text = loadTracker(tp);
    const s = summarizeGatedCollections(text, loadToReviewText(tp));
    expect(s.total).toBeGreaterThan(0);
    expect(s.remain).toBe(s.total - s.validated - s.reviewed);
    const line = formatTrackerStatsLine(s);
    expect(line).toContain('validated');
    expect(line).toContain('blocked');
    expect(line).toContain('remain');
  });
});
