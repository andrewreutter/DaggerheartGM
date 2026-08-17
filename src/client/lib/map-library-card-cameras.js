import { isValidMapViewVisibleNorm } from './map-view-sync.js';

/**
 * Named cameras on a library Map row (`mapViews[]`).
 * @param {object|null|undefined} item
 * @returns {object[]}
 */
export function libraryMapCameraViews(item) {
  if (!Array.isArray(item?.mapViews)) return [];
  return item.mapViews.filter(Boolean);
}

/** Library Map cards only show the camera strip when there are 2+ cameras. */
export function shouldShowLibraryMapCameraTiles(item) {
  return libraryMapCameraViews(item).length > 1;
}

/**
 * CSS for an absolutely positioned `<img>` that fills an overflow-hidden tile with
 * the camera’s `mapViewVisibleNorm` crop. `null` means show the full map (`object-cover`).
 *
 * @param {object|null|undefined} view
 * @returns {object|null}
 */
export function mapCameraTileImageStyle(view) {
  const vn = view?.mapViewVisibleNorm;
  if (!isValidMapViewVisibleNorm(vn)) return null;
  const { x, y, w, h } = vn;
  return {
    position: 'absolute',
    width: `${(1 / w) * 100}%`,
    height: `${(1 / h) * 100}%`,
    left: `${(-x / w) * 100}%`,
    top: `${(-y / h) * 100}%`,
    maxWidth: 'none',
    maxHeight: 'none',
  };
}

/**
 * @param {object|null|undefined} view
 * @param {number} index
 * @returns {string}
 */
export function libraryMapCameraTileKey(view, index) {
  if (view?.id != null && String(view.id).trim()) return String(view.id);
  return `cam-${index}`;
}
