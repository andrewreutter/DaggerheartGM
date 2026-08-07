/**
 * Subclass feature video test suite — multi-camera recording harness.
 *
 * Builds on test/helpers/multi-auth.js (ACTOR_GM/A/B, authenticateActor). Records a
 * Playwright `page.screencast` on the **active stitch camera only** (switches on
 * `cutTo` / mapped `caption`), appends ordered segment files + an edit-decision list,
 * and stitches a director `.webm` via ffmpeg in `finish()` (see `subclass-video-stitch.js`).
 *
 * Active-only recording is intentional under `npm run test:subclasses` (3 workers × headed
 * WebGL): simultaneous CDP screencasts on every actor page wedged Chromium and made
 * `screencast.stop()` hang for many minutes past the test timeout.
 *
 * Cut triggers:
 *   - `caption(role, …)` auto-cuts when `role` maps to an actor (`GM` / `PLAYER A` / `PLAYER B`)
 *   - `cutTo('gm'|'playerA'|'playerB')` for explicit overrides
 *   - Non-actor roles (e.g. `'Bard / Troubadour'`) update caption text only
 *
 * Dice convention: only the **active stitch camera** has 3D dice visible (Show); others
 * Keep Hide so Acknowledge is not gated on off-camera tumbles. Hold the tumble on the
 * roller **before** cutting to GM for Acknowledge — see `holdForDiceTumble` +
 * `ack(..., { holdMs: 0 })` or `ackAfterHold`.
 *
 * Requires system `ffmpeg` / `ffprobe` on PATH. See test/subclass-video-test-plan.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { ACTOR_GM, ACTOR_PLAYER_A, ACTOR_PLAYER_B, authenticateActor } from './multi-auth.js';
import { roleToCamera, stitchOrderedSegmentFiles } from './subclass-video-stitch.js';

/** Temp dir Playwright records into — per-segment webms + cuts JSON; cleaned in `finish()`. */
export const SUBCLASS_VIDEO_TMP_DIR = path.resolve(process.cwd(), 'test-artifacts', 'videos-tmp');
/** Stable, most-recent-only output dir — see plan "Most-recent-only retention". */
export const SUBCLASS_VIDEO_OUT_DIR = path.resolve(process.cwd(), 'test-artifacts', 'subclass-videos');

const SUBCLASS_PARALLEL = process.env.SUBCLASS_PARALLEL === '1';

/** How long to leave a dice tumble on the active camera before cutting away / Acknowledge. */
export const DICE_TUMBLE_HOLD_MS = SUBCLASS_PARALLEL ? 1500 : 2500;

/** Minimum caption on-screen time (shorter under parallel headed load). */
const CAPTION_HOLD_MS = SUBCLASS_PARALLEL ? 250 : 400;

/** Bound CDP screencast stop / context close so `finally` cannot wedge the worker. */
const SCREENCAST_STOP_TIMEOUT_MS = 8000;
const CONTEXT_CLOSE_TIMEOUT_MS = 8000;
const STITCH_TIMEOUT_MS = 120000;

const CAPTION_OVERLAY_ID = '__dh_subclass_caption_overlay__';
const VIDEO_SIZE = { width: 1280, height: 720 };

/**
 * Race a promise against a timer. Prefer this over unbounded CDP/ffmpeg awaits.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
export async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

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
 * Pause so the active-camera screencast captures the WebGL dice tumble.
 * @param {import('@playwright/test').Page} page
 * @param {number} [ms]
 */
export async function holdForDiceTumble(page, ms = DICE_TUMBLE_HOLD_MS) {
  await page.waitForTimeout(ms);
}

/**
 * Benign browser console noise for subclass video specs (favicons, WebGL dice init,
 * player 403/404 resource probes, known transient engine string errors).
 * Prefer this over per-spec copies so 403 vs 404 allowlists stay consistent.
 */
const BENIGN_SUBCLASS_CONSOLE_RE =
  /favicon|manifest|WebGL|\[DiceRoller\] init failed|Failed to load resource.*(403|404)|source\.set|reading 'set'|billing.*session-start/i;

