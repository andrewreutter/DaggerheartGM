import { describe, it, expect } from 'vitest';

import {
  parseTrackerMarkdown,
  getActiveCollectionForImpl,
  getClaimableAbilityTier,
  priorityDomainBlocksBladeBoneInTier,
  getClaimableAbilityUnclaimed,
  buildQueueReport,
} from '../../../scripts/lib/v2-migration-queue-parse.mjs';

const MIN_ABILITIES_T1 = `
#### Tier 1 — test

| Domain   | Feature Name | Source File                           | Status    | Agent |
| -------- | ------------ | ------------------------------------- | --------- | ----- |
| Arcana | A1 | abilities/Arcana/A1.js | Unclaimed | —     |
| Blade | B1 | abilities/Blade/B1.js | Unclaimed | —     |

#### Tier 2 — test

| Domain   | Feature Name | Source File                           | Status    | Agent |
| -------- | ------------ | ------------------------------------- | --------- | ----- |
| Arcana | A2 | abilities/Arcana/A2.js | Unclaimed | —     |
`;

describe('v2-migration-queue-parse', () => {
  it('blocks Tier 2 claims while Tier 1 has In Progress', () => {
    const md = `
#### Tier 1 — test

| Domain   | Feature Name | Source File                           | Status    | Agent |
| -------- | ------------ | ------------------------------------- | --------- | ----- |
| Arcana | Hold | abilities/Arcana/Hold.js | In Progress | x     |

#### Tier 2 — test

| Domain   | Feature Name | Source File                           | Status    | Agent |
| -------- | ------------ | ------------------------------------- | --------- | ----- |
| Arcana | Next | abilities/Arcana/Next.js | Unclaimed | —     |
`;
    const p = parseTrackerMarkdown(md);
    expect(getClaimableAbilityTier(p)).toBe(1);
    const rows = getClaimableAbilityUnclaimed(p, 10);
    expect(rows.some((r) => r.sourceFile.includes('Next'))).toBe(false);
  });

  it('moves to Tier 2 when Tier 1 has no Unclaimed or In Progress', () => {
    const md = `
#### Tier 1 — test

| Domain   | Feature Name | Source File                           | Status    | Agent |
| -------- | ------------ | ------------------------------------- | --------- | ----- |
| Arcana | Done | abilities/Arcana/Done.js | Validated | v     |

#### Tier 2 — test

| Domain   | Feature Name | Source File                           | Status    | Agent |
| -------- | ------------ | ------------------------------------- | --------- | ----- |
| Arcana | T2 | abilities/Arcana/T2.js | Unclaimed | —     |
`;
    const p = parseTrackerMarkdown(md);
    expect(getClaimableAbilityTier(p)).toBe(2);
    const rows = getClaimableAbilityUnclaimed(p, 5);
    expect(rows[0]?.sourceFile).toContain('T2.js');
  });

  it('blocks Blade/Bone while a priority domain has Unclaimed in the same tier', () => {
    const md = `
#### Tier 1 — test

| Domain   | Feature Name | Source File                           | Status    | Agent |
| -------- | ------------ | ------------------------------------- | --------- | ----- |
| Grace | G | abilities/Grace/G.js | Unclaimed | —     |
| Blade | B | abilities/Blade/B.js | Unclaimed | —     |
`;
    const p = parseTrackerMarkdown(md);
    const tierRows = p.abilities[1];
    expect(priorityDomainBlocksBladeBoneInTier(tierRows)).toBe(true);
    const rows = getClaimableAbilityUnclaimed(p, 10);
    expect(rows.some((r) => r.domain === 'Blade')).toBe(false);
    expect(rows.some((r) => r.domain === 'Grace')).toBe(true);
  });

  it('allows Blade when priority domains have no Unclaimed or In Progress in tier', () => {
    const md = `
#### Tier 1 — test

| Domain   | Feature Name | Source File                           | Status    | Agent |
| -------- | ------------ | ------------------------------------- | --------- | ----- |
| Arcana | A | abilities/Arcana/A.js | Validated | v     |
| Blade | B | abilities/Blade/B.js | Unclaimed | —     |
`;
    const p = parseTrackerMarkdown(md);
    expect(priorityDomainBlocksBladeBoneInTier(p.abilities[1])).toBe(false);
    const rows = getClaimableAbilityUnclaimed(p, 5);
    expect(rows.some((r) => r.domain === 'Blade')).toBe(true);
  });

  it('gates beastforms when no abilities Unclaimed', () => {
    const md = `
#### Tier 1 — test

| Domain   | Feature Name | Source File                           | Status    | Agent |
| -------- | ------------ | ------------------------------------- | --------- | ----- |
| Arcana | A | abilities/Arcana/A.js | Validated | v     |

### Beastforms (1)

| Feature Name | Source File | Status | Agent |
| ------------ | ----------- | ------ | ----- |
| Scout | beastforms/Scout.js | Unclaimed | —     |

### Items (1)

| Feature Name | Source File | Status | Agent |
| ------------ | ----------- | ------ | ----- |
| Bed | items/Bed.js | Unclaimed | —     |
`;
    const p = parseTrackerMarkdown(md);
    expect(getActiveCollectionForImpl(p)).toBe('beastforms');
    const r = buildQueueReport(p, { limit: 5 });
    expect(r.activeCollection).toBe('beastforms');
    expect(r.nextRows[0]?.sourceFile).toContain('beastforms/');
  });

  it('gates items when abilities and beastforms have no Unclaimed', () => {
    const md = `
#### Tier 1 — test

| Domain   | Feature Name | Source File                           | Status    | Agent |
| -------- | ------------ | ------------------------------------- | --------- | ----- |
| Arcana | A | abilities/Arcana/A.js | Validated | v     |

### Beastforms (1)

| Feature Name | Source File | Status | Agent |
| ------------ | ----------- | ------ | ----- |
| Scout | beastforms/Scout.js | Validated | v     |

### Items (1)

| Feature Name | Source File | Status | Agent |
| ------------ | ----------- | ------ | ----- |
| Bed | items/Bed.js | Unclaimed | —     |
`;
    const p = parseTrackerMarkdown(md);
    expect(getActiveCollectionForImpl(p)).toBe('items');
  });

  it('parses minimal abilities tier table', () => {
    const p = parseTrackerMarkdown(MIN_ABILITIES_T1);
    expect(p.abilities[1].length).toBe(2);
    expect(getActiveCollectionForImpl(p)).toBe('abilities');
  });
});
