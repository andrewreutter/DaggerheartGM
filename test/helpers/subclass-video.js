/**
 * Subclass feature video test suite — recording harness.
 *
 * Builds on test/helpers/multi-auth.js (ACTOR_GM/A/B, authenticateActor). Records a single
 * Playwright screencast from the subclass-owning player's browser context ("the camera") while a
 * GM context (and optional second player context) drive off-camera actions whose effects
 * propagate to the camera page live via the real `table_state` / `banners` SSE channels.
 *
 * Recording uses `page.screencast` (Playwright ≥1.59) with `showActions({ cursor: 'pointer' })`
 * so clicks on the camera page get an animated mouse cursor + action title overlays in the
 * `.webm`. A fixed-position caption overlay is also injected (survives navigation via
 * `addInitScript`) so every step of the walkthrough is narrated with zero post-processing.
 *
 * 3D dice (`@3d-dice/dice-box-threejs` WebGL) are kept visible in the screencast by:
 *   - headed Chromium + GPU ANGLE flags (playwright.config.js `subclass-videos` project)
 *   - `preserveDrawingBuffer: true` patched onto WebGL contexts before DiceBox init
 *   - `ack()` / `holdForDiceTumble()` so Acknowledge waits for the tumble to play
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

/** How long to leave a dice tumble on the camera before GM Acknowledge. */
export const DICE_TUMBLE_HOLD_MS = 2500;

const CAPTION_OVERLAY_ID = '__dh_subclass_caption_overlay__';
const VIDEO_SIZE = { width: 1280, height: 720 };

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

/**
 * Force WebGL contexts to keep their drawing buffer so Playwright screencast / readbacks
 * can capture Three.js dice frames (library defaults preserveDrawingBuffer: false).
 */
function installPreserveDrawingBuffer() {
  const proto = HTMLCanvasElement.prototype;
  if (proto.__dhPreserveDrawingBufferPatched) return;
  proto.__dhPreserveDrawingBufferPatched = true;
  const orig = proto.getContext;
  proto.getContext = function getContextPatched(type, attrs) {
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
      const next = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
      return orig.call(this, type, next);
    }
    return orig.call(this, type, attrs);
  };
}

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Pause so the camera screencast captures the WebGL dice tumble.
 * @param {import('@playwright/test').Page} page
 * @param {number} [ms]
 */
export async function holdForDiceTumble(page, ms = DICE_TUMBLE_HOLD_MS) {
  await page.waitForTimeout(ms);
}

/**
 * Click Acknowledge on a banner after holding for the dice tumble.
 *
 * @param {import('@playwright/test').Locator} bannerLocator
 * @param {{ holdPage?: import('@playwright/test').Page, holdMs?: number, force?: boolean }} [opts]
 */
export async function acknowledgeBanner(bannerLocator, opts = {}) {
  const { holdPage, holdMs = DICE_TUMBLE_HOLD_MS, force = false } = opts;
  const page = holdPage || bannerLocator.page();
  if (holdMs > 0) await holdForDiceTumble(page, holdMs);
  const btn = bannerLocator.getByRole('button', { name: 'Acknowledge' }).first();
  await btn.click(force ? { force: true } : undefined);
}

/**
 * Start a subclass video run: opens the camera (subclass owner, Player A) context with video
 * recording + action overlays, a GM context, and — when `actors` includes `'playerB'` — a
 * second player context.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {{ className: string, subclassName: string, actors?: Array<'gm'|'playerA'|'playerB'> }} opts
 * @returns {Promise<{
 *   gmPage: import('@playwright/test').Page,
 *   playerPage: import('@playwright/test').Page,
 *   playerBPage: import('@playwright/test').Page | null,
 *   caption: (role: string, featureName: string, note?: string) => Promise<void>,
 *   holdForDiceTumble: (ms?: number) => Promise<void>,
 *   ack: (bannerLocator: import('@playwright/test').Locator, opts?: { holdMs?: number, force?: boolean }) => Promise<void>,
 *   finish: (opts?: { passedOrFailed?: 'passed'|'failed' }) => Promise<string|null>,
 * }>}
 */
