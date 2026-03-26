/**
 * Coerce SRD/library `attack` shapes for read-only weapon-style display in ItemDetailModal.
 *
 * @returns {{ kind: 'structured', name: string, modifier: number, range: string, damage: string, trait: string } | { kind: 'text', text: string } | null}
 */
export function coerceLibraryAttack(attack) {
  if (attack == null) return null;
  if (typeof attack === 'string') {
    const t = attack.trim();
    return t ? { kind: 'text', text: t } : null;
  }
  if (typeof attack === 'object') {
    const name = attack.name;
    if (typeof name === 'string' && name.trim()) {
      return {
        kind: 'structured',
        name: name.trim(),
        modifier: Number(attack.modifier) || 0,
        range: typeof attack.range === 'string' && attack.range.trim() ? attack.range.trim() : 'Melee',
        damage: attack.damage != null ? String(attack.damage) : '',
        trait: attack.trait != null ? String(attack.trait) : '',
      };
    }
  }
  return null;
}
