/**
 * Markdown text for Beastform picker tooltips (Druid class feature + Game Table dropdown).
 * Pure — safe to import from `classes/Druid.js`.
 */

/**
 * @param {object} row — full beastform registry row (`table.registry.beastforms[id]`)
 * @returns {string}
 */
export function beastformRowToTooltipMarkdown(row) {
  if (!row || typeof row !== 'object') return '';
  const lines = [];
  lines.push(`**Tier ${row.tier ?? '?'}**${row.examples ? ` ${row.examples}` : ''}`);
  lines.push('');
  lines.push(`- **Attack:** ${row.attack || '—'}`);
  lines.push(`- **Trait bonus:** ${row.trait_bonus || '—'}`);
  lines.push(`- **Evasion bonus:** ${row.evasion_bonus || '—'}`);
  if (row.advantages) {
    lines.push(`- **Advantages:** ${row.advantages}`);
  }
  const feats = row.features;
  if (Array.isArray(feats) && feats.length) {
    lines.push('');
    lines.push('#### Form features');
    for (const f of feats) {
      const title = f.name || 'Feature';
      const body = (f.description || '').trim();
      lines.push(`- **${title}**${body ? ` — ${body}` : ''}`);
    }
  }
  return lines.join('\n');
}
