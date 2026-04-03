import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { renderMarkdown } from './markdown.js';
import {
  PORTAL_HOVER_TOOLTIP_WIDTH,
  PORTAL_HOVER_TOOLTIP_WIDTH_WIDE,
  PORTAL_HOVER_TOOLTIP_BOTTOM_PAD,
  clampPortalHoverTooltipY,
  isClampPingPong,
  PORTAL_TOOLTIP_MAX_Y_CLAMPS_PER_SESSION,
  computePortalHoverTooltipPosition,
  computePortalHoverTooltipPositionBelow,
} from './portal-hover-tooltip-position.js';

export {
  PORTAL_HOVER_TOOLTIP_WIDTH,
  PORTAL_HOVER_TOOLTIP_WIDTH_WIDE,
  PORTAL_HOVER_TOOLTIP_GAP,
  PORTAL_HOVER_TOOLTIP_BOTTOM_PAD,
  clampPortalHoverTooltipY,
  isClampPingPong,
  PORTAL_TOOLTIP_MAX_Y_CLAMPS_PER_SESSION,
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
  /** Breaks ResizeObserver ↔ clamp feedback when scrollbar toggling flips measured height (React #185). */
  const clampPingPongRef = useRef({ from: null, to: null });
  /** Hard cap per hover session — ping-pong only catches A↔B; longer cycles / layout thrash still need a ceiling. */
  const yClampSessionCountRef = useRef(0);

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
    clampPingPongRef.current = { from: null, to: null };
    yClampSessionCountRef.current = 0;
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
    clampPingPongRef.current = { from: null, to: null };
    yClampSessionCountRef.current = 0;
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
    if (!tooltip) {
      clampPingPongRef.current = { from: null, to: null };
      yClampSessionCountRef.current = 0;
      return undefined;
    }

    let resizeRafId = null;
    const applyClamp = () => {
      const el = tooltipRef.current;
      if (!el) return;
      const height = Math.round(el.getBoundingClientRect().height);
      if (height <= 0) return;
      const innerH = window.innerHeight;
      const pad = PORTAL_HOVER_TOOLTIP_BOTTOM_PAD;
      setTooltip((t) => {
        if (!t) return t;
        // Use the portaled node's actual viewport top — not `t.y`. Batched updates can leave
        // `t.y` stale while `[tooltip]` still changes identity, causing React #185 loops.
        const curY = Math.round(el.getBoundingClientRect().top);
        const nextY = Math.round(clampPortalHoverTooltipY(curY, height, innerH, pad));
        if (nextY === curY) return t;
        if (isClampPingPong(curY, nextY, clampPingPongRef.current)) {
          return t;
        }
        if (yClampSessionCountRef.current >= PORTAL_TOOLTIP_MAX_Y_CLAMPS_PER_SESSION) {
          return t;
        }
        yClampSessionCountRef.current += 1;
        clampPingPongRef.current = { from: curY, to: nextY };
        return { ...t, y: nextY };
      });
    };

    const scheduleClampFromResize = () => {
      if (resizeRafId != null) return;
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        applyClamp();
      });
    };

    applyClamp();
    const raf = requestAnimationFrame(() => {
      applyClamp();
    });

    const node = tooltipRef.current;
    if (typeof ResizeObserver === 'undefined' || !node) {
      return () => {
        cancelAnimationFrame(raf);
        if (resizeRafId != null) cancelAnimationFrame(resizeRafId);
      };
    }

    const ro = new ResizeObserver(() => {
      scheduleClampFromResize();
    });
    ro.observe(node);
    return () => {
      cancelAnimationFrame(raf);
      if (resizeRafId != null) cancelAnimationFrame(resizeRafId);
      ro.disconnect();
    };
  }, [tooltip]);

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
      <div className="bg-dh-raised border border-dh-strong rounded-lg shadow-2xl p-3 overflow-y-auto max-h-[min(70vh,calc(100vh-32px))] [scrollbar-gutter:stable]">
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
