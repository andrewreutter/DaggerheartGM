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
    expect(src).toMatch(/<section key=\{key\}/);
    expect(src).toMatch(/LIB_SECTION_HEADER_BORDER/);
    expect(src).toMatch(/entries\.map\(\(\{ name, count, tier, kind \}\)/);
    expect(src).toMatch(/formatSceneLibraryRowTitle\(name, count\)/);
    expect(src).toMatch(/Tier \{tier\}/);
    expect(src).not.toMatch(/titles\.join\(', '/);
  });

  it('fill layout keeps the map preferred size and truncates lists below first', () => {
    const src = readFileSync(
      join(root, 'src/client/components/library/LibraryItemDisplayContent.jsx'),
      'utf8'
    );
    expect(src).toMatch(/SCENE_CARD_FILL_MAP_BOX/);
    expect(src).toMatch(/grow basis-auto/);
    expect(src).toMatch(/SCENE_CARD_FILL_BELOW/);
    expect(src).toMatch(/shrink-\[999\]/);
    expect(src).toMatch(/aspectRatio: mapAspect/);
    const mapBox = src.match(/SCENE_CARD_FILL_MAP_BOX\s*=\s*'([^']+)'/)?.[1] ?? '';
    expect(mapBox).toMatch(/grow/);
    expect(mapBox).toMatch(/basis-auto/);
    expect(mapBox).not.toMatch(/flex-1/);
    const below = src.match(/SCENE_CARD_FILL_BELOW\s*=\s*'([^']+)'/)?.[1] ?? '';
    expect(below).toMatch(/shrink-\[999\]/);
    expect(below).toMatch(/overflow-hidden/);
  });

  it('ItemCard uses unzoomed fill preview for scenes with a map image', () => {
    const src = readFileSync(join(root, 'src/client/components/ItemCard.jsx'), 'utf8');
    expect(src).toMatch(/sceneMapFillPreview/);
    expect(src).toMatch(/SceneLibraryCard item=\{item\} compact fill/);
    expect(src).toMatch(/maps\?\.\[0\]\?\.mapImageUrl/);
  });
});
