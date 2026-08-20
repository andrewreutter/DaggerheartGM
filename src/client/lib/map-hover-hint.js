/**
 * Shared map-chrome tooltip: max-width math, platform zoom chord, Game Map /
 * map-object / token / sidebar-card copy. Token lines stay in
 * token-overlay-activate.js; Players / Characters / Encounter cards in
 * table-panel-hover-hint.js.
 */

import { tokenHoverHintModel } from './token-overlay-activate.js';

export const MAP_CHROME_TOOLTIP_MIN_WIDTH_PX = 140;
/** Gap between the floating map tile and the chrome tooltip (4× the original 8px clearance). */
export const MAP_CHROME_TOOLTIP_GAP_PX = 32;

export const GAME_MAP_TITLE = 'Game Map';
export const GAME_MAP_LOCKED_LEAD =
  'This camera is locked. Unlock it to pan and zoom, or use Zoom to Actors / Party / Adversaries.';
export const GAME_MAP_FOLLOW_GM_LEAD =
  'The camera follows the GM. Open a shared map tile to pan and zoom on your own.';
export const MAP_OBJECT_VIEW_ONLY_LINE =
  'You can view this. Only the GM or its creator can move or resize it.';

/** @typedef {{ text: string, icon?: string, role?: 'lead', legend?: string }} ChromeTooltipLine */

/**
 * @param {string|{ text?: string, icon?: string, role?: string }|null|undefined} line
 * @returns {ChromeTooltipLine|null}
 */
export function normalizeChromeTooltipLine(line) {
  if (typeof line === 'string') {
    const text = line.trim();
    return text ? { text } : null;
  }
  if (!line || typeof line !== 'object') return null;
  const text = String(line.text ?? '').trim();
  if (!text) return null;
  const out = { text };
  if (line.icon) out.icon = String(line.icon);
  if (line.role === 'lead') out.role = 'lead';
  if (line.legend) out.legend = String(line.legend);
  return out;
}

/**
 * @param {Array<string|ChromeTooltipLine>|null|undefined} lines
 * @returns {ChromeTooltipLine[]}
 */
export function normalizeChromeTooltipLines(lines) {
  return (Array.isArray(lines) ? lines : []).map(normalizeChromeTooltipLine).filter(Boolean);
}

/** Plain text of a line (for tests and joined copy). */
export function chromeTooltipLineText(line) {
  return typeof line === 'string' ? line : (line?.text ?? '');
}

/** Plain texts in order (for tests and joined copy). */
export function chromeTooltipLineTexts(lines) {
  return normalizeChromeTooltipLines(lines).map((line) => line.text);
}

/**
 * Split icon rows into legends (first-seen `legend` key; omitted → one default).
 * @param {ChromeTooltipLine[]} actions
 * @returns {ChromeTooltipLine[][]}
 */
export function groupChromeTooltipActionLegends(actions) {
  const groups = [];
  const indexByLegend = new Map();
  for (const line of actions || []) {
    const key = line.legend || '';
    if (!indexByLegend.has(key)) {
      indexByLegend.set(key, groups.length);
      groups.push([]);
    }
    groups[indexByLegend.get(key)].push(line);
  }
  return groups;
}

/**
 * Split instruction lines into vanilla lead copy, follow-up text, and icon rows.
 * @param {Array<string|ChromeTooltipLine>|null|undefined} lines
 * @returns {{
 *   lead: ChromeTooltipLine[],
 *   body: ChromeTooltipLine[],
 *   actions: ChromeTooltipLine[],
 *   legends: ChromeTooltipLine[][],
 * }}
 */
export function groupChromeTooltipLines(lines) {
  const lead = [];
  const body = [];
  const actions = [];
  for (const line of normalizeChromeTooltipLines(lines)) {
    if (line.icon) actions.push(line);
    else if (line.role === 'lead') lead.push(line);
    else body.push(line);
  }
  return { lead, body, actions, legends: groupChromeTooltipActionLegends(actions) };
}

