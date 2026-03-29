/**
 * Shared keyboard behavior for “Build with AI” concept textareas:
 * Enter submits (when allowed); Shift+Enter inserts a newline.
 *
 * @param {React.KeyboardEvent} e
 * @param {{ onSubmit: () => void, canSubmit: boolean }} opts
 */
export function handleAiConceptTextareaKeyDown(e, { onSubmit, canSubmit }) {
  if (e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  if (canSubmit) onSubmit();
}
