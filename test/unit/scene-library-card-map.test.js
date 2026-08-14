import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('scene library card map preview', () => {
  it('SceneLibraryCard uses object-contain (preserve map aspect) and supports fill layout', () => {
    const src = readFileSync(
      join(root, 'src/client/components/library/LibraryItemDisplayContent.jsx'),
      'utf8'
    );
    expect(src).toMatch(/export function SceneLibraryCard/);
    expect(src).toMatch(/object-contain/);
    expect(src).not.toMatch(/object-cover/);
    expect(src).toMatch(/fill\s*=\s*false/);
    expect(src).toMatch(/flex-1 min-h-0 flex items-center justify-center/);
  });

  it('ItemCard uses unzoomed fill preview for scenes with a map image', () => {
    const src = readFileSync(join(root, 'src/client/components/ItemCard.jsx'), 'utf8');
    expect(src).toMatch(/sceneMapFillPreview/);
    expect(src).toMatch(/SceneLibraryCard item=\{item\} compact fill/);
    expect(src).toMatch(/maps\?\.\[0\]\?\.mapImageUrl/);
  });
});
