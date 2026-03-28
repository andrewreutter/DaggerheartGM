import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Manages a single hover-triggered overlay with:
 *  - Desktop: show on mouseenter (with optional delay), hide on mouseleave (with configurable delay)
 *  - Touch:   show/hide on click (tap-to-toggle); dismiss on tap outside
 *
 * Usage:
 *   const overlay = useHoverOverlay({ hideDelay: 120, isTouch });
 *
 *   // On the trigger element:
 *   <div {...overlay.triggerProps(myData)}>
 *
 * mode: 'hover' (default) | 'click' — desktop uses click to open/close instead of hover.
 * When mode is 'click', pass getClickToggleKey(data) to return an id so clicking the same
 * trigger again closes the overlay; clicking a different trigger replaces it.
 * Desktop click mode also dismisses on mousedown outside the overlay and outside the active trigger
 * unless disableDesktopOutsideDismiss is true (e.g. Game Table character sheet: close via trigger
 * toggle or explicit close(); play actions still call dismiss from parents).
 * Optional suppressOutsideDismissRef: when `.current` is true, outside dismiss is skipped (e.g. while
 * a portaled editor is active and targets may be outside the overlay subtree).
 *
 *   // On the overlay element:
 *   {overlay.isOpen && <div ref={overlay.overlayRef} {...overlay.overlayHandlers}>...</div>}
 *
 * overlay.data — the value passed to show() / triggerProps()
 * overlay.isOpen — boolean
 * overlay.show(data) — open with given data
 * overlay.close() — close immediately
 * overlay.triggerRef — ref to attach to the trigger element (used for outside-tap detection)
 */
export function useHoverOverlay({
  hideDelay = 120,
  isTouch = false,
  mode = 'hover',
  getClickToggleKey,
  suppressOutsideDismissRef = null,
  disableDesktopOutsideDismiss = false,
} = {}) {
  const [data, setData] = useState(null);
  const timerRef = useRef(null);
  const overlayRef = useRef(null);
  const triggerRef = useRef(null);
  // Tracks the specific element that opened the overlay on touch.
  // Never spread as a React ref prop so React's commit phase can't overwrite it.
  const activeTouchTriggerRef = useRef(null);

  const isOpen = data !== null;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback((newData) => {
    clearTimer();
    setData(newData ?? true);
  }, [clearTimer]);

  const close = useCallback(() => {
    clearTimer();
    setData(null);
  }, [clearTimer]);

  const scheduleClose = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setData(null);
      timerRef.current = null;
    }, hideDelay);
  }, [hideDelay, clearTimer]);

  // Touch: dismiss when tapping outside both trigger and overlay
  useEffect(() => {
    if (!isTouch || !isOpen) return;
    const handler = (e) => {
      if (suppressOutsideDismissRef?.current) return;
      const inOverlay  = overlayRef.current  && overlayRef.current.contains(e.target);
      // Use activeTouchTriggerRef (set in onClick) rather than triggerRef (which
      // React overwrites to the last-rendered element when many cards share the hook).
      const inTrigger  = activeTouchTriggerRef.current && activeTouchTriggerRef.current.contains(e.target);
      if (!inOverlay && !inTrigger) {
        setData(null);
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    return () => document.removeEventListener('touchstart', handler);
  }, [isTouch, isOpen]);

  // Desktop mode === 'click': dismiss on mousedown outside overlay + active trigger
  useEffect(() => {
    if (isTouch || mode !== 'click' || !isOpen || disableDesktopOutsideDismiss) return;
    const handler = (e) => {
      if (suppressOutsideDismissRef?.current) return;
      const inOverlay = overlayRef.current && overlayRef.current.contains(e.target);
      const inTrigger = activeTouchTriggerRef.current && activeTouchTriggerRef.current.contains(e.target);
      if (!inOverlay && !inTrigger) {
        setData(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isTouch, mode, isOpen, disableDesktopOutsideDismiss]);

  // Clean up timer on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  /**
   * Returns props to spread on the trigger element.
   * dataOrFn: the overlay data value, or a function (e) => data for event-based data extraction.
   * If the resolved value is null or undefined the overlay will not open.
   */
  const applyClickOverlayData = useCallback((e, resolve) => {
    const next = resolve(e);
    if (next === null || next === undefined) return;
    setData((prev) => {
      if (getClickToggleKey) {
        const nk = getClickToggleKey(next);
        const pk = prev != null ? getClickToggleKey(prev) : null;
        if (pk != null && nk != null && pk === nk) return null;
        return next;
      }
      return prev !== null ? null : next;
    });
  }, [getClickToggleKey]);

  const triggerProps = useCallback((dataOrFn) => {
    const resolve = (e) => typeof dataOrFn === 'function' ? dataOrFn(e) : dataOrFn;
    if (isTouch) {
      return {
        onClick: (e) => {
          // Track which element was tapped so the outside-tap handler can
          // correctly identify it as "in trigger" even when multiple cards
          // share the same hook instance.
          activeTouchTriggerRef.current = e.currentTarget;
          applyClickOverlayData(e, resolve);
        },
      };
    }
    if (mode === 'click') {
      return {
        onMouseDown: (e) => {
          // Same ref as touch: outside-dismiss must see which card is “active” before click completes.
          activeTouchTriggerRef.current = e.currentTarget;
        },
        onClick: (e) => {
          applyClickOverlayData(e, resolve);
        },
      };
    }
    return {
      ref: triggerRef,
      onMouseEnter: (e) => {
        const next = resolve(e);
        if (next !== null && next !== undefined) show(next);
      },
      onMouseLeave: scheduleClose,
    };
  }, [isTouch, mode, show, scheduleClose, applyClickOverlayData]);

  /**
   * Props to spread on the overlay element (desktop hover mode only — keeps overlay open
   * while the mouse moves between trigger and overlay). Click mode uses outside-dismiss only.
   */
  const overlayHandlers = isTouch
    ? {}
    : mode === 'click'
      ? {}
      : { onMouseEnter: clearTimer, onMouseLeave: close };

  return {
    data,
    isOpen,
    show,
    close,
    scheduleClose,
    cancelClose: clearTimer,
    overlayRef,
    triggerRef,
    triggerProps,
    overlayHandlers,
  };
}
