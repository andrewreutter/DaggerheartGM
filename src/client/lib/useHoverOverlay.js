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
 *   // On the overlay element:
 *   {overlay.isOpen && <div ref={overlay.overlayRef} {...overlay.overlayHandlers}>...</div>}
 *
 * overlay.data — the value passed to show() / triggerProps()
 * overlay.isOpen — boolean
 * overlay.show(data) — open with given data
 * overlay.close() — close immediately
 * overlay.triggerRef — ref to attach to the trigger element (used for outside-tap detection)
 */
export function useHoverOverlay({ hideDelay = 120, isTouch = false } = {}) {
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

  // Clean up timer on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  /**
   * Returns props to spread on the trigger element.
   * dataOrFn: the overlay data value, or a function (e) => data for event-based data extraction.
   * If the resolved value is null or undefined the overlay will not open.
   */
  const triggerProps = useCallback((dataOrFn) => {
    const resolve = (e) => typeof dataOrFn === 'function' ? dataOrFn(e) : dataOrFn;
    if (isTouch) {
      return {
        onClick: (e) => {
          // Track which element was tapped so the outside-tap handler can
          // correctly identify it as "in trigger" even when multiple cards
          // share the same hook instance.
          activeTouchTriggerRef.current = e.currentTarget;
          // Toggle: if already showing, close; otherwise open with resolved data.
          const next = resolve(e);
          if (next === null || next === undefined) return;
          setData(prev => prev !== null ? null : next);
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
  }, [isTouch, show, scheduleClose]);

  /**
   * Props to spread on the overlay element (desktop only — keeps overlay open
   * while the mouse moves between trigger and overlay).
   */
  const overlayHandlers = isTouch
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
