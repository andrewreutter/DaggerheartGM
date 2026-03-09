import { useState, useEffect } from 'react';

/**
 * Returns true when the primary pointing device is coarse (touch/stylus).
 * Updates reactively if the device switches input mode (e.g. iPad + keyboard).
 */
export function useTouchDevice() {
  const [isTouch, setIsTouch] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsTouch(mq.matches);
    const handler = (e) => setIsTouch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isTouch;
}
