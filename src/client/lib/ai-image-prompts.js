/** Match battle map size bounds in BattleMap.jsx */
const BATTLE_MAP_SIZE_FT_MIN = 1;
const BATTLE_MAP_SIZE_FT_MAX = 3000;

/**
 * Default battle-map AI prompt; `mapSizeFt` substitutes the example 300'x300' extent.
 * @param {number|string|undefined} mapSizeFt
 */
export function buildBattleMapDefaultPrompt(mapSizeFt) {
  const n = Math.max(
    BATTLE_MAP_SIZE_FT_MIN,
    Math.min(BATTLE_MAP_SIZE_FT_MAX, Number(mapSizeFt) || 100),
  );
  return `orthographic top-down view, ${n}'x${n}', complex cave filled with stalactites, stalagmites and a narrow running stream feeding into a bottomless pit.`;
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
    const { mapSizeFt } = formData || {};
    return buildBattleMapDefaultPrompt(mapSizeFt);

  } else {
    const { name } = formData || {};
    lines.push(`A dark fantasy TTRPG adventure setting: ${stripMd(name) || 'an epic quest'}.`);
  }

  return lines.join('\n').trim();
}
