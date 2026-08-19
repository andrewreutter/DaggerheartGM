/**
 * Token hover tooltip + overlay-activate helpers (BattleMap character,
 * companion, and adversary tokens).
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
 * Display name used on the instant token hover tooltip.
 * @param {{ elementType?: string, name?: string, label?: string }|null|undefined} element
 */
export function tokenHoverTooltipName(element) {
  if (!element) return 'Token';
  const raw = element.elementType === 'boardToken'
    ? (element.label || element.name)
    : element.name;
  const trimmed = raw != null ? String(raw).trim() : '';
  return trimmed || 'Token';
}

export const TOKEN_HOVER_HINT_LINES = [
  'Click and drag to move.',
  'To adjust altitude, click and drag the distance display to the left of the token.',
  'Right-click for action card.',
];

/**
 * @param {string|null|undefined} elementType
 */
export function isTokenHoverHintType(elementType) {
  return elementType === 'character' || elementType === 'adversary' || elementType === 'boardToken';
}

/**
 * Name + hint lines for the static token hover inset.
 * @param {string|{ elementType?: string, name?: string, label?: string }|null|undefined} nameOrElement
 */
export function tokenHoverHintModel(nameOrElement) {
  const name = typeof nameOrElement === 'string'
    ? (nameOrElement.trim() || 'Token')
    : tokenHoverTooltipName(nameOrElement);
  return { name, lines: TOKEN_HOVER_HINT_LINES };
}

/**
 * Instant hover copy for character / companion / adversary tokens.
 * @param {string|{ elementType?: string, name?: string, label?: string }|null|undefined} nameOrElement
 */
export function tokenHoverTooltipText(nameOrElement) {
  const { name, lines } = tokenHoverHintModel(nameOrElement);
  return [name, ...lines].join('\n');
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
  const id = trayHoverInstanceId ?? snappedInstanceId ?? null;
  if (!id || !Array.isArray(elements)) return null;
  const el = elements.find((e) => e.instanceId === id);
  if (!el || !isTokenHoverHintType(el.elementType)) return null;
  return el;
}
