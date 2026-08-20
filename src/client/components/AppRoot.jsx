import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { FatalErrorFallback } from './FatalErrorFallback.jsx';
import { ImageUploadOverlay } from './ImageUploadOverlay.jsx';
import { formatUnhandledRejectionReason, isCrossOriginScriptErrorEvent } from '../lib/fatal-window-error.js';

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
      if (isCrossOriginScriptErrorEvent(event)) {
        console.error('Ignored cross-origin window error (Script error.)');
        return;
      }
      const err = event.error;
      const msg = err instanceof Error ? err.message : event.message || (err ? String(err) : 'Unknown error');
      setFatalError(msg);
    };

    const onUnhandledRejection = (event) => {
      const msg = formatUnhandledRejectionReason(event.reason);
      if (msg === 'Script error.') {
        console.error('Ignored cross-origin unhandled rejection (Script error.)');
        return;
      }
      setFatalError(msg);
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
