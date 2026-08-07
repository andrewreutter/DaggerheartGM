/**
 * Subclass feature video test suite — recording harness.
 *
 * Builds on test/helpers/multi-auth.js (ACTOR_GM/A/B, authenticateActor). Records a single
 * Playwright video from the subclass-owning player's browser context ("the camera") while a
 * GM context (and optional second player context) drive off-camera actions whose effects
 * propagate to the camera page live via the real `table_state` / `banners` SSE channels.
 *
 * A fixed-position caption overlay is injected into the camera page (survives navigation via
 * `addInitScript`) so every step of the walkthrough is narrated directly in the recorded video
 * with zero post-processing.
 *
 * See .cursor/plans/subclass_feature_video_suite_7ff124eb.plan.md for the full design.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ACTOR_GM, ACTOR_PLAYER_A, ACTOR_PLAYER_B, authenticateActor } from './multi-auth.js';

/** Temp dir Playwright records into — the finished file is moved out of here in `finish()`. */
export const SUBCLASS_VIDEO_TMP_DIR = path.resolve(process.cwd(), 'test-artifacts', 'videos-tmp');
/** Stable, most-recent-only output dir — see plan "Most-recent-only retention". */
export const SUBCLASS_VIDEO_OUT_DIR = path.resolve(process.cwd(), 'test-artifacts', 'subclass-videos');

const CAPTION_OVERLAY_ID = '__dh_subclass_caption_overlay__';

/** Runs inside the browser via `addInitScript` — installs `window.__dhSetCaption`. */
function installCaptionOverlay(overlayId) {
  function ensureOverlay() {
    let el = document.getElementById(overlayId);
    if (el) return el;
    el = document.createElement('div');
    el.id = overlayId;
    el.style.cssText = [
      'position:fixed',
      'top:12px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'pointer-events:none',
      'background:rgba(0,0,0,0.82)',
      'color:#fff',
      'font:600 20px/1.4 system-ui,-apple-system,BlinkMacSystemFont,sans-serif',
      'padding:10px 22px',
      'border-radius:10px',
      'box-shadow:0 2px 12px rgba(0,0,0,0.5)',
      'text-align:center',
      'max-width:90vw',
      'white-space:pre-wrap',
    ].join(';');
    (document.body || document.documentElement).appendChild(el);
    return el;
  }
  window.__dhSetCaption = (text) => {
    ensureOverlay().textContent = text;
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
  } else {
    ensureOverlay();
  }
}

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Start a subclass video run: opens the camera (subclass owner, Player A) context with video
 * recording, a GM context, and — when `actors` includes `'playerB'` — a second player context.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {{ className: string, subclassName: string, actors?: Array<'gm'|'playerA'|'playerB'> }} opts
 * @returns {Promise<{
 *   gmPage: import('@playwright/test').Page,
 *   playerPage: import('@playwright/test').Page,
 *   playerBPage: import('@playwright/test').Page | null,
 *   caption: (role: string, featureName: string, note?: string) => Promise<void>,
 *   finish: (opts?: { passedOrFailed?: 'passed'|'failed' }) => Promise<string|null>,
 * }>}
 */
export async function startSubclassRun(browser, { className, subclassName, actors = ['gm', 'playerA', 'playerB'] }) {
  fs.mkdirSync(SUBCLASS_VIDEO_TMP_DIR, { recursive: true });
  fs.mkdirSync(SUBCLASS_VIDEO_OUT_DIR, { recursive: true });

  const subclassLabel = `${className} · ${subclassName}`;

  const cameraContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: SUBCLASS_VIDEO_TMP_DIR, size: { width: 1280, height: 720 } },
  });
  const playerPage = await cameraContext.newPage();
  await playerPage.addInitScript(installCaptionOverlay, CAPTION_OVERLAY_ID);
  await authenticateActor(playerPage, ACTOR_PLAYER_A);

  const gmContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const gmPage = await gmContext.newPage();
  await authenticateActor(gmPage, ACTOR_GM);

  let playerBContext = null;
  let playerBPage = null;
  if (actors.includes('playerB')) {
    playerBContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    playerBPage = await playerBContext.newPage();
    await authenticateActor(playerBPage, ACTOR_PLAYER_B);
  }

  async function caption(role, featureName, note) {
    const text = `${subclassLabel}\n[${String(role).toUpperCase()}] ${featureName}${note ? ` — ${note}` : ''}`;
    await playerPage.evaluate((t) => window.__dhSetCaption?.(t), text).catch(() => {});
    // Minimum on-screen duration so captions are followable in the recorded video at 1x speed.
    await playerPage.waitForTimeout(400);
  }

  async function finish() {
    const video = playerPage.video();
    await Promise.all([
      gmContext.close().catch(() => {}),
      playerBContext ? playerBContext.close().catch(() => {}) : Promise.resolve(),
      cameraContext.close().catch(() => {}),
    ]);
    if (!video) return null;
    const tmpPath = await video.path().catch(() => null);
    if (!tmpPath || !fs.existsSync(tmpPath)) return null;
    const destPath = path.join(SUBCLASS_VIDEO_OUT_DIR, `${slugify(className)}--${slugify(subclassName)}.webm`);
    fs.copyFileSync(tmpPath, destPath);
    fs.rmSync(tmpPath, { force: true });
    return destPath;
  }

  return { gmPage, playerPage, playerBPage, caption, finish };
}
