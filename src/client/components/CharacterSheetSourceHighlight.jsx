import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

/** @type {import('react').Context<null | {
 *   highlight: import('../lib/source-badge-sheet-highlight.js').SheetSourceHighlight;
 *   setHighlight: (h: import('../lib/source-badge-sheet-highlight.js').SheetSourceHighlight) => void;
 *   clearHighlightSoon: () => void;
 *   cancelClear: () => void;
 * }>} */
export const CharacterSheetSourceHighlightContext = createContext(null);

/**
 * @param {{ children: import('react').ReactNode, disabled?: boolean }} props
 * When `disabled`, renders children only (no context) — use on nested sheets where a parent already provides highlight (e.g. Game Table title bar + `omitHeader` body).
 */
export function CharacterSheetSourceHighlightProvider({ children, disabled = false }) {
  const [highlight, setHighlightState] = useState(
    /** @type {import('../lib/source-badge-sheet-highlight.js').SheetSourceHighlight} */ (null),
  );
  const leaveTimerRef = useRef(null);

  const cancelClear = useCallback(() => {
    if (leaveTimerRef.current != null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const setHighlight = useCallback(
    (h) => {
      cancelClear();
      setHighlightState(h);
    },
    [cancelClear],
  );

  const clearHighlightSoon = useCallback(() => {
    cancelClear();
    leaveTimerRef.current = setTimeout(() => {
      setHighlightState(null);
      leaveTimerRef.current = null;
    }, 45);
  }, [cancelClear]);

  const value = useMemo(
    () => ({ highlight, setHighlight, clearHighlightSoon, cancelClear }),
    [highlight, setHighlight, clearHighlightSoon, cancelClear],
  );

  if (disabled) return children;

  return (
    <CharacterSheetSourceHighlightContext.Provider value={value}>
      {children}
    </CharacterSheetSourceHighlightContext.Provider>
  );
}

export function useCharacterSheetSourceHighlightState() {
  return useContext(CharacterSheetSourceHighlightContext);
}

/**
 * @returns {{ highlight: import('../lib/source-badge-sheet-highlight.js').SheetSourceHighlight | null | undefined }}
 */
export function useCharacterSheetSourceHighlightOptional() {
  const ctx = useContext(CharacterSheetSourceHighlightContext);
  return useMemo(() => (ctx ? { highlight: ctx.highlight } : { highlight: null }), [ctx]);
}

/**
 * Spread onto title-row source badges: `...badgeHover('class')`, `...badgeHover('ancestry', { name: 'Faerie' })`.
 * Do not use `onMouseLeave` on badges — moving the pointer from a badge toward the sheet would clear
 * the highlight before the dimmed sheet is visible. Use {@link CharacterSheetHighlightSurface} on the
 * whole sheet shell and clear there only when the pointer leaves the panel.
 */
export function useCharacterSheetSourceBadgeHover() {
  const ctx = useContext(CharacterSheetSourceHighlightContext);
  return useMemo(() => {
    if (!ctx) {
      return () => ({});
    }
    const { setHighlight, cancelClear } = ctx;
    return (kind, extra = {}) => ({
      onMouseEnter: () => {
        cancelClear();
        if (kind === 'pronouns' || kind === 'incomplete' || kind === 'library') {
          setHighlight(null);
          return;
        }
        setHighlight({ kind, ...extra });
      },
    });
  }, [ctx]);
}

/**
 * Wrap the entire character sheet chrome (title + body) so leaving the panel clears the highlight.
 * Must render inside {@link CharacterSheetSourceHighlightProvider}.
 */
export function CharacterSheetHighlightSurface({ children, className = '', style }) {
  const ctx = useCharacterSheetSourceHighlightState();
  return (
    <div className={className} style={style} onMouseLeave={() => ctx?.clearHighlightSoon()}>
      {children}
    </div>
  );
}
