import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { FatalErrorFallback } from './FatalErrorFallback.jsx';
import { ImageUploadOverlay } from './ImageUploadOverlay.jsx';

function formatReason(reason) {
  if (reason instanceof Error) return reason.message || String(reason);
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String(reason.message);
  }
  return String(reason);
}

/**
 * Root shell: global uncaught error / unhandled rejection UI + React error boundary around children.
 */
export function AppRoot({ children }) {
  const [fatalError, setFatalError] = useState(null);

  useEffect(() => {
    const onWindowError = (event) => {
      if (event.target && event.target !== window && event.target !== document) {
        return;
      }
      const err = event.error;
      const msg = err instanceof Error ? err.message : event.message || (err ? String(err) : 'Unknown error');
      setFatalError(msg);
    };

    const onUnhandledRejection = (event) => {
      setFatalError(formatReason(event.reason));
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  if (fatalError) {
    return (
      <FatalErrorFallback
        title="Unexpected error"
        message={fatalError}
        onReload={() => window.location.reload()}
        onTryAgain={() => setFatalError(null)}
        tryAgainLabel="Dismiss"
      />
    );
  }

  return (
    <ErrorBoundary>
      {children}
      <ImageUploadOverlay />
    </ErrorBoundary>
  );
}
