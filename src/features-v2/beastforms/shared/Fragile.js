/**
 * Shared **Fragile** rules text (same name on every stat block that includes it).
 * SRD `id` / `type` are applied in `marryBeastformFeatures` via name match.
 *
 * **`dropBeastformOnMajorOrGreaterDamage`** — declarative VTT hook: merged `activeFeatures` rows
 * expose this while the form is active; Game Table damage uses it (not name matching).
 */
export const Fragile = {
  name: 'Fragile',
  description:
    'When you take Major or greater damage, you drop out of Beastform.',
  /** When true, Major+ HP loss (≥2) forces beastform exit — read from merged sheet rows only. */
  dropBeastformOnMajorOrGreaterDamage: true,
};
