import { useState, useEffect, useRef, useCallback } from 'react';

const MAX_UNDO_STACK = 100;
// Keystrokes within this window are grouped into a single undo entry.
const UNDO_GROUP_MS = 600;

/**
 * Manages form state with undo/redo history and debounced auto-save.
 *
 * Undo grouping: rapid `setFormData` calls within UNDO_GROUP_MS of each other
 * are collapsed into a single undo entry. The snapshot captured BEFORE the
 * first call of a burst is what gets pushed to the undo stack after the burst
 * settles. This prevents one undo entry per keystroke when the user is typing.
 *
 * @param {object} options
 * @param {object} options.initial          - Initial form data
 * @param {function} options.onSave         - Called with current formData after debounce
 * @param {number} [options.debounceMs=800] - Auto-save debounce delay in ms
 * @param {boolean} [options.isNew=false]   - Skip auto-save until item has a name
 *
 * @returns {{
 *   formData: object,
 *   setFormData: (data: object) => void,
 *   undo: () => void,
 *   redo: () => void,
 *   canUndo: boolean,
 *   canRedo: boolean,
 *   isSaving: boolean,
 *   savedOnce: boolean,
 * }}
 */
export function useAutoSaveUndo({ initial, onSave, debounceMs = 800, isNew = false }) {
  const [formData, setFormDataRaw] = useState(() => initial || {});
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(!isNew);

  const saveTimerRef = useRef(null);
  const undoTimerRef = useRef(null);
  // Snapshot of formData at the START of the current typing burst; null when idle.
  const undoPendingRef = useRef(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const scheduleSave = useCallback((data) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (isNew && !data.name?.trim()) return;
      setIsSaving(true);
      try {
        await onSaveRef.current(data);
        setSavedOnce(true);
      } finally {
        setIsSaving(false);
      }
    }, debounceMs);
  }, [debounceMs, isNew]);

  const setFormData = useCallback((newData) => {
    setFormDataRaw(prev => {
      if (undoPendingRef.current === null) {
        // First change in a new burst: capture the pre-burst snapshot and
        // immediately clear redo (user has diverged from the redo timeline).
        undoPendingRef.current = prev;
        setRedoStack([]);
      }

      // Restart the undo grouping timer.
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        const snapshot = undoPendingRef.current;
        undoPendingRef.current = null;
        if (snapshot !== null) {
          setUndoStack(stack => {
            const next = [...stack, snapshot];
            return next.length > MAX_UNDO_STACK ? next.slice(next.length - MAX_UNDO_STACK) : next;
          });
        }
      }, UNDO_GROUP_MS);

      scheduleSave(newData);
      return newData;
    });
  }, [scheduleSave]);

  const undo = useCallback(() => {
    // Cancel any pending undo grouping timer.
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const pendingSnapshot = undoPendingRef.current;
    undoPendingRef.current = null;

    if (pendingSnapshot !== null) {
      // There's a burst in progress — undo means "restore to pre-burst state".
      setFormDataRaw(current => {
        setRedoStack(rs => [...rs, current]);
        scheduleSave(pendingSnapshot);
        return pendingSnapshot;
      });
      return;
    }

    // No burst in progress — normal undo from the stack.
    setUndoStack(stack => {
      if (!stack.length) return stack;
      const prev = stack[stack.length - 1];
      const newStack = stack.slice(0, -1);
      setFormDataRaw(current => {
        setRedoStack(rs => [...rs, current]);
        scheduleSave(prev);
        return prev;
      });
      return newStack;
    });
  }, [scheduleSave]);

  const redo = useCallback(() => {
    // Cancel any pending burst and discard it before applying redo.
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoPendingRef.current = null;

    setRedoStack(stack => {
      if (!stack.length) return stack;
      const next = stack[stack.length - 1];
      const newStack = stack.slice(0, -1);
      setFormDataRaw(current => {
        setUndoStack(us => [...us, current]);
        scheduleSave(next);
        return next;
      });
      return newStack;
    });
  }, [scheduleSave]);

  // Flush pending timers on unmount.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  return {
    formData,
    setFormData,
    undo,
    redo,
    canUndo: undoStack.length > 0 || undoPendingRef.current !== null,
    canRedo: redoStack.length > 0,
    isSaving,
    savedOnce,
  };
}
