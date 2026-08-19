import { useCallback, useEffect, useState } from 'react';
import { appBuildId, fetchAppConfigBuildId } from './api.js';
import {
  APP_BUILD_CHECK_EVENT,
  DISMISSED_BUILD_ID_STORAGE_KEY,
  shouldShowNewVersionBanner,
} from './app-build-check.js';

function readDismissedBuildId() {
  try {
    return sessionStorage.getItem(DISMISSED_BUILD_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeDismissedBuildId(id) {
  try {
    sessionStorage.setItem(DISMISSED_BUILD_ID_STORAGE_KEY, id);
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * Re-checks GET /api/config when the tab becomes visible or an SSE
 * connection opens (Game Table / home lobby reconnect after deploy).
 * Never auto-reloads — the Game Table keeps local UI until the user clicks Reload.
 */
export function useAppBuildCheck() {
  const [showNewVersion, setShowNewVersion] = useState(false);

  const check = useCallback(async () => {
    const serverBuildId = await fetchAppConfigBuildId();
    setShowNewVersion(shouldShowNewVersionBanner({
      currentBuildId: appBuildId,
      serverBuildId,
      dismissedBuildId: readDismissedBuildId(),
    }));
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    window.addEventListener(APP_BUILD_CHECK_EVENT, check);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(APP_BUILD_CHECK_EVENT, check);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [check]);

  const dismissNewVersion = useCallback(async () => {
    const serverBuildId = await fetchAppConfigBuildId();
    if (serverBuildId) writeDismissedBuildId(serverBuildId);
    setShowNewVersion(false);
  }, []);

  const reloadToNewVersion = useCallback(() => {
    window.location.reload();
  }, []);

  return { showNewVersion, reloadToNewVersion, dismissNewVersion };
}
