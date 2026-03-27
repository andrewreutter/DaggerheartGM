/**
 * HTML5 drag/drop helpers for map image upload (same file picking as the Upload button).
 */

/** True when the drag operation may carry files (browser sets `Files` in types). */
export function dataTransferHasFileDrag(dataTransfer) {
  if (!dataTransfer?.types) return false;
  return Array.from(dataTransfer.types).includes('Files');
}

/**
 * First image/* file from a drop event's DataTransfer (files list, then items).
 * @param {DataTransfer | null | undefined} dataTransfer
 * @returns {File | null}
 */
export function pickFirstImageFileFromDataTransfer(dataTransfer) {
  const files = dataTransfer?.files;
  if (files?.length) {
    const fromFiles = [...files].find((f) => f.type.startsWith('image/'));
    if (fromFiles) return fromFiles;
  }
  const items = dataTransfer?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}
