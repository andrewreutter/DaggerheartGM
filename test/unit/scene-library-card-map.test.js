import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('scene library card map preview', () => {
  it('SceneLibraryCard uses object-cover (stretch like Map cards) and supports fill layout', () => {
    const src = readFileSync(
      join(root, 'src/client/components/library/LibraryItemDisplayContent.jsx'),
      'utf8'
    );
    expect(src).toMatch(/export function SceneLibraryCard/);
    const sceneCard = src.slice(src.indexOf('export function SceneLibraryCard'));
    const sceneCardBody = sceneCard.slice(0, sceneCard.indexOf('export function LibraryItemDisplayContent'));
    expect(sceneCardBody).toMatch(/object-cover/);
    expect(sceneCardBody).not.toMatch(/object-contain/);
    expect(src).toMatch(/fill\s*=\s*false/);
    expect(src).toMatch(/<section key=\{key\}/);
    expect(src).toMatch(/LIB_SECTION_HEADER_BORDER/);
    expect(src).toMatch(/entries\.map\(\(\{ name, count, tier, kind \}\)/);
    expect(src).toMatch(/nextScenes: Play/);
    expect(src).toMatch(/formatSceneLibraryRowTitle\(name, count\)/);
    expect(src).toMatch(/Tier \{tier\}/);
    expect(src).not.toMatch(/titles\.join\(', '/);
  });

  it('fill layout shrinks the map to square, then truncates lists below', () => {
    const src = readFileSync(
      join(root, 'src/client/components/library/LibraryItemDisplayContent.jsx'),
      'utf8'
    );
    expect(src).toMatch(/SCENE_CARD_FILL_MAP_BOX/);
    expect(src).toMatch(/LIBRARY_CARD_FILL_MAP/);
    expect(src).toMatch(/min-h-\[100cqi\]/);
    expect(src).toMatch(/SCENE_CARD_FILL_BELOW/);
    expect(src).toMatch(/shrink-\[999\]/);
    expect(src).not.toMatch(/aspectRatio: mapAspect/);
    const mapBox = src.match(/LIBRARY_CARD_FILL_MAP\s*=\s*'([^']+)'/)?.[1] ?? '';
    expect(mapBox).toMatch(/flex-1/);
    expect(mapBox).toMatch(/min-h-\[100cqi\]/);
    const below = src.match(/LIBRARY_CARD_FILL_BELOW\s*=\s*'([^']+)'/)?.[1] ?? '';
    expect(below).toMatch(/shrink-\[999\]/);
  });

  it('ItemCard uses unzoomed fill preview for scenes with a map image', () => {
    const src = readFileSync(join(root, 'src/client/components/ItemCard.jsx'), 'utf8');
    expect(src).toMatch(/sceneMapFillPreview/);
    expect(src).toMatch(/SceneLibraryCard item=\{item\} compact fill/);
    expect(src).toMatch(/maps\?\.\[0\]\?\.mapImageUrl/);
  });
});
