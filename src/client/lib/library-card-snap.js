/**
 * Library grid: discrete card widths where column count changes (flex + gap).
 * Column count: max(1, floor((w + gap) / (cardWidth + gap))).
 */

/**
 * Horizontal width available for in-flow content inside `el` (content box minus padding).
 * Use for snap math when the scrollport has padding (e.g. visual gap before the scrollbar).
 */
export function scrollContentWidthPx(el) {
  if (el == null) return 0;
  const cs = getComputedStyle(el);
  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  return Math.max(0, el.clientWidth - pl - pr);
}

/**
 * Max integer card width (px) that still fits c columns: c*cw + (c-1)*gap <= w.
 * Descending: widest first (1 column), narrowest last (most columns).
 *
 * `w` must be the width available to the grid row (e.g. scrollport `clientWidth`), not a padded
 * ancestor’s `clientWidth` (that includes horizontal padding and would overstate usable width).
 */
export function computeLibrarySnapWidths(w, gap, minCardW) {
  if (w == null || w <= 0) return [];
  const out = [];
  for (let c = 1; c < 500; c++) {
    const cw = Math.floor((w - (c - 1) * gap) / c);
    if (cw < minCardW) break;
    out.push(cw);
  }
  return [...new Set(out)].sort((a, b) => b - a);
}

/**
 * Edge-drag / slider: next width after delta (px), clamped, then optional snap to column widths.
 */
export function computeResizedLibraryWidth(startWidth, deltaX, min, max, snapWidths) {
  const snaps = snapWidths ?? [];
  const raw = Math.round(Number(startWidth) + Number(deltaX));
  const clamped = Math.min(Math.max(raw, min), max);
  return snapLibraryCardWidth(clamped, snaps);
}

/**
 * Edge-drag / slider: next height after delta (px), clamped.
 */
export function computeResizedLibraryHeight(startHeight, deltaY, min, max) {
  const raw = Math.round(Number(startHeight) + Number(deltaY));
  return Math.min(Math.max(raw, min), max);
}

export function snapLibraryCardWidth(px, snaps) {
  if (!snaps.length) return px;
  let best = snaps[0];
  let bestD = Math.abs(px - best);
  for (const s of snaps) {
    const d = Math.abs(px - s);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function librarySnapIndexForWidth(px, snaps) {
  if (!snaps.length) return 0;
  let bestI = 0;
  let bestD = Infinity;
  snaps.forEach((s, i) => {
    const d = Math.abs(px - s);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  });
  return bestI;
}

/**
 * `computeLibrarySnapWidths` is descending (index 0 = widest). Range inputs are min=left, max=right;
 * map to a slider index where left = narrowest and right = widest.
 */
export function libraryWidthSliderIndexFromSnapIndex(snapCount, snapIndex) {
  if (snapCount <= 0) return 0;
  const i = Math.min(Math.max(0, snapIndex), snapCount - 1);
  return snapCount - 1 - i;
}

export function librarySnapIndexFromWidthSliderIndex(snapCount, sliderIndex) {
  if (snapCount <= 0) return 0;
  return libraryWidthSliderIndexFromSnapIndex(snapCount, sliderIndex);
}

/** Matches LibraryView row layout: flex gap, fixed card widths. */
export function libraryColumnCountForWidth(containerWidth, cardWidth, gap) {
  if (containerWidth == null || containerWidth <= 0) return 1;
  return Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));
}
