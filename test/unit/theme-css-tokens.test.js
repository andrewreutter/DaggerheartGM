import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputCssPath = join(__dirname, '../../src/input.css');

function extractDhVarNames(block) {
  const names = new Set();
  const re = /--(dh-[a-z0-9-]+)\s*:/g;
  let m;
  while ((m = re.exec(block)) !== null) names.add(m[1]);
  return names;
}

describe('theme CSS tokens (input.css)', () => {
  it('does not leave Tailwind <alpha-value> placeholders in @theme dh colors (invalid in browsers)', () => {
    const src = readFileSync(inputCssPath, 'utf8');
    const themeBlock = src.match(/@theme\s*\{[\s\S]*?\n\}/);
    expect(themeBlock, 'expected @theme { ... } in input.css').toBeTruthy();
    const block = themeBlock[0];
    expect(block).not.toMatch(/<alpha-value>/);
    expect(block).toMatch(/--color-dh:\s*rgb\(var\(--dh-text\)\s*\/\s*1\)/);
  });

  it('declares the same --dh-* custom properties in dark and light theme blocks (parity)', () => {
    const src = readFileSync(inputCssPath, 'utf8');
    const darkM = src.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/);
    const lightM = src.match(/\[data-theme="light"\]\s*\{([^}]+)\}/);
    expect(darkM, 'expected [data-theme="dark"] { ... }').toBeTruthy();
    expect(lightM, 'expected [data-theme="light"] { ... }').toBeTruthy();
    const darkNames = extractDhVarNames(darkM[1]);
    const lightNames = extractDhVarNames(lightM[1]);
    const onlyDark = [...darkNames].filter((n) => !lightNames.has(n));
    const onlyLight = [...lightNames].filter((n) => !darkNames.has(n));
    expect(onlyDark, `only in dark: ${onlyDark.join(', ')}`).toEqual([]);
    expect(onlyLight, `only in light: ${onlyLight.join(', ')}`).toEqual([]);
  });

  it('does not use :root for theme chrome (dark palette is under data-theme only)', () => {
    const src = readFileSync(inputCssPath, 'utf8');
    expect(src).not.toMatch(/:root\s*,\s*\n\[data-theme="dark"\]/);
  });
});
