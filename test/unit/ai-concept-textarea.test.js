import { describe, it, expect, vi } from 'vitest';
import { handleAiConceptTextareaKeyDown } from '../../src/client/lib/ai-concept-textarea.js';

describe('handleAiConceptTextareaKeyDown', () => {
  it('calls onSubmit and prevents default on Enter when canSubmit', () => {
    const onSubmit = vi.fn();
    const e = {
      key: 'Enter',
      shiftKey: false,
      preventDefault: vi.fn(),
    };
    handleAiConceptTextareaKeyDown(e, { onSubmit, canSubmit: true });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit on Shift+Enter', () => {
    const onSubmit = vi.fn();
    const e = {
      key: 'Enter',
      shiftKey: true,
      preventDefault: vi.fn(),
    };
    handleAiConceptTextareaKeyDown(e, { onSubmit, canSubmit: true });
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit when canSubmit is false', () => {
    const onSubmit = vi.fn();
    const e = {
      key: 'Enter',
      shiftKey: false,
      preventDefault: vi.fn(),
    };
    handleAiConceptTextareaKeyDown(e, { onSubmit, canSubmit: false });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
