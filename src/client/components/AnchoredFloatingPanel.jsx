import { useState, useLayoutEffect, useRef, useEffect, useCallback } from 'react';
import { computeAnchoredFloatingPanelPos } from '../lib/anchored-floating-panel.js';

/**
 * Viewport-clamped `position: fixed` panel anchored near a click point (map token pin, etc.).
 * `preferLeft` mirrors the default right-of-anchor placement (right-tray adversary pins).
 * Stays hidden until the panel has a real size so the first open is not placed with width 0.
 */
export function AnchoredFloatingPanel({
  anchorX,
  anchorY,
  preferLeft = false,
  children,
  className = '',
  zClassName = 'z-50',
  onEscape,
}) {
  useEffect(() => {
    if (!onEscape) return;
    const handler = (e) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onEscape]);
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);
  const applyPos = useCallback(() => {
    const pel = panelRef.current;
    if (!pel) return;
    const rect = pel.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    setPos(computeAnchoredFloatingPanelPos({
      anchorX,
      anchorY,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      preferLeft,
    }));
  }, [anchorX, anchorY, preferLeft]);
  useLayoutEffect(() => {
    const pel = panelRef.current;
    if (!pel) return;
    applyPos();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => applyPos());
    ro.observe(pel);
    return () => ro.disconnect();
  }, [applyPos]);
  return (
    <div
      ref={panelRef}
      className={`fixed ${zClassName} ${className}`.trim()}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
