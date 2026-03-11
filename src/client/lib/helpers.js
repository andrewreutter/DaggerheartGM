export const generateId = () => crypto.randomUUID();

// Returns the initial countdown value from feature description text like "Fear Countdown (8)", or null if none.
export const parseCountdownValue = (text) => {
  if (!text) return null;
  const match = text.match(/\bCountdown\s*\((\d+)\)/i);
  return match ? parseInt(match[1], 10) : null;
};

// Returns all countdown occurrences in text: array of { value, label, index, length }.
// label is the word immediately before "Countdown" (e.g. "Progress"), or "Countdown" if none.
export const parseAllCountdownValues = (text) => {
  if (!text) return [];
  const re = /(?:(\w+)\s+)?Countdown\s*\((\d+)\)/gi;
  const results = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    results.push({
      value: parseInt(m[2], 10),
      label: m[1] ? `${m[1]} Countdown` : 'Countdown',
      index: m.index,
      length: m[0].length,
    });
  }
  return results;
};

export const parseFeatureCategory = (feature) => {
  if (!feature.description) return 'Actions';
  const desc = feature.description;
  if (/spend.*fear/i.test(desc) || /mark.*fear/i.test(desc)) return 'Fear Actions';
  if (feature.type === 'reaction') return 'Reactions';
  if (feature.type === 'passive') return 'Passives';
  return 'Actions';
};

export const hideImgOnError = (e) => { e.target.parentElement.style.display = 'none'; };

/**
 * Returns a character's effective damage thresholds with their level added to each value.
 * Per Daggerheart rules, characters add their level to their armor's base thresholds.
 * Returns null if the character has no armorThresholds.
 */
export const effectiveThresholds = (el) => {
  if (!el?.armorThresholds) return null;
  const level = el.level ?? 0;
  const reinforced = el.reinforcedActive ? 2 : 0;
  return {
    major: el.armorThresholds.major + level + reinforced,
    severe: el.armorThresholds.severe + level + reinforced,
  };
};

export const stripHtml = (raw) => {
  if (!raw || !/<[a-z][\s\S]*>/i.test(raw)) return raw || '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
