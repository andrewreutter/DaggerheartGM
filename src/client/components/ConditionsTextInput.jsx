import React, { useEffect, useRef, useState } from 'react';

/**
 * Conditions / free-text table fields: parent state is server-driven (SSE). Plain controlled
 * inputs fight rapid snapshots. While focused, we keep a local draft and ignore stale `value`
 * props; when not focused we sync from the server. Pair with optimistic `conditions` updates
 * in app.jsx `sendUpdateActiveElement` / `handlePlayerCharacterUpdate`.
 */
export function ConditionsTextInput({
  value,
  instanceId,
  onCommit,
  className,
  placeholder,
  readOnly,
  disabled,
  autoFocus,
  onBlur: onBlurProp,
  'aria-label': ariaLabel,
}) {
  const [draft, setDraft] = useState(() => value ?? '');
  const focusedRef = useRef(false);

  useEffect(() => {
    setDraft(value ?? '');
    focusedRef.current = false;
  }, [instanceId]);

  useEffect(() => {
    if (!focusedRef.current) setDraft(value ?? '');
  }, [value]);

  if (readOnly) {
    return (
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        readOnly
        disabled={disabled}
        value={value ?? ''}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <input
      type="text"
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        onCommit(v);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        onBlurProp?.(e);
      }}
    />
  );
}
