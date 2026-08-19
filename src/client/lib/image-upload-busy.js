/**
 * In-flight image-upload counter. `postImageUpload` / `postMapImageFile` /
 * `postMapImageFileForTable` increment this unless `{ silent: true }`.
 * User-facing file-read paths can wrap with `withImageUploadBusy` so the
 * full-screen spinner covers FileReader as well as the Storage POST.
 */

let inflight = 0;
const listeners = new Set();

function notify() {
  const busy = inflight > 0;
  for (const fn of listeners) fn(busy);
}

export function getImageUploadInflight() {
  return inflight;
}

export function beginImageUpload() {
  inflight += 1;
  notify();
}

export function endImageUpload() {
  inflight = Math.max(0, inflight - 1);
  notify();
}

/** Subscribe to busy changes. Listener is called immediately with the current value. */
export function subscribeImageUploadBusy(listener) {
  listeners.add(listener);
  listener(inflight > 0);
  return () => listeners.delete(listener);
}

export async function withImageUploadBusy(fn) {
  beginImageUpload();
  try {
    return await fn();
  } finally {
    endImageUpload();
  }
}

/** Test helper — resets the module singleton. */
export function resetImageUploadBusyForTests() {
  inflight = 0;
  listeners.clear();
}
