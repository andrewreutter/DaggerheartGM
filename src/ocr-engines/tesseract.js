/**
 * Tesseract.js OCR engine adapter.
 *
 * Wraps tesseract.js (WASM) and normalizes output to the shared engine contract:
 *   { text: string, detections: [{ bbox: { x0, y0, x1, y1 }, text, confidence }] }
 *
 * Worker is created lazily on first use and reused across calls.
 */

import { createWorker } from 'tesseract.js';

export const name = 'tesseract';

let _worker = null;

async function getWorker() {
  if (!_worker) {
    _worker = await createWorker('eng');
  }
  return _worker;
}

/**
 * Returns true — tesseract.js is always available (pure WASM, no system deps).
 */
export function isAvailable() {
  return true;
}

/**
 * Run Tesseract OCR on an image buffer.
 *
 * @param {Buffer} buf
 * @returns {Promise<{ text: string, detections: Array<{ bbox: { x0, y0, x1, y1 }, text: string, confidence: number }> }>}
 */
export async function recognize(buf) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buf, {}, { blocks: true });

  const text = (data.text || '').trim();
  const blocks = data.blocks || [];

  // Flatten the blocks → paragraphs → lines hierarchy into normalized detections.
  // Each line carries a bbox ({ x0, y0, x1, y1 }) and confidence (0-100).
  const detections = blocks.flatMap(b =>
    b.paragraphs.flatMap(p =>
      p.lines.map(l => ({
        bbox: l.bbox,          // already { x0, y0, x1, y1 }
        text: l.text,
        confidence: l.confidence, // already 0-100
      }))
    )
  );

  return { text, detections };
}

/**
 * Terminate the Tesseract worker.
 * Called on server shutdown to clean up WASM resources.
 */
export async function terminate() {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
  }
}
