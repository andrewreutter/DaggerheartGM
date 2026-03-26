import { RefreshCw } from 'lucide-react';

/**
 * Single-word label for a feature / chip reset cycle (session, long, short, rest).
 * @param {string|null|undefined} freq
 * @returns {'session'|'long'|'short'|'rest'|null}
 */
export function getFrequencyCycleWord(freq) {
  if (freq == null || freq === '') return null;
  if (freq === 'session') return 'session';
  if (freq === 'longRest') return 'long';
  if (freq === 'shortRest') return 'short';
  if (freq === 'rest') return 'rest';
  return null;
}

/**
 * Refresh icon + lowercase cycle word — place after resource-cost icons when present.
 * @param {{ frequency: string, iconSize?: number, className?: string }} props
 */
export function FrequencyCycleChipSuffix({ frequency, iconSize = 9, className = '' }) {
  const word = getFrequencyCycleWord(frequency);
  if (!word) return null;
  const aria = `Resets on ${word}`;
  return (
    <span
      className={`inline-flex items-center gap-0.5 shrink-0 text-dh-muted ${className}`}
      title={aria}
      aria-label={aria}
    >
      <RefreshCw size={iconSize} className="shrink-0 opacity-90" aria-hidden />
      <span className="text-[9px] lowercase">{word}</span>
    </span>
  );
}
