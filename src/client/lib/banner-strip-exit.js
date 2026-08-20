/**
 * Slide-off dismiss for the Game Table banner strip.
 *
 * The strip is `row-reverse` (oldest on the right). Apply / Dismiss / Cancel
 * takes the banner out of flow and translates it right, past the strip's
 * overflow clip at the adversary tray. Banners to its visual left FLIP from
 * their previous left to the vacated spot and settle.
 */

export const BANNER_STRIP_EXIT_MS = 360;
/** Extra time after the CSS transition so the card is gone before unmount. */
export const BANNER_STRIP_EXIT_REMOVE_DELAY_MS = BANNER_STRIP_EXIT_MS + 48;
export const BANNER_STRIP_EXIT_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const BANNER_STRIP_EXIT_PAD_PX = 16;
export const BANNER_STRIP_PRE_ROLL_SLOT_ID = '__preroll';

/** Stable slot id for the shared pre-roll card (always the leftmost flex item). */
export function bannerSlotId(bannerId) {
  return bannerId == null || bannerId === '' ? null : String(bannerId);
}

export function prefersBannerStripExitReducedMotion(matchMediaFn = globalThis.matchMedia) {
  return typeof matchMediaFn === 'function'
    && !!matchMediaFn.call(globalThis, '(prefers-reduced-motion: reduce)')?.matches;
}

/** Distance (px) an exiting banner must travel right to fully leave the strip. */
export function bannerExitTranslateX(bannerWidthPx, extraRightPx = BANNER_STRIP_EXIT_PAD_PX) {
  return Math.max(0, Number(bannerWidthPx) || 0) + Math.max(0, Number(extraRightPx) || 0);
}

/**
 * FLIP invert: apply `translateX(invert)` so a remaining banner still paints at
 * `previousLeft`, then animate to 0 to settle at `nextLeft`.
 */
export function bannerFlipInvertX(previousLeft, nextLeft) {
  const dx = (Number(previousLeft) || 0) - (Number(nextLeft) || 0);
  return Math.abs(dx) < 0.5 ? 0 : dx;
}

/**
 * Read strip-relative boxes for every `[data-banner-slot]`.
 * @param {Element | null | undefined} stripEl
 * @returns {{ strip: DOMRect | null, slots: Map<string, { left: number, width: number, height: number, bottom: number }> }}
 */
export function measureBannerSlots(stripEl) {
  if (!stripEl || typeof stripEl.getBoundingClientRect !== 'function') {
    return { strip: null, slots: new Map() };
  }
  const stripRect = stripEl.getBoundingClientRect();
  const slots = new Map();
  const nodes = stripEl.querySelectorAll('[data-banner-slot]');
  for (const el of nodes) {
    const id = bannerSlotId(el.getAttribute('data-banner-slot'));
    if (!id) continue;
    const r = el.getBoundingClientRect();
    slots.set(id, {
      left: r.left - stripRect.left,
      width: r.width,
      height: r.height,
      bottom: stripRect.bottom - r.bottom,
    });
  }
  return { strip: stripRect, slots };
}

/**
 * @param {{
 *   previousSlots: Map<string, { left: number, width: number, height?: number, bottom?: number }>,
 *   nextSlots: Map<string, { left: number, width?: number, height?: number, bottom?: number }>,
 *   exitingIds: Set<string> | string[],
 * }} args
 */
export function buildBannerExitMotion({ previousSlots, nextSlots, exitingIds }) {
  const exitingSet = exitingIds instanceof Set ? exitingIds : new Set(exitingIds || []);
  const exiting = {};
  const invert = {};
  for (const [id, prev] of previousSlots || []) {
    if (exitingSet.has(id)) {
      exiting[id] = {
        left: prev.left,
        bottom: prev.bottom ?? 0,
        width: prev.width,
        translateX: bannerExitTranslateX(prev.width),
      };
      continue;
    }
    const next = nextSlots?.get(id);
    if (!next) continue;
    const invertX = bannerFlipInvertX(prev.left, next.left);
    if (invertX) invert[id] = invertX;
  }
  return { exiting, invert };
}

export function bannerSlotExitStyle({ left, bottom, width, translateX, phase }) {
  const travel = phase === 'end' ? (Number(translateX) || 0) : 0;
  return {
    position: 'absolute',
    left: left ?? 0,
    bottom: bottom ?? 0,
    width: width ?? undefined,
    zIndex: 0,
    pointerEvents: 'none',
    transform: `translateX(${travel}px)`,
    transition: phase === 'end'
      ? `transform ${BANNER_STRIP_EXIT_MS}ms ${BANNER_STRIP_EXIT_EASING}`
      : 'none',
    willChange: 'transform',
  };
}

export function bannerSlotFlipStyle({ invertX, phase }) {
  const x = phase === 'end' ? 0 : (Number(invertX) || 0);
  return {
    position: 'relative',
    zIndex: 1,
    flexShrink: 0,
    transform: `translateX(${x}px)`,
    transition: phase === 'end'
      ? `transform ${BANNER_STRIP_EXIT_MS}ms ${BANNER_STRIP_EXIT_EASING}`
      : 'none',
    willChange: 'transform',
  };
}

export function bannerSlotRestStyle() {
  return {
    position: 'relative',
    zIndex: 1,
    flexShrink: 0,
  };
}
