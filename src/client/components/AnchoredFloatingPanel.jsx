import { useState, useLayoutEffect, useRef, useEffect } from 'react';

/**
 * Viewport-clamped `position: fixed` panel anchored near a click point (map token pin, etc.).
 */
export function AnchoredFloatingPanel({ anchorX, anchorY, children, className = '', zClassName = 'z-50', onEscape }) {
  useEffect(() => {
    if (!onEscape) return;
    const handler = (e) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onEscape]);
  const panelRef = useRef(null);
  const [pos, setPos] = useState(() => ({ left: anchorX + 12, top: anchorY - 20 }));
  useLayoutEffect(() => {
    const pel = panelRef.current;
    if (!pel) return;
    const rect = pel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchorX + 12;
    let top = anchorY - 20;
    if (left + rect.width > vw - 8) left = anchorX - rect.width - 12;
    top = Math.max(8, Math.min(vh - rect.height - 8, top));
    left = Math.max(8, left);
    setPos({ left, top });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={panelRef}
      className={`fixed ${zClassName} ${className}`.trim()}
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
