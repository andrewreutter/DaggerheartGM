import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('V2 registry load (feature-catalog gen)', () => {
  it('party-scaled-adversaries does not import helpers (circular TDZ via character-calc)', () => {
    const src = readFileSync(join(root, 'src/client/lib/party-scaled-adversaries.js'), 'utf8');
    expect(src).toMatch(/from '\.\/generate-id\.js'/);
    expect(src).not.toMatch(/from '\.\/helpers\.js'/);
  });

  it('loads the V2 registry without ancestry TDZ', async () => {
    const { default: registry } = await import('../../src/features-v2/registry.js');
    expect(registry.ancestries['Clank.PurposefulDesign']?.name).toBeTruthy();
  });
});
