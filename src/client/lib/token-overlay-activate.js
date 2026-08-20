/**
 * Token hover tooltip + overlay-activate helpers (BattleMap character,
 * companion, adversary, and GM-crown tokens).
 */

/**
 * Shift / Command / Control / Option / Alt — any of these plus a left-click
 * opens the token action overlay (same as right-click).
 * @param {{ shiftKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean }|null|undefined} e
 */
export function isModifierKeyDown(e) {
  return !!(e && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey));
}

/**
 * Right-click (button 2) or modifier + primary click opens the token overlay.
 * Plain left-click is reserved for drag / tray navigation.
 * @param {{ button?: number, shiftKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean }|null|undefined} e
 */
export function isTokenOverlayActivateEvent(e) {
  if (!e) return false;
  if (e.button === 2) return true;
  return e.button === 0 && isModifierKeyDown(e);
}

/**
 * GM crown only: plain left-click and right-click both toggle GM Moves.
 * Middle-click does not. Touch tap is handled on pointerup to avoid a double toggle.
 * @param {{ button?: number }|null|undefined} e
 */
export function isGmTokenOverlayActivateEvent(e) {
  if (!e) return false;
  return e.button === 0 || e.button === 2;
}

/**
 * Swallow the native browser menu on token / tray right-click.
 * @param {{ preventDefault?: Function, stopPropagation?: Function }|null|undefined} e
 */
export function suppressBrowserContextMenu(e) {
  if (!e) return;
  e.preventDefault?.();
  e.stopPropagation?.();
}

/**
 * Overlay data for pinning GM Moves from the right-tray GM token.
 * @param {{ getBoundingClientRect?: () => { left: number } }|null|undefined} triggerEl
 */
export function buildGmTokenMovesOverlayData(triggerEl) {
  const left = triggerEl && typeof triggerEl.getBoundingClientRect === 'function'
    ? triggerEl.getBoundingClientRect().left
    : NaN;
  return {
    source: 'gm-token',
    edgeLeft: Number.isFinite(left) ? left : null,
  };
}

/** @param {{ source?: string }|null|undefined} data */
export function isGmTokenMovesOverlay(data) {
  return data?.source === 'gm-token';
}

/**
 * Capture the following `contextmenu` on `root` so a right-click that opens a
 * token pin cannot show the native menu after React remounts the target.
 * @param {{ addEventListener?: Function, removeEventListener?: Function }|null|undefined} root
 * @param {number} [timeoutMs]
 * @returns {() => void} cancel
 */
export function swallowNextContextMenu(root = typeof document !== 'undefined' ? document : null, timeoutMs = 500) {
  if (!root?.addEventListener) return () => {};
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    root.removeEventListener('contextmenu', swallow, true);
    clearTimeout(timer);
  };
  const swallow = (ev) => {
    suppressBrowserContextMenu(ev);
    cleanup();
  };
  root.addEventListener('contextmenu', swallow, true);
  const timer = setTimeout(cleanup, timeoutMs);
  return cleanup;
}

/**
 * Display name used on the instant token hover tooltip.
 * @param {{ elementType?: string, name?: string, label?: string }|null|undefined} element
 */
export function tokenHoverTooltipName(element) {
  if (!element) return 'Token';
  if (element.elementType === 'gmToken') return 'GM Moves';
  const raw = element.elementType === 'boardToken'
    ? (element.label || element.name)
    : element.name;
  const trimmed = raw != null ? String(raw).trim() : '';
  return trimmed || 'Token';
}

export const TOKEN_HOVER_HINT_LINES = [
  { text: 'Click and drag to move.', role: 'lead' },
  { text: 'To adjust altitude, click and drag the distance display to the left of the token.' },
  { text: 'Right-click for action card.' },
];

/** Sentinel used as `trayHoverInstanceId` while the right-tray GM crown is hovered. */
export const GM_TOKEN_HINT_INSTANCE_ID = 'gm-token';

