/** Fallback pin rect when + Add / deep-link has no card to measure. */
export const ENCOUNTER_OVERLAY_FALLBACK_RECT = { top: 140, bottom: 280 };

export function encounterOverlayRectFromTarget(el) {
  if (!el?.getBoundingClientRect) return { ...ENCOUNTER_OVERLAY_FALLBACK_RECT };
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom };
}

/** Stop click-mode overlay toggle + outside-dismiss when using card chrome. */
export function stopEncounterOverlayFromInteractive(e) {
  e.stopPropagation();
}
