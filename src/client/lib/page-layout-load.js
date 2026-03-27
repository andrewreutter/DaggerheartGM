/**
 * Read a local image file into `{ width, height, dataUrl, mime }` for the page-layout editor (no server/OCR).
 */
export function loadPageLayoutFromFile(file) {
  if (!file?.type?.startsWith('image/')) {
    return Promise.reject(new Error('Not an image file'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('Read failed'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          dataUrl,
          mime: file.type || 'image/png',
        });
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Crop a rectangle from a layout data URL to a PNG blob for encounter import OCR.
 *
 * @param {string} dataUrl
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {Promise<Blob>}
 */
export function cropLayoutRegionToPngBlob(dataUrl, x0, y0, x1, y1) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = Math.max(1, Math.round(x1 - x0));
      const h = Math.max(1, Math.round(y1 - y0));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No canvas context'));
        return;
      }
      try {
        ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h);
      } catch (e) {
        reject(e);
        return;
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error('toBlob failed'));
          else resolve(blob);
        },
        'image/png',
        1,
      );
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
  });
}

/**
 * Crop a rectangle to a PNG data URL (same pixels as {@link cropLayoutRegionToPngBlob}).
 */
export function cropLayoutRegionToPngDataUrl(dataUrl, x0, y0, x1, y1) {
  return cropLayoutRegionToPngBlob(dataUrl, x0, y0, x1, y1).then(
    (blob) =>
      new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(new Error('readAsDataURL failed'));
        fr.readAsDataURL(blob);
      }),
  );
}

/** Minimum width/height for a usable crop in the page-layout editor (matches modal). */
export const MIN_LAYOUT_CROP_RECT = 6;

/**
 * Normalize and clamp a crop rectangle to layout pixel bounds.
 * @param {{ x0: number, y0: number, x1: number, y1: number } | null | undefined} r
 * @param {number} W
 * @param {number} H
 * @param {number} [minRect]
 * @returns {{ x0: number, y0: number, x1: number, y1: number } | null}
 */
export function clampCropRectToLayout(r, W, H, minRect = MIN_LAYOUT_CROP_RECT) {
  if (!r || W <= 0 || H <= 0) return null;
  const x0n = Math.min(r.x0, r.x1);
  const x1n = Math.max(r.x0, r.x1);
  const y0n = Math.min(r.y0, r.y1);
  const y1n = Math.max(r.y0, r.y1);
  const x0 = Math.max(0, Math.min(W, x0n));
  const x1 = Math.max(0, Math.min(W, x1n));
  const y0 = Math.max(0, Math.min(H, y0n));
  const y1 = Math.max(0, Math.min(H, y1n));
  if (x1 - x0 < minRect || y1 - y0 < minRect) return null;
  return { x0, y0, x1, y1 };
}
