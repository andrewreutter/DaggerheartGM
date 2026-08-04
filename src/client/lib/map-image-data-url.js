/**
 * @param {string} src — data URL or http(s) URL
 * @returns {Promise<{ width: number, height: number }>}
 */
export function loadImageNaturalSizeFromUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not read image dimensions'));
    img.src = src;
  });
}

/**
 * Convert a `data:` URL into a `File` suitable for `postMapImageFile` (multipart upload).
 * Used to get inline map/overlay images (pasted, dropped, or cropped from an import slice)
 * into Supabase Storage instead of embedding them as base64 in `table_state` (see Fix 1 of
 * the Game Table latency plan — inline blobs blow up every op's DB read/write/SSE push).
 * @param {string} dataUrl
 * @param {string} [baseName]
 * @returns {Promise<File>}
 */
export async function dataUrlToFile(dataUrl, baseName = 'map-image') {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
  const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'png';
  return new File([blob], `${baseName}.${ext}`, { type: mime });
}

/**
 * POST /api/edit-image requires a base64 data URL. Convert http(s) or blob URLs by fetching.
 * @param {string} src
 * @returns {Promise<string>}
 */
export async function imageSrcToDataUrlForApi(src) {
  if (typeof src !== 'string') throw new Error('Invalid image source for editing');
  if (src.startsWith('data:')) return src;
  if (!/^https?:\/\//i.test(src)) {
    throw new Error('Invalid image source for editing');
  }
  const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`Could not load image for editing (${res.status})`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result;
      if (typeof r === 'string') resolve(r);
      else reject(new Error('Could not read image as data URL'));
    };
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}
