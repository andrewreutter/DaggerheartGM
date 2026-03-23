import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { collectFeatureRowsWithLines } from '../../scripts/lib/v2-tracker-pipeline.mjs';
import { buildHumanApprovalQueue } from '../../scripts/v2-human-queue-list.mjs';

describe('v2-human-queue-list logic', () => {
  it('collectFeatureRowsWithLines includes Awaiting Human rows with metadata', () => {
    const tracker = join(process.cwd(), 'docs/v2-migration-tracker.md');
    const toReview = join(process.cwd(), 'docs/v2-migration-to-review.md');
    const text = readFileSync(tracker, 'utf8');
    const tr = readFileSync(toReview, 'utf8');
    const awaiting = collectFeatureRowsWithLines(text, tr).filter((r) => r.status === 'Awaiting Human');
    for (const r of awaiting) {
      expect(r.sourceFile).toMatch(/\.js$/);
      expect(r.line).toBeGreaterThan(0);
    }
  });

  it('buildHumanApprovalQueue tags kinds and approval types', () => {
    const fixture = `
## Blocked / API Extension Requests
| Resolution | Features | SRD Requirement | Status | Agent | Notes        |
| ---------- | -------- | --------------- | ------ | ----- | ------------ |
| test-res-a | Feature X | Do the thing | Open | ag-1 | |
#### Tier 1 — Arcana
| Domain | Feature | Source File | Status | Agent | Impl Notes | Val Notes | Fix Notes |
| ------ | ------- | ----------- | ------ | ----- | ---------- | --------- | --------- |
| Arcana | Foo | abilities/Arcana/Foo.js | Awaiting Human | run-x | | | |
`;
    const q = buildHumanApprovalQueue(fixture);
    expect(q).toHaveLength(2);
    expect(q[0]).toMatchObject({
      kind: 'blocked-api',
      approvalType: 'design',
      resolution: 'test-res-a',
    });
    expect(q[1]).toMatchObject({
      kind: 'awaiting-human',
      approvalType: 'fix',
      sourceFile: 'abilities/Arcana/Foo.js',
    });
  });
});
