import { describe, it, expect } from 'vitest';
import { dataUrlToFile } from '../../src/client/lib/map-image-data-url.js';

describe('map-image-data-url dataUrlToFile', () => {
  it('converts a base64 data URL into a File with a matching extension and type', async () => {
    // 1x1 transparent PNG
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const file = await dataUrlToFile(dataUrl, 'my-map');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('my-map.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBeGreaterThan(0);
  });

  it('picks jpg/webp/gif extensions from the mime type', async () => {
    const jpeg = await dataUrlToFile('data:image/jpeg;base64,/9k=', 'a');
    expect(jpeg.name).toBe('a.jpg');
    const webp = await dataUrlToFile('data:image/webp;base64,UklGRg==', 'b');
    expect(webp.name).toBe('b.webp');
    const gif = await dataUrlToFile('data:image/gif;base64,R0lGODlh', 'c');
    expect(gif.name).toBe('c.gif');
  });

  it('defaults to a "map-image" base name and .png extension', async () => {
    const file = await dataUrlToFile('data:image/png;base64,QUJD');
    expect(file.name).toBe('map-image.png');
  });
});