export const GM_TOKEN_HOVER_HINT_ELEMENT = {
  instanceId: GM_TOKEN_HINT_INSTANCE_ID,
  elementType: 'gmToken',
  name: 'GM Moves',
};

/** What the board contains — same facts as the homepage GM Moves shot, for running the table. */
export const GM_TOKEN_HOVER_HINT_CONTENT_LINES = [
  'Default Moves plus every passive, Fear action, and attack from environments and adversaries on the table.',
  'In the panel:',
  'Click Off-Camera to reveal more actions from off-camera adversaries and environments.',
  'Click an attack to roll it. Hover a move for its text.',
];

export const GM_TOKEN_HOVER_HINT_LINES = [
  { text: 'Click or right-click to show or hide.', role: 'lead' },
  ...GM_TOKEN_HOVER_HINT_CONTENT_LINES,
];

export const GM_TOKEN_HOVER_HINT_LINES_TOUCH = [
  { text: 'Tap to show or hide.', role: 'lead' },
  ...GM_TOKEN_HOVER_HINT_CONTENT_LINES,
];

/**
 * @param {string|null|undefined} elementType
 */
export function isTokenHoverHintType(elementType) {
  return elementType === 'character' || elementType === 'adversary' || elementType === 'boardToken' || elementType === 'gmToken';
}

/**
 * Name + hint lines for the static token hover inset.
 * Creature tokens keep the shared drag / altitude / pin copy. The GM crown
 * documents click-or-right-click toggle (or tap on touch).
 * @param {string|{ elementType?: string, name?: string, label?: string }|null|undefined} nameOrElement
 * @param {{ isTouch?: boolean, isPlayer?: boolean }} [opts]
 */
export function tokenHoverHintModel(nameOrElement, { isTouch = false, isPlayer = false } = {}) {
  if (nameOrElement && typeof nameOrElement === 'object' && nameOrElement.elementType === 'gmToken') {
    return {
      name: 'GM Moves',
      lines: isPlayer ? [] : (isTouch ? GM_TOKEN_HOVER_HINT_LINES_TOUCH : GM_TOKEN_HOVER_HINT_LINES),
    };
  }
  const name = typeof nameOrElement === 'string'
    ? (nameOrElement.trim() || 'Token')
    : tokenHoverTooltipName(nameOrElement);
  return { name, lines: TOKEN_HOVER_HINT_LINES };
}

/**
 * Instant hover copy for character / companion / adversary tokens.
 * @param {string|{ elementType?: string, name?: string, label?: string }|null|undefined} nameOrElement
 * @param {{ isTouch?: boolean, isPlayer?: boolean }} [opts]
 */
export function tokenHoverTooltipText(nameOrElement, opts) {
  const { name, lines } = tokenHoverHintModel(nameOrElement, opts);
  return [name, ...lines.map((line) => (typeof line === 'string' ? line : line?.text ?? ''))].join('\n');
}

/**
 * Pick which token the top-right hover inset should describe.
 * Tray hover wins over a map-snapped bullseye; hide while dragging.
 * @param {{
 *   trayHoverInstanceId?: string|null,
 *   snappedInstanceId?: string|null,
 *   elements?: object[],
 *   dragging?: boolean,
 * }} opts
 */
export function resolveTokenHoverHintElement({
  trayHoverInstanceId = null,
  snappedInstanceId = null,
  elements = [],
  dragging = false,
} = {}) {
  if (dragging) return null;
  if (trayHoverInstanceId === GM_TOKEN_HINT_INSTANCE_ID) return GM_TOKEN_HOVER_HINT_ELEMENT;
  const id = trayHoverInstanceId ?? snappedInstanceId ?? null;
  if (!id || !Array.isArray(elements)) return null;
  const el = elements.find((e) => e.instanceId === id);
  if (!el || !isTokenHoverHintType(el.elementType)) return null;
  return el;
}