/** @param {string} text */
export function isBenignSubclassConsoleError(text) {
  return BENIGN_SUBCLASS_CONSOLE_RE.test(String(text ?? ''));
}

/**
 * @param {string[]} consoleErrors
 * @returns {string[]}
 */
export function filterSeriousSubclassConsoleErrors(consoleErrors) {
  return (consoleErrors || []).filter((e) => !isBenignSubclassConsoleError(e));
}

/**
 * Character sheet Actions emphasis card (V2 card-chip strip).
 * Must use the gradient `CharacterSheetEmphasisCard` shell — a bare `div.rounded-xl`
 * also matches the outer hover sheet, which contains Features expand headers and
 * causes strict-mode / wrong-button clicks for chips named like their feature
 * (e.g. Wordsmith Rousing Speech).
 * @param {import('@playwright/test').Page} page
 */
export function sheetActionsLocator(page) {
  return page
    .locator('div.rounded-xl.bg-gradient-to-b')
    .filter({ has: page.locator('span.uppercase', { hasText: /^Actions$/ }) })
    .first();
}

/**
 * Click-to-pin sidebar cards *toggle* closed when already open. Owned card chips
 * (Make a Scene, songs, etc.) often leave the sheet open — a blind re-click closes
 * it and the next chip lookup times out. Only click when `marker` is not visible.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} card — sidebar `div.group/char` card
 * @param {import('@playwright/test').Locator} [marker] — defaults to Actions strip
 * @returns {Promise<import('@playwright/test').Locator>} the visible marker
 */
export async function ensureSheetOpen(page, card, marker) {
  const m = marker || sheetActionsLocator(page);
  const markerReady = async (timeout) => {
    if (!(await m.isVisible({ timeout }).catch(() => false))) return false;
    // Caption overlay often repeats feature names from the script — never treat it as "sheet open".
    const inCaption = await m
      .evaluate((el, overlayId) => {
        const overlay = document.getElementById(overlayId);
        return !!(overlay && (el === overlay || overlay.contains(el)));
      }, CAPTION_OVERLAY_ID)
      .catch(() => false);
    return !inCaption;
  };
  if (await markerReady(400)) return m;
  await card.click({ timeout: 8000 });
  if (!(await markerReady(2000))) {
    await card.click({ timeout: 8000 });
  }
  await expect(m).toBeVisible({ timeout: 8000 });
  return m;
}

/**
 * Banner damage target chip opens a z-[201] "Choose target" portal (with a z-[200]
 * full-screen backdrop). Re-clicking an already-selected target opens that portal and
 * blocks review chips (Ruthless Predator, Hold Them Off extras). Select from the menu
 * when needed; no-op when the chip already shows `targetNameRe`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} banner
 * @param {RegExp} targetNameRe
 */
export async function selectBannerDamageTarget(page, banner, targetNameRe) {
  const chip = banner.getByRole('button', { name: targetNameRe }).first();
  const selectChip = banner.getByRole('button', { name: /Select target/i }).first();
  const menu = page.locator('div.fixed.z-\\[201\\]', { hasText: 'Choose target' });

  if (await menu.isVisible({ timeout: 300 }).catch(() => false)) {
    await menu.getByRole('button', { name: targetNameRe }).first().click();
    return;
  }

  const label = ((await chip.textContent().catch(() => '')) || '').trim();
  if (targetNameRe.test(label)) {
    // Already selected — do not re-click (opens portal + blocks review chips).
    return;
  }

  const opener = (await selectChip.isVisible({ timeout: 500 }).catch(() => false)) ? selectChip : chip;
  if (!(await opener.isVisible({ timeout: 3000 }).catch(() => false))) return;
  await opener.click();
  if (await menu.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menu.getByRole('button', { name: targetNameRe }).first().click();
  }
}

