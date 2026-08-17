import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('map library card camera tiles', () => {
  it('MapLibraryCard shows a centered horizontal camera strip when there are 2+ cameras', () => {
    const src = readFileSync(
      join(root, 'src/client/components/library/LibraryItemDisplayContent.jsx'),
      'utf8'
    );
    expect(src).toMatch(/export function MapLibraryCard/);
    const mapCard = src.slice(src.indexOf('export function MapLibraryCard'));
    const mapCardBody = mapCard.slice(0, mapCard.indexOf('const SCENE_LIBRARY_GROUP_ICONS'));
    expect(mapCardBody).toMatch(/LibraryMapCameraStrip/);
    expect(src).toMatch(/shouldShowLibraryMapCameraTiles/);
    expect(src).toMatch(/flex-nowrap justify-center/);
    expect(src).toMatch(/mapCameraTileImageStyle/);
    expect(src).toMatch(/min-h-\[100cqi\]/);
    expect(src).toMatch(/LIBRARY_CARD_FILL_BELOW/);
  });

  it('ItemCard fill preview uses MapLibraryCard', () => {
    const src = readFileSync(join(root, 'src/client/components/ItemCard.jsx'), 'utf8');
    expect(src).toMatch(/libraryMapFillPreview/);
    expect(src).toMatch(/MapLibraryCard item=\{item\} fill/);
  });
});
