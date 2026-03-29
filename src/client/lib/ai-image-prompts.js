import { getMapDimensionsFt } from './map-dimensions-ft.js';

/**
 * Default battle-map AI prompt; map footprint uses the same width×height math as the map toolbar
 * (W/H widget + image aspect when an image is present).
 * @param {number|string|undefined|object} mapSizeFtOrConfig — legacy: single foot span → square map; or a partial `mapConfig` (`mapSizeFt`, `mapDimension`, `mapImageNaturalWidth`, `mapImageNaturalHeight`).
 */
export function buildBattleMapDefaultPrompt(mapSizeFtOrConfig) {
  const { mapWidthFt, mapHeightFt } =
    mapSizeFtOrConfig != null && typeof mapSizeFtOrConfig === 'object'
      ? getMapDimensionsFt(mapSizeFtOrConfig)
      : getMapDimensionsFt({ mapSizeFt: mapSizeFtOrConfig });
  const w = Math.round(mapWidthFt);
  const h = Math.round(mapHeightFt);
  return `orthographic top-down view, ${w}'x${h}', complex cave filled with stalactites, stalagmites and a narrow running stream feeding into a bottomless pit.`;
}

/** Strip markdown syntax characters that clutter image prompts. */
export function stripMd(text) {
  return (text || '').replace(/[*_`#>~\[\]]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Build a text-to-image prompt from item flavor text, tailored per collection type.
 * Structure: subject line, then user description, then labeled game-data segments.
 *
 * @param {object} formData
 * @param {'adversaries' | 'environments' | 'scenes' | 'adventures' | 'battleMap'} collection
 */
export function buildImagePrompt(formData, collection) {
  const lines = [];

  if (collection === 'adversaries') {
    const { name, tier, role, description, motive, attack, experiences, features } = formData || {};
    const tierStr = tier ? `tier ${tier} of 4` : null;
    const roleLine = [tierStr, role].filter(Boolean).join(' ');
    lines.push(`A dark fantasy TTRPG illustration of ${stripMd(name) || 'a creature'}${roleLine ? `, a ${roleLine}` : ''}.`);

    if (description?.trim()) lines.push('', stripMd(description));

    if (motive?.trim()) lines.push('', `Motives & Tactics: ${stripMd(motive)}`);

    if (attack?.name?.trim()) lines.push('', `Attack: ${stripMd(attack.name)}`);

    const expNames = (experiences || []).map(e => stripMd(e.name)).filter(Boolean);
    if (expNames.length) lines.push('', `Experiences: ${expNames.join(', ')}`);

    const featParts = (features || []).map(f => {
      const n = stripMd(f.name);
      const desc = stripMd(f.description);
      return [n, desc].filter(Boolean).join(' — ');
    }).filter(Boolean);
    if (featParts.length) lines.push('', `Features: ${featParts.join(' | ')}`);

  } else if (collection === 'environments') {
    const { name, description, impulses, potential_adversaries, features } = formData || {};
    lines.push(`A dark fantasy TTRPG landscape: ${stripMd(name) || 'a mysterious place'}.`);

    if (description?.trim()) lines.push('', stripMd(description));

    if (impulses?.trim()) lines.push('', `Impulses: ${stripMd(impulses)}`);

    const advNames = (potential_adversaries || []).map(a => stripMd(a.name)).filter(Boolean);
    if (advNames.length) lines.push('', `Potential Adversaries: ${advNames.join(', ')}`);

    const featParts = (features || []).map(f => {
      const n = stripMd(f.name);
      const desc = stripMd(f.description);
      return [n, desc].filter(Boolean).join(' — ');
    }).filter(Boolean);
    if (featParts.length) lines.push('', `Features: ${featParts.join(' | ')}`);

  } else if (collection === 'scenes') {
    const { name, description } = formData || {};
    lines.push(`A dark fantasy TTRPG scene: ${stripMd(name) || 'an encounter'}.`);
    if (description?.trim()) lines.push('', stripMd(description));

  } else if (collection === 'battleMap') {
    return buildBattleMapDefaultPrompt(formData || {});

  } else {
    const { name } = formData || {};
    lines.push(`A dark fantasy TTRPG adventure setting: ${stripMd(name) || 'an epic quest'}.`);
  }

  return lines.join('\n').trim();
}