/** Dismiss a stray banner choose-target portal (z-[200] backdrop + z-[201] menu). */
export async function dismissBannerTargetMenu(page) {
  const menu = page.locator('div.fixed.z-\\[201\\]', { hasText: 'Choose target' });
  if (!(await menu.isVisible({ timeout: 300 }).catch(() => false))) return;
  const cancel = menu.getByRole('button', { name: /^Cancel$/i });
  if (await cancel.isVisible({ timeout: 300 }).catch(() => false)) {
    await cancel.click();
  } else {
    await page.locator('div.fixed.inset-0.z-\\[200\\]').first().click({ force: true }).catch(() => {});
  }
  await expect(menu).not.toBeVisible({ timeout: 3000 }).catch(() => {});
}

/**
 * Click Acknowledge on a banner after holding for the dice tumble.
 *
 * @param {import('@playwright/test').Locator} bannerLocator
 * @param {{ holdPage?: import('@playwright/test').Page, holdMs?: number, force?: boolean }} [opts]
 */
export async function acknowledgeBanner(bannerLocator, opts = {}) {
  const { holdPage, holdMs = DICE_TUMBLE_HOLD_MS, force = true } = opts;
  const page = holdPage || bannerLocator.page();
  if (holdMs > 0) await holdForDiceTumble(page, holdMs);
  const btn = bannerLocator.getByRole('button', { name: 'Acknowledge' }).first();
  await expect(btn).toBeVisible({ timeout: 15000 });

  // While 3D dice are animating, ResultBanner wraps internals in pointer-events:none and
  // puts resolve-instantly on the outer shell. A force-click on Acknowledge then hits the
  // shell (resolve only) — Prayer Dice / long polyhedral rolls stay pending under parallel
  // headed load. Resolve first when needed, then Ack for real.
  const needsResolve = await bannerLocator
    .evaluate((el) => {
      const inner = el.querySelector(':scope > div');
      return !!(inner && getComputedStyle(inner).pointerEvents === 'none');
    })
    .catch(() => false);
  if (needsResolve) {
    await bannerLocator.click({ force: true, position: { x: 12, y: 12 }, timeout: 5000 });
    await page.waitForTimeout(150);
  }

  await btn.click({ force, timeout: 15000 });

  // One retry if the first Ack was swallowed (resolve race / overlay).
  if (await bannerLocator.isVisible({ timeout: 1200 }).catch(() => false)) {
    const stillNeedsResolve = await bannerLocator
      .evaluate((el) => {
        const inner = el.querySelector(':scope > div');
        return !!(inner && getComputedStyle(inner).pointerEvents === 'none');
      })
      .catch(() => false);
    if (stillNeedsResolve) {
      await bannerLocator.click({ force: true, position: { x: 12, y: 12 }, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(150);
    }
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click({ force: true, timeout: 15000 });
    }
  }
}

/**
 * Soft-toggle dice canvas visibility. No-ops when the control is missing (page not on table yet).
 * Clicks use a short timeout + force: pending banners / sheets often intercept the tray
 * control, and an unbounded Playwright click would burn the whole test timeout.
 * @param {import('@playwright/test').Page} page
 * @param {'show'|'hide'} want
 */
async function setDiceVisibility(page, want) {
  if (!page || page.isClosed()) return;
  try {
    const hideBtn = page.getByLabel('Hide dice');
    const showBtn = page.getByLabel('Show dice');
    if (want === 'hide') {
      if (await hideBtn.isVisible({ timeout: 400 }).catch(() => false)) {
        await hideBtn.click({ force: true, timeout: 1200 });
      }
    } else if (await showBtn.isVisible({ timeout: 400 }).catch(() => false)) {
      await showBtn.click({ force: true, timeout: 1200 });
    }
  } catch {
    // Table chrome not ready / intercepted — cutTo will retry on later cuts.
  }
}

/**
 * Start a subclass video run: opens GM + Player A (+ optional Player B), records the
 * active stitch camera only, and returns cut/caption/ack helpers.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {{ className: string, subclassName: string, actors?: Array<'gm'|'playerA'|'playerB'> }} opts
 * @returns {Promise<{
 *   gmPage: import('@playwright/test').Page,
 *   playerPage: import('@playwright/test').Page,
 *   playerBPage: import('@playwright/test').Page | null,
 *   cutTo: (camera: 'gm'|'playerA'|'playerB') => Promise<void>,
 *   caption: (role: string, featureName: string, note?: string, opts?: { cut?: boolean }) => Promise<void>,
 *   holdForDiceTumble: (ms?: number) => Promise<void>,
 *   ensureSheetOpen: (page: import('@playwright/test').Page, card: import('@playwright/test').Locator, marker?: import('@playwright/test').Locator) => Promise<import('@playwright/test').Locator>,
 *   selectBannerDamageTarget: (page: import('@playwright/test').Page, banner: import('@playwright/test').Locator, targetNameRe: RegExp) => Promise<void>,
 *   dismissBannerTargetMenu: (page: import('@playwright/test').Page) => Promise<void>,
 *   ack: (bannerLocator: import('@playwright/test').Locator, opts?: { holdMs?: number, force?: boolean }) => Promise<void>,
 *   ackAfterHold: (bannerLocator: import('@playwright/test').Locator, opts?: { holdMs?: number, force?: boolean }) => Promise<void>,
 *   finish: (opts?: { passedOrFailed?: 'passed'|'failed' }) => Promise<string|null>,
 * }>}
 */
export async function startSubclassRun(browser, { className, subclassName, actors = ['gm', 'playerA', 'playerB'] }) {
  fs.mkdirSync(SUBCLASS_VIDEO_TMP_DIR, { recursive: true });
  fs.mkdirSync(SUBCLASS_VIDEO_OUT_DIR, { recursive: true });

  const subclassLabel = `${className} · ${subclassName}`;
  const videoSlug = `${slugify(className)}--${slugify(subclassName)}`;
  const runTs = Date.now();

  /** @type {Array<{ tMs: number, camera: string }>} */
  const cuts = [];
  /** @type {Array<{ camera: string, path: string, tMs: number }>} */
  const segments = [];
  /** @type {'gm'|'playerA'|'playerB'} */
  let activeCamera = 'playerA';
  let t0 = Date.now();
  /** @type {{ camera: 'gm'|'playerA'|'playerB', path: string, startedAt: number } | null} */
  let activeRecording = null;
  let segmentIndex = 0;
  /** All temp files created (segments + abandoned) for cleanup. */
  const tmpFiles = new Set();

  async function preparePage(contextActor) {
    const context = await browser.newContext({ viewport: VIDEO_SIZE });
    const page = await context.newPage();
    await page.addInitScript(installPreserveDrawingBuffer);
    await page.addInitScript(installCaptionOverlay, CAPTION_OVERLAY_ID);
    await authenticateActor(page, contextActor);
    return { context, page };
  }

  const { context: cameraContext, page: playerPage } = await preparePage(ACTOR_PLAYER_A);
  const { context: gmContext, page: gmPage } = await preparePage(ACTOR_GM);

  let playerBContext = null;
  let playerBPage = null;
  if (actors.includes('playerB')) {
    ({ context: playerBContext, page: playerBPage } = await preparePage(ACTOR_PLAYER_B));
  }

  /** @type {Record<'gm'|'playerA'|'playerB', import('@playwright/test').Page|null>} */
  const pagesByCamera = {
    gm: gmPage,
    playerA: playerPage,
    playerB: playerBPage,
  };

  const recordingCameras = /** @type {Array<'gm'|'playerA'|'playerB'>} */ (
    ['gm', 'playerA', 'playerB'].filter((c) => pagesByCamera[c])
  );

  async function syncDiceForActiveCamera() {
    // Sequential: parallel Hide/Show across 3 pages under GPU load was a common hang.
    for (const camera of recordingCameras) {
      await setDiceVisibility(pagesByCamera[camera], camera === activeCamera ? 'show' : 'hide');
    }
  }

  async function stopActiveRecording() {
    if (!activeRecording) return;
    const rec = activeRecording;
    activeRecording = null;
    const page = pagesByCamera[rec.camera];
    if (page && !page.isClosed()) {
      try {
        await withTimeout(page.screencast.stop().catch(() => {}), SCREENCAST_STOP_TIMEOUT_MS, `screencast.stop(${rec.camera})`);
      } catch (err) {
        console.warn(`[subclass-video] ${err instanceof Error ? err.message : err}`);
      }
    }
    try {
      if (rec.path && fs.existsSync(rec.path) && fs.statSync(rec.path).size > 0) {
        segments.push({ camera: rec.camera, path: rec.path, tMs: Math.max(0, rec.startedAt - t0) });
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Start CDP screencast on one camera. Caller must have stopped any prior recording.
   * @param {'gm'|'playerA'|'playerB'} camera
   */
  async function startRecording(camera) {
    const page = pagesByCamera[camera];
    if (!page || page.isClosed()) return;
    const tmpPath = path.join(SUBCLASS_VIDEO_TMP_DIR, `${videoSlug}-${camera}-${runTs}-s${segmentIndex}.webm`);
    segmentIndex += 1;
    tmpFiles.add(tmpPath);
    try {
      await withTimeout(
        page.screencast.start({ path: tmpPath, size: VIDEO_SIZE }),
        SCREENCAST_STOP_TIMEOUT_MS,
        `screencast.start(${camera})`
      );
      await page.screencast
        .showActions({
          cursor: 'pointer',
          position: 'bottom-right',
          duration: 800,
          fontSize: 16,
        })
        .catch(() => {});
      activeRecording = { camera, path: tmpPath, startedAt: Date.now() };
    } catch (err) {
      console.warn(`[subclass-video] ${err instanceof Error ? err.message : err}`);
      activeRecording = null;
    }
  }

  /**
   * Append an EDL cut, switch the single active screencast, and sync dice visibility.
   * @param {'gm'|'playerA'|'playerB'} camera
   */
  async function cutTo(camera) {
    if (!pagesByCamera[camera]) return;
    if (camera === activeCamera && cuts.length > 0) {
      // Still refresh dice in case the table just loaded.
      await syncDiceForActiveCamera();
      return;
    }
    const opening = cuts.length === 0;
    if (opening) t0 = Date.now();

    if (activeRecording && activeRecording.camera !== camera) {
      await stopActiveRecording();
    } else if (activeRecording && activeRecording.camera === camera) {
      // Same camera but first cut not yet recorded in EDL — keep rolling.
    }

    activeCamera = camera;
    // First cut anchors the EDL at t=0 so the opening camera matches the first caption role.
    cuts.push({ tMs: opening ? 0 : Date.now() - t0, camera });

    if (!activeRecording) {
      await startRecording(camera);
    }
    await syncDiceForActiveCamera();
  }

  /**
   * Set identical caption text on all recorded pages. Unless `opts.cut === false`, map
   * role → camera and cut when mapped.
   */
  async function caption(role, featureName, note, opts = {}) {
    const text = `${subclassLabel}\n[${String(role).toUpperCase()}] ${featureName}${note ? ` — ${note}` : ''}`;
    await Promise.all(
      recordingCameras.map((camera) =>
        pagesByCamera[camera].evaluate((t) => window.__dhSetCaption?.(t), text).catch(() => {})
      )
    );
    if (opts.cut !== false) {
      const mapped = roleToCamera(role);
      if (mapped) await cutTo(mapped);
    }
    // Minimum on-screen duration so captions are followable in the stitched video at 1x.
    const holdPage = pagesByCamera[activeCamera] || playerPage;
    await holdPage.waitForTimeout(CAPTION_HOLD_MS);
  }

  /** Hold on the active stitch camera so the screencast captures the WebGL tumble. */
  async function hold(ms = DICE_TUMBLE_HOLD_MS) {
    const page = pagesByCamera[activeCamera] || playerPage;
    await holdForDiceTumble(page, ms);
  }

  /**
   * Acknowledge a banner after holding on the **active** camera (use `holdMs: 0` after an
   * explicit tumble hold + cut to GM).
   */
  async function ack(bannerLocator, opts = {}) {
    const holdPage = pagesByCamera[activeCamera] || playerPage;
    await acknowledgeBanner(bannerLocator, { holdPage, ...opts });
  }

  /**
   * Hold tumble on the active camera, cut to the banner's actor page if needed, then ack
   * with `holdMs: 0`. Prefer the explicit `holdForDiceTumble` → `caption('GM',…)` →
   * `ack(..., { holdMs: 0 })` pattern when the caption should narrate the cut.
   */
  async function ackAfterHold(bannerLocator, opts = {}) {
    await hold(opts.holdMs === 0 ? 0 : (opts.holdMs ?? DICE_TUMBLE_HOLD_MS));
    const bannerPage = bannerLocator.page();
    for (const camera of recordingCameras) {
      if (pagesByCamera[camera] === bannerPage) {
        await cutTo(camera);
        break;
      }
    }
    await ack(bannerLocator, { ...opts, holdMs: 0 });
  }

  async function finish() {
    const cutsPath = path.join(SUBCLASS_VIDEO_TMP_DIR, `${videoSlug}-cuts-${runTs}.json`);
    tmpFiles.add(cutsPath);

    // Stop the active screencast before stitching / tearing down contexts.
    await stopActiveRecording();

    try {
      fs.writeFileSync(
        cutsPath,
        JSON.stringify(
          {
            videoSlug,
            cuts,
            segments: segments.map((s) => ({ camera: s.camera, path: s.path, tMs: s.tMs })),
          },
          null,
          2
        )
      );
    } catch {
      // best-effort debug artifact
    }

    const destPath = path.join(SUBCLASS_VIDEO_OUT_DIR, `${videoSlug}.webm`);
    let stitched = null;
    try {
      const segmentPaths = segments.map((s) => s.path).filter((p) => {
        try {
          return p && fs.existsSync(p) && fs.statSync(p).size > 0;
        } catch {
          return false;
        }
      });
      if (segmentPaths.length === 0) {
        console.warn(
          `[subclass-video] No screencast files for ${videoSlug}; skipping stitch (timeout/interrupt cleanup?)`
        );
      } else {
        try {
          const result = stitchOrderedSegmentFiles({
            segmentPaths,
            outputPath: destPath,
            width: VIDEO_SIZE.width,
            height: VIDEO_SIZE.height,
            timeoutMs: STITCH_TIMEOUT_MS,
          });
          stitched = result.outputPath;
        } catch (err) {
          console.warn(
            `[subclass-video] stitch failed for ${videoSlug}: ${err instanceof Error ? err.message : err}`
          );
        }
      }
    } finally {
      const closeTasks = [
        withTimeout(gmContext.close().catch(() => {}), CONTEXT_CLOSE_TIMEOUT_MS, 'gmContext.close').catch((e) =>
          console.warn(`[subclass-video] ${e.message}`)
        ),
        withTimeout(cameraContext.close().catch(() => {}), CONTEXT_CLOSE_TIMEOUT_MS, 'playerContext.close').catch(
          (e) => console.warn(`[subclass-video] ${e.message}`)
        ),
      ];
      if (playerBContext) {
        closeTasks.push(
          withTimeout(playerBContext.close().catch(() => {}), CONTEXT_CLOSE_TIMEOUT_MS, 'playerBContext.close').catch(
            (e) => console.warn(`[subclass-video] ${e.message}`)
          )
        );
      }
      await Promise.all(closeTasks);

      for (const p of tmpFiles) {
        try {
          fs.rmSync(p, { force: true });
        } catch {
          /* ignore */
        }
      }
      for (const s of segments) {
        try {
          fs.rmSync(s.path, { force: true });
        } catch {
          /* ignore */
        }
      }
    }
    return stitched;
  }

  return {
    gmPage,
    playerPage,
    playerBPage,
    cutTo,
    caption,
    holdForDiceTumble: hold,
    ensureSheetOpen,
    selectBannerDamageTarget,
    dismissBannerTargetMenu,
    ack,
    ackAfterHold,
    finish,
  };
}