function chromeTooltipGapPx(gapPx) {
  return Number.isFinite(gapPx) && gapPx >= 0 ? gapPx : MAP_CHROME_TOOLTIP_GAP_PX;
}

function chromeTooltipPickerBox(pickerLeft, pickerWidth) {
  const left = Number(pickerLeft);
  const width = Number(pickerWidth);
  if (!Number.isFinite(left) || !Number.isFinite(width) || width <= 0) return null;
  return { left, width };
}

/**
 * Space the tooltip may occupy without crossing the table-name inset.
 * `pickerLeft` is relative to the same origin as `viewportWidth` (map viewport left).
 *
 * @param {{
 *   viewportWidth?: number,
 *   pickerLeft?: number,
 *   pickerWidth?: number,
 *   tooltipRightInset?: number,
 *   gapPx?: number,
 *   minWidthPx?: number,
 * }} args
 * @returns {number}
 */
export function mapChromeTooltipMaxWidthPx({
  viewportWidth,
  pickerLeft,
  pickerWidth,
  tooltipRightInset,
  gapPx = MAP_CHROME_TOOLTIP_GAP_PX,
  minWidthPx = MAP_CHROME_TOOLTIP_MIN_WIDTH_PX,
} = {}) {
  const vw = Number(viewportWidth);
  const inset = Number(tooltipRightInset);
  const safeVw = Number.isFinite(vw) && vw > 0 ? vw : 0;
  const safeInset = Number.isFinite(inset) && inset > 0 ? inset : 0;
  const gap = chromeTooltipGapPx(gapPx);
  const minW = Number.isFinite(minWidthPx) && minWidthPx > 0 ? minWidthPx : MAP_CHROME_TOOLTIP_MIN_WIDTH_PX;
  const picker = chromeTooltipPickerBox(pickerLeft, pickerWidth);
  const raw = picker
    ? (safeVw - safeInset) - (picker.left + picker.width) - gap
    : safeVw / 2 - safeInset;
  return Math.max(minW, raw);
}

/**
 * Left edge of the tooltip: a fixed gap to the right of the floating map tile.
 * When the picker is hidden, sit just right of the viewport midline.
 *
 * @param {{
 *   viewportWidth?: number,
 *   pickerLeft?: number,
 *   pickerWidth?: number,
 *   gapPx?: number,
 * }} args
 * @returns {number}
 */
export function mapChromeTooltipLeftPx({
  viewportWidth,
  pickerLeft,
  pickerWidth,
  gapPx = MAP_CHROME_TOOLTIP_GAP_PX,
} = {}) {
  const gap = chromeTooltipGapPx(gapPx);
  const picker = chromeTooltipPickerBox(pickerLeft, pickerWidth);
  if (picker) return picker.left + picker.width + gap;
  const vw = Number(viewportWidth);
  const safeVw = Number.isFinite(vw) && vw > 0 ? vw : 0;
  return safeVw / 2 + gap;
}

/**
 * @param {{ platform?: string, userAgent?: string }|null|undefined} nav
 * @returns {'mac'|'windows'|'linux'|'other'}
 */
export function detectMapControlPlatform(nav) {
  const platform = String(nav?.platform || '');
  const ua = String(nav?.userAgent || '');
  if (/iPhone|iPad|iPod/i.test(platform) || /iPhone|iPad|iPod/i.test(ua)) return 'other';
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) return 'mac';
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return 'windows';
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return 'linux';
  return 'other';
}

/**
 * Zoom modifier+scroll chord for the viewer's OS.
 * @param {'mac'|'windows'|'linux'|'other'|string|null|undefined} platform
 * @returns {string}
 */
export function mapZoomChordLabel(platform) {
  return platform === 'mac' ? '⌘-scroll' : 'Ctrl-scroll';
}

/**
 * Implemented Game Map pan/zoom gestures for this input style (`Action: input`).
 * Pointer: mouse / trackpad chords. Touch: swipe + pinch.
 *
 * @param {'mac'|'windows'|'linux'|'other'|string|null|undefined} platform
 * @param {{ isTouch?: boolean }} [opts]
 * @returns {string[]}
 */
