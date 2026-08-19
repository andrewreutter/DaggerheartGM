import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { subscribeImageUploadBusy } from '../lib/image-upload-busy.js';

/**
 * Full-viewport spinner while a user image is being read or uploaded to Storage.
 * Mounted once from {@link AppRoot} so it covers editors, the Game Table, and import.
 */
export function ImageUploadOverlay() {
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeImageUploadBusy(setBusy), []);

  if (!busy || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/45"
      role="status"
      aria-live="polite"
      aria-label="Uploading image"
    >
      <Loader2 size={48} className="animate-spin text-sky-300 drop-shadow" aria-hidden />
    </div>,
    document.body,
  );
}
