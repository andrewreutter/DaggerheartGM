/** Label for Spellcast trait on action-loop prompts (matches Arcana/CinderGrasp pattern). */
export function spellcastTraitLabel(table) {
  const key = table.me?.spellcastTrait;
  if (!key || typeof key !== 'string') return 'Presence';
  return key.charAt(0).toUpperCase() + key.slice(1);
}
