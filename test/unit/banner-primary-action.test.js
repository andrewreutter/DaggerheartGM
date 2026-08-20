import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bannerPrimaryActionLabel } from '../../src/client/lib/banner-primary-action.js';

const dir = dirname(fileURLToPath(import.meta.url));

describe('bannerPrimaryActionLabel', () => {
  it('reads Dismiss when Cancel is hidden', () => {
    expect(bannerPrimaryActionLabel({ showCancel: false })).toBe('Dismiss');
  });

  it('reads Apply when Cancel is shown', () => {
    expect(bannerPrimaryActionLabel({ showCancel: true })).toBe('Apply');
  });

  it('uses a blocked-move label when present', () => {
    expect(bannerPrimaryActionLabel({
      showCancel: true,
      blockedLabel: 'Apply Iron Will',
    })).toBe('Apply Iron Will');
  });
});

describe('DiceRoller banner primary action', () => {
  const src = readFileSync(join(dir, '../../src/client/components/DiceRoller.jsx'), 'utf8');

  it('does not render a Skip button on result banners', () => {
    expect(src).not.toMatch(/>\s*Skip\s*</);
  });

  it('labels the primary action with bannerPrimaryActionLabel', () => {
    expect(src).toMatch(/bannerPrimaryActionLabel\(\{ showCancel:/);
    expect(src).toMatch(/data-testid="banner-acknowledge"/);
    expect(src).toMatch(/BannerTargetHpStepper/);
  });
});
