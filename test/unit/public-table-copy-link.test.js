import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

function tableNameInsetSource() {
  const src = readFileSync(join(dir, '../../src/client/components/BattleMap.jsx'), 'utf8');
  const start = src.indexOf('function TableNameInset');
  const end = src.indexOf('function TokenNameChip');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe('table settings Public table Copy Link', () => {
  it('floats Copy Link to the right of the Public table checkbox', () => {
    const src = tableNameInsetSource();
    expect(src).toContain('aria-label="Public table"');
    expect(src).toContain("Copy Link");
    expect(src).toContain('ml-auto');
    expect(src).toMatch(/href=\{`\/table\/\$\{tableId\}`\}/);
    expect(src).toContain('copyPublicTableLink');
    expect(src.indexOf('aria-label="Public table"')).toBeLessThan(src.indexOf('Copy Link'));
  });

  it('reserves Copy Link width so Copied does not shrink the panel', () => {
    const src = tableNameInsetSource();
    expect(src).toContain('inline-grid');
    expect(src).toContain('invisible col-start-1 row-start-1');
    expect(src).toMatch(/aria-hidden>Copy Link<\/span>/);
    expect(src).toContain("{publicLinkCopied ? 'Copied' : 'Copy Link'}");
  });
});
