import { describe, it, expect } from 'vitest';
import { isDaggerheartWhitelistDisabled } from '../../src/server/daggerheart-whitelist.js';

describe('isDaggerheartWhitelistDisabled', () => {
  it('is true only when DAGGERHEART_WHITELIST_DISABLED is the string 1', () => {
    expect(isDaggerheartWhitelistDisabled({ DAGGERHEART_WHITELIST_DISABLED: '1' })).toBe(true);
    expect(isDaggerheartWhitelistDisabled({ DAGGERHEART_WHITELIST_DISABLED: 'true' })).toBe(false);
    expect(isDaggerheartWhitelistDisabled({ DAGGERHEART_WHITELIST_DISABLED: '0' })).toBe(false);
    expect(isDaggerheartWhitelistDisabled({})).toBe(false);
  });
});
