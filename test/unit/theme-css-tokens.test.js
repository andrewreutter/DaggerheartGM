import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputCssPath = join(__dirname, '../../src/input.css');

describe('theme CSS tokens (input.css)', () => {
  it('does not leave Tailwind <alpha-value> placeholders in @theme dh colors (invalid in browsers)', () => {
    const src = readFileSync(inputCssPath, 'utf8');
    const themeBlock = src.match(/@theme\s*\{[\s\S]*?\n\}/);
    expect(themeBlock, 'expected @theme { ... } in input.css').toBeTruthy();
    const block = themeBlock[0];
    expect(block).not.toMatch(/<alpha-value>/);
    expect(block).toMatch(/--color-dh:\s*rgb\(var\(--dh-text\)\s*\/\s*1\)/);
  });

  it('declares --dh-* custom properties under :root', () => {
    const src = readFileSync(inputCssPath, 'utf8');
    const rootM = src.match(/:root\s*\{([^}]+)\}/);
    expect(rootM, 'expected :root { ... } with --dh-* vars in input.css').toBeTruthy();
    expect(rootM[1]).toMatch(/--dh-canvas/);
    expect(rootM[1]).toMatch(/--dh-text/);
  });

  it('does not contain a [data-theme="light"] block', () => {
    const src = readFileSync(inputCssPath, 'utf8');
    expect(src).not.toMatch(/\[data-theme="light"\]/);
  });
});
