/**
 * EasyOCR engine adapter.
 *
 * Calls the Python easyocr_worker.py script via child_process, parses its
 * JSON output, and returns the shared engine contract:
 *   { text: string, detections: [{ bbox: { x0, y0, x1, y1 }, text, confidence }] }
 *
 * Requires python3 and the easyocr package to be installed. Use isAvailable()
 * to check at startup; returns false if either is missing and the engine is
 * silently excluded from the active pool.
 */

import { execFile, execFileSync } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'easyocr';

const SCRIPT = fileURLToPath(new URL('./easyocr_worker.py', import.meta.url));
const TIMEOUT_MS = 60_000; // EasyOCR can be slow on first call (model load)

// Optional: set EASYOCR_DEPS env var to a pip --target directory so the worker
// can find easyocr when installed in a non-standard location (e.g. /tmp/easyocr_deps).
const EASYOCR_DEPS = process.env.EASYOCR_DEPS || '';

let _available = null; // null = not yet checked

/**
 * Check once at startup whether python3 + easyocr are installed.
 * Respects EASYOCR_DEPS env var for non-standard install locations.
 * Result is cached after the first call.
 */
export function isAvailable() {
  if (_available !== null) return _available;
  const checkScript = EASYOCR_DEPS
    ? `import sys; sys.path.insert(0, '${EASYOCR_DEPS}'); import easyocr`
    : 'import easyocr';
  try {
    execFileSync('python3', ['-c', checkScript], { timeout: 10_000, stdio: 'ignore' });
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

/**
 * Run EasyOCR on an image buffer.
 * Writes the buffer to a temp file, invokes the Python worker, parses JSON output.
 *
 * @param {Buffer} buf
 * @returns {Promise<{ text: string, detections: Array<{ bbox: { x0, y0, x1, y1 }, text: string, confidence: number }> }>}
 */
export async function recognize(buf) {
  const tmp = join(tmpdir(), `ocr-easyocr-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  await writeFile(tmp, buf);

  try {
    const workerEnv = { ...process.env };
    if (EASYOCR_DEPS) workerEnv.EASYOCR_DEPS = EASYOCR_DEPS;

    const stdout = await new Promise((resolve, reject) => {
      execFile('python3', [SCRIPT, tmp], { timeout: TIMEOUT_MS, env: workerEnv }, (err, out, stderr) => {
        if (err) {
          reject(new Error(`EasyOCR worker failed: ${err.message}${stderr ? ` | stderr: ${stderr.slice(0, 200)}` : ''}`));
        } else {
          resolve(out);
        }
      });
    });

    const parsed = JSON.parse(stdout);
    if (parsed.error) {
      throw new Error(`EasyOCR worker error: ${parsed.error}`);
    }
    return {
      text: parsed.text || '',
      detections: parsed.detections || [],
    };
  } finally {
    unlink(tmp).catch(() => {});
  }
}

/**
 * No persistent resources to clean up (Python subprocess exits after each call).
 */
export async function terminate() {}