export async function startSubclassRun(browser, { className, subclassName, actors = ['gm', 'playerA', 'playerB'] }) {
  fs.mkdirSync(SUBCLASS_VIDEO_TMP_DIR, { recursive: true });
  fs.mkdirSync(SUBCLASS_VIDEO_OUT_DIR, { recursive: true });

  const subclassLabel = `${className} · ${subclassName}`;
  const videoSlug = `${slugify(className)}--${slugify(subclassName)}`;
  const tmpPath = path.join(SUBCLASS_VIDEO_TMP_DIR, `${videoSlug}-${Date.now()}.webm`);

  const cameraContext = await browser.newContext({
    viewport: VIDEO_SIZE,
  });
  const playerPage = await cameraContext.newPage();
  await playerPage.addInitScript(installPreserveDrawingBuffer);
  await playerPage.addInitScript(installCaptionOverlay, CAPTION_OVERLAY_ID);
  await authenticateActor(playerPage, ACTOR_PLAYER_A);

  // Screencast (not context `recordVideo`) so we can enable action overlays + animated cursor.
  await playerPage.screencast.start({ path: tmpPath, size: VIDEO_SIZE });
  await playerPage.screencast.showActions({
    cursor: 'pointer',
    // Keep clear of the top-center caption overlay.
    position: 'bottom-right',
    duration: 800,
    fontSize: 16,
  });

  const gmContext = await browser.newContext({ viewport: VIDEO_SIZE });
  const gmPage = await gmContext.newPage();
  await gmPage.addInitScript(installPreserveDrawingBuffer);
  await authenticateActor(gmPage, ACTOR_GM);

  let playerBContext = null;
  let playerBPage = null;
  if (actors.includes('playerB')) {
    playerBContext = await browser.newContext({ viewport: VIDEO_SIZE });
    playerBPage = await playerBContext.newPage();
    await playerBPage.addInitScript(installPreserveDrawingBuffer);
    await authenticateActor(playerBPage, ACTOR_PLAYER_B);
  }

  async function caption(role, featureName, note) {
    const text = `${subclassLabel}\n[${String(role).toUpperCase()}] ${featureName}${note ? ` — ${note}` : ''}`;
    await playerPage.evaluate((t) => window.__dhSetCaption?.(t), text).catch(() => {});
    // Minimum on-screen duration so captions are followable in the recorded video at 1x speed.
    await playerPage.waitForTimeout(400);
  }

  /** Hold on the camera page so the screencast captures the WebGL tumble. */
  async function hold(ms = DICE_TUMBLE_HOLD_MS) {
    await holdForDiceTumble(playerPage, ms);
  }

  /**
   * Acknowledge a banner after holding on the camera page (use `holdMs: 0` for non-dice banners
   * like Start Session when you want no extra pause).
   */
  async function ack(bannerLocator, opts = {}) {
    await acknowledgeBanner(bannerLocator, { holdPage: playerPage, ...opts });
  }

  async function finish() {
    // Finalize the screencast file before tearing down contexts.
    await playerPage.screencast.stop().catch(() => {});
    await Promise.all([
      gmContext.close().catch(() => {}),
      playerBContext ? playerBContext.close().catch(() => {}) : Promise.resolve(),
      cameraContext.close().catch(() => {}),
    ]);
    if (!fs.existsSync(tmpPath)) return null;
    const destPath = path.join(SUBCLASS_VIDEO_OUT_DIR, `${videoSlug}.webm`);
    fs.copyFileSync(tmpPath, destPath);
    fs.rmSync(tmpPath, { force: true });
    return destPath;
  }

  return {
    gmPage,
    playerPage,
    playerBPage,
    caption,
    holdForDiceTumble: hold,
    ack,
    finish,
  };
}