export function gameMapGestureLines(platform, { isTouch = false } = {}) {
  if (isTouch) {
    return [
      'Pan: two-finger swipe',
      'Zoom: pinch',
    ];
  }
  return [
    'Pan up and down: scroll',
    'Pan left and right: shift-scroll',
    'Pan in any direction: right-click and drag',
    `Zoom toward the pointer: ${mapZoomChordLabel(platform)}`,
  ];
}

/**
 * @param {object|null|undefined} el
 * @param {{ canModify?: boolean }} [opts]
 * @returns {{ title: string, lines: string[] }|null}
 */
export function mapObjectHoverHintModel(el, { canModify = true } = {}) {
  if (!el) return null;
  if (el.elementType === 'mapImage') {
    return {
      title: 'Map Image',
      lines: canModify
        ? [
          { text: 'Click to select.', role: 'lead' },
          'Drag to move.',
          'Drag a corner to resize (keeps aspect).',
          'Double-click to open.',
          'Eraser-click deletes.',
        ]
        : [MAP_OBJECT_VIEW_ONLY_LINE],
    };
  }
  if (el.elementType !== 'drawShape') return null;
  const tool = el.shapeTool;
  const title = tool === 'oval' ? 'Oval' : tool === 'brush' ? 'Brush stroke' : 'Rectangle';
  const resizeLine = tool === 'brush'
    ? 'Drag a corner to resize (scales the stroke uniformly).'
    : 'Drag a corner to resize.';
  return {
    title,
    lines: canModify
      ? [
        { text: 'Click to select.', role: 'lead' },
        'Drag to move.',
        resizeLine,
        'Eraser-click deletes.',
      ]
      : [MAP_OBJECT_VIEW_ONLY_LINE],
  };
}

/**
 * Map chrome: sidebar/panel hint (highest) → token → map object → Game Map idle.
 *
 * @param {{
 *   panelHint?: { id?: string, title?: string, lines?: string[] }|null,
 *   tokenElement?: object|null,
 *   mapObject?: object|null,
 *   canModifyMapObject?: boolean,
 *   cameraLocked?: boolean,
 *   canControlMapView?: boolean,
 *   showInstructions?: boolean,
 *   platform?: string,
 *   isTouch?: boolean,
 *   isPlayer?: boolean,
 * }} [opts]
 * When `showInstructions` is false, `title` and `lines` are empty so only the
 * Show-instructions checkbox remains.
 * @returns {{ id: string, title: string, lines: string[], showInstructionsToggle: boolean }}
 */
export function resolveMapChromeTooltip({
  panelHint = null,
  tokenElement = null,
  mapObject = null,
  canModifyMapObject = true,
  cameraLocked = false,
  canControlMapView = true,
  showInstructions = true,
  platform = 'other',
  isTouch = false,
  isPlayer = false,
} = {}) {
  let id = 'game-map';
  let title = GAME_MAP_TITLE;
  let lines = [];
  if (panelHint?.title) {
    id = panelHint.id || 'panel';
    title = panelHint.title;
    lines = Array.isArray(panelHint.lines) ? panelHint.lines : [];
  } else if (tokenElement) {
    const hint = tokenHoverHintModel(tokenElement, { isTouch, isPlayer });
    id = tokenElement.instanceId || 'token';
    title = hint.name;
    lines = hint.lines;
  } else {
    const objectHint = mapObjectHoverHintModel(mapObject, { canModify: canModifyMapObject });
    if (objectHint) {
      id = mapObject.instanceId || 'map-object';
      title = objectHint.title;
      lines = objectHint.lines;
    } else if (!canControlMapView) {
      lines = [GAME_MAP_FOLLOW_GM_LEAD];
    } else if (cameraLocked) {
      lines = [{ text: GAME_MAP_LOCKED_LEAD, role: 'lead' }, ...gameMapGestureLines(platform, { isTouch })];
    } else {
      lines = gameMapGestureLines(platform, { isTouch });
    }
  }
  return {
    id,
    title: showInstructions ? title : '',
    lines: showInstructions ? lines : [],
    showInstructionsToggle: true,
  };
}
