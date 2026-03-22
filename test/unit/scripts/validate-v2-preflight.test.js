import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('validate-v2-conventions-preflight', () => {
  it('exits 0 on the repo tree', () => {
    let out;
    expect(() => {
      out = execSync('node scripts/validate-v2-conventions-preflight.mjs', {
        cwd: root,
        encoding: 'utf8',
      });
    }).not.toThrow();
    expect(out).toMatch(/ok/);
  });
});
