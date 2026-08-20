import React, { useEffect, useRef, useState } from 'react';

/**
 * Shared full-viewport fallback when the app hits an uncaught error.
 */
export function formatFatalErrorDetail({ error, errorInfo, message } = {}) {
  if (error instanceof Error) {
    return `${error.message}${error.stack ? `\n\n${error.stack}` : ''}`;
  }
  if (errorInfo?.componentStack) {
    return `${message || ''}\n\n${errorInfo.componentStack}`;
  }
  return message || String(error ?? '');
}

export function FatalErrorFallback({
  title = 'Something went wrong',
  message,
  error,
  errorInfo,
  onReload,
  onTryAgain,
  tryAgainLabel = 'Try again',
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef(null);
  const detail = formatFatalErrorDetail({ error, errorInfo, message });

  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

  const copyDetails = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail);
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard denied — details stay visible after toggle
    }
  };

  const handleDetailsClick = () => {
    setShowDetails((v) => !v);
    void copyDetails();
  };

  return (
    <div
      data-testid="fatal-error-fallback"
      className="min-h-[100dvh] bg-dh-surface text-dh font-sans flex flex-col items-center justify-center p-6"
      role="alert"
    >
      <div className="max-w-lg w-full rounded-lg border border-dh-border bg-dh-canvas/30 p-6 shadow-lg">
        <h1 className="text-lg font-semibold text-dh mb-2">{title}</h1>
        <p className="text-sm text-dh-muted mb-4">
          Daggertop hit an unexpected error. You can try again or reload the page.
        </p>
        {message && !showDetails ? (
          <p className="text-sm text-dh mb-4 font-mono break-words">{message}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {onTryAgain ? (
            <button
              type="button"
              onClick={onTryAgain}
              className="px-4 py-2 rounded-md bg-dh-hover hover:bg-dh-hover text-dh text-sm font-medium transition-colors border border-dh-border"
            >
              {tryAgainLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReload}
            className="px-4 py-2 rounded-md bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
          >
            Reload page
          </button>
        </div>
        {detail ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleDetailsClick}
              title={copied ? 'Copied!' : 'Copy technical details'}
              className="text-xs text-dh-muted hover:text-dh underline"
            >
              {copied ? 'Copied!' : `${showDetails ? 'Hide' : 'Show'} technical details`}
            </button>
            {showDetails ? (
              <pre
                role="button"
                tabIndex={0}
                title={copied ? 'Copied!' : 'Click to copy'}
                onClick={() => void copyDetails()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void copyDetails();
                  }
                }}
                className="mt-2 max-h-48 overflow-auto rounded border border-dh-border bg-dh-inset p-3 text-xs text-dh-muted whitespace-pre-wrap break-words cursor-pointer"
              >
                {detail}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
