import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { renderMarkdown } from './markdown.js';
import {
  PORTAL_HOVER_TOOLTIP_WIDTH,
  PORTAL_HOVER_TOOLTIP_WIDTH_WIDE,
  PORTAL_HOVER_TOOLTIP_BOTTOM_PAD,
  computePortalHoverTooltipPosition,
  computePortalHoverTooltipPositionBelow,
} from './portal-hover-tooltip-position.js';

export {
  PORTAL_HOVER_TOOLTIP_WIDTH,
  PORTAL_HOVER_TOOLTIP_WIDTH_WIDE,
  PORTAL_HOVER_TOOLTIP_GAP,
  PORTAL_HOVER_TOOLTIP_BOTTOM_PAD,
  computePortalHoverTooltipPosition,
  computePortalHoverTooltipPositionBelow,
} from './portal-hover-tooltip-position.js';

/**
 * Portaled hover tooltip anchored to the element under the pointer — no wrapper span around the trigger.
 * Shared by CustomSelect option rows and segmented V2 chip buttons.
 */
export function usePortalHoverTooltip() {
  const [tooltip, setTooltip] = useState(null);
  const tooltipRef = useRef(null);
  const leaveTimerRef = useRef(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current != null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => setTooltip(null), 180);
  }, [clearLeaveTimer]);

  const hide = useCallback(() => {
    clearLeaveTimer();
    setTooltip(null);
  }, [clearLeaveTimer]);

  /**
   * @param {React.MouseEvent} e
   * @param {object} payload
   * @param {string} [payload.label] — title row (markdown title uses plain text)
   * @param {string} [payload.description] — markdown body
   * @param {boolean} [payload.wide]
   * @param {import('react').ReactNode} [payload.extra] — below markdown; enables pointer-events + delayed hide
   * @param {string|null} [payload.extraKey]
   * @param {import('react').ReactNode} [payload.renderInner] — replaces label+description when set (e.g. preview banner)
   * @param {import('react').RefObject<HTMLElement|null>} [payload.anchorRef] — when set, position below this element (full chip bank); ignores per-button rect
   * @param {string} [payload.contentKey] — for layout nudge when using renderInner
   */
  const showFromPointerEvent = useCallback((e, payload) => {
    clearLeaveTimer();
    const wide = payload.wide ?? false;
    const anchorEl = payload.anchorRef?.current ?? null;
    const rect = anchorEl ? anchorEl.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
    const { x, y } = anchorEl
      ? computePortalHoverTooltipPositionBelow(rect, wide)
      : computePortalHoverTooltipPosition(rect, wide);

    if (payload.renderInner != null) {
      setTooltip({
        x,
        y,
        wide,
        renderInner: payload.renderInner,
        extra: payload.extra ?? null,
        extraKey: payload.extraKey ?? null,
        contentKey: payload.contentKey ?? 'inner',
      });
      return;
    }

    const desc = typeof payload.description === 'string' ? payload.description : '';
    const extra = payload.extra ?? null;
    if (!desc.trim() && extra == null) {
      setTooltip(null);
      return;
    }

    setTooltip({
      x,
      y,
      wide,
      label: typeof payload.label === 'string' ? payload.label : '',
      description: desc,
      extra,
      extraKey: payload.extraKey ?? null,
      contentKey: null,
    });
  }, [clearLeaveTimer]);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) return;
    const elBottom = tooltipRef.current.getBoundingClientRect().bottom;
    const overflow = elBottom - (window.innerHeight - PORTAL_HOVER_TOOLTIP_BOTTOM_PAD);
    if (overflow > 0) {
      setTooltip((t) => (t ? { ...t, y: Math.max(PORTAL_HOVER_TOOLTIP_BOTTOM_PAD, t.y - overflow) } : null));
    }
  }, [tooltip?.description, tooltip?.wide, tooltip?.extraKey, tooltip?.contentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  return {
    tooltip,
    tooltipRef,
    showFromPointerEvent,
    scheduleClose,
    clearLeaveTimer,
    hide,
  };
}

/**
 * Renders the portaled panel for {@link usePortalHoverTooltip}.
 */
export function PortalHoverTooltipLayer({ tooltip, tooltipRef, scheduleClose, clearLeaveTimer }) {
  if (!tooltip) return null;

  const width = tooltip.wide
    ? Math.min(PORTAL_HOVER_TOOLTIP_WIDTH_WIDE, window.innerWidth - 24)
    : PORTAL_HOVER_TOOLTIP_WIDTH;

  const interactive = tooltip.extra != null || tooltip.renderInner != null;

  return createPortal(
    <div
      ref={tooltipRef}
      className={`fixed z-[90] ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{
        left: tooltip.x,
        top: tooltip.y,
        width,
        maxHeight: window.innerHeight - PORTAL_HOVER_TOOLTIP_BOTTOM_PAD,
      }}
      onMouseEnter={interactive ? clearLeaveTimer : undefined}
      onMouseLeave={interactive ? scheduleClose : undefined}
    >
      <div className="bg-dh-raised border border-dh-strong rounded-lg shadow-2xl p-3 overflow-y-auto max-h-[min(70vh,calc(100vh-32px))]">
        {tooltip.renderInner != null ? (
          tooltip.renderInner
        ) : (
          <>
            <div className="text-xs font-semibold text-white mb-1.5">{tooltip.label}</div>
            {!!tooltip.description?.trim() && (
              <div
                className="text-xs text-dh leading-relaxed dh-md"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(tooltip.description) }}
              />
            )}
            {tooltip.extra}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
