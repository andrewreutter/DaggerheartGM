const ATTACK_DESC_RE = /^([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*([^\s]+)\s+(\w+)$/i;

function generatePrefixes(advEntries) {
  const FILLER = { of: 1, the: 1, a: 1, an: 1, and: 1, in: 1, at: 1, by: 1, for: 1, to: 1 };

  const sigWords = (name) => {
    const words = name.trim().split(/\s+/).filter(w => !FILLER[w.toLowerCase()]);
    return words.length > 0 ? words : name.trim().split(/\s+/);
  };

  const makePrefix = (words, exp) =>
    words.map((w, i) => w.slice(0, exp[i]).toUpperCase()).join('');

  const prefixCandidates = (words) => {
    const candidates = [];
    const exp = words.map(() => 1);
    candidates.push(makePrefix(words, exp.slice()));
    let advanced = true;
    while (advanced) {
      advanced = false;
      for (let i = 0; i < words.length; i++) {
        if (exp[i] < words[i].length) {
          exp[i]++;
          advanced = true;
          candidates.push(makePrefix(words, exp.slice()));
          break;
        }
      }
    }
    const base = makePrefix(words, exp);
    for (let n = 2; n <= 30; n++) candidates.push(base + n);
    return candidates;
  };

  const seen = {};
  const unique = [];
  for (let i = 0; i < advEntries.length; i++) {
    const e = advEntries[i];
    if (!seen[e.id]) { seen[e.id] = true; unique.push(e); }
  }
  unique.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

  const used = {};
  const result = {};

  for (let i = 0; i < unique.length; i++) {
    const entry = unique[i];
    const candidates = prefixCandidates(sigWords(entry.name));
    let prefix = null;
    for (let j = 0; j < candidates.length; j++) {
      if (!used[candidates[j]]) { prefix = candidates[j]; break; }
    }
    if (!prefix) prefix = 'A' + (i + 1);
    used[prefix] = true;
    result[entry.id] = prefix;
  }

  return result;
}

function featureToRolzLine(f) {
  const m = f.description && ATTACK_DESC_RE.exec(f.description);
  if (m && f.type === 'action') {
    const mod = parseInt(m[1]);
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    return `[button ${f.name} {d20${modStr}}, {${m[3]} ${m[4].toLowerCase()}}] ${m[2]}`;
  }
  const typeCap = f.type ? f.type.charAt(0).toUpperCase() + f.type.slice(1) : 'Action';
  return `[b]${f.name} - ${typeCap}[/b]: ${f.description || ''}`;
}

function adversaryToRolz(adv, count, prefix) {
  count = count || 1;
  const lines = [];

  lines.push(count > 1 ? `==${adv.name} x${count}` : `==${adv.name}`);
  if (adv.description) lines.push(adv.description);
  if (adv.motive) lines.push(`[b]Motives & Tactics:[/b] ${adv.motive}`);

  lines.push('[hr]');
  lines.push(`[const DIFFICULTY ${adv.difficulty || 10}] [const THRESHOLDS ${adv.hp_thresholds?.major || 0} / ${adv.hp_thresholds?.severe || 0}]`);

  if (count === 1) {
    lines.push(`[field ${prefix}_HP] of [const HP ${adv.hp_max || 0}] [field ${prefix}_STRESS] of [const STRESS ${adv.stress_max || 0}]`);
  } else {
    lines.push(Array.from({ length: count }, (_, i) => `[field ${prefix}${i + 1}_HP]`).join('') + ` of [const HP ${adv.hp_max || 0}]`);
    lines.push(Array.from({ length: count }, (_, i) => `[field ${prefix}${i + 1}_STRESS]`).join('') + ` of [const STRESS ${adv.stress_max || 0}]`);
  }

  if (adv.attack?.name) {
    const mod = adv.attack.modifier || 0;
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    const trait = (adv.attack.trait || 'phy').toLowerCase();
    lines.push(`[button ${adv.attack.name} {d20${modStr}}, {${adv.attack.damage} ${trait}}] ${adv.attack.range || 'Melee'}`);
  }

  if (adv.experiences?.length > 0) {
    lines.push(`[b]Experiences[/b]: ${adv.experiences.map(e => `${e.name} +${e.modifier}`).join(', ')}`);
  }

  if (adv.features?.length > 0) {
    lines.push('[hr]');
    lines.push('[b]FEATURES[/b]');
    for (const f of adv.features) lines.push(featureToRolzLine(f));
  }

  return lines.join('\n');
}

function environmentToRolz(env) {
  const lines = [];
  lines.push(`==${env.name}`);
  if (env.description) lines.push(env.description);
  if (env.features?.length > 0) {
    lines.push('[b]FEATURES[/b]');
    for (const f of env.features) lines.push(featureToRolzLine(f));
  }
  return lines.join('\n');
}

export function generateRolzExport(item, tab, data) {
  const sections = ['[type note]'];

  if (tab === 'adversaries') {
    const prefix = generatePrefixes([{ id: item.id, name: item.name }])[item.id];
    sections.push(adversaryToRolz(item, 1, prefix));

  } else if (tab === 'environments') {
    sections.push(environmentToRolz(item));

  } else if (tab === 'groups') {
    const advRefObj = {};
    const advRefOrder = [];
    for (let ri = 0; ri < (item.adversaries || []).length; ri++) {
      const ref = item.adversaries[ri];
      const adv = (data.adversaries || []).filter(a => a.id === ref.adversaryId)[0];
      if (!adv) continue;
      if (advRefObj[adv.id]) { advRefObj[adv.id].count += ref.count || 1; }
      else { advRefObj[adv.id] = { adv: adv, count: ref.count || 1 }; advRefOrder.push(adv.id); }
    }
    const groupAdvEntries = advRefOrder.map(id => ({ id: id, name: advRefObj[id].adv.name }));
    const prefixes = generatePrefixes(groupAdvEntries);
    for (let ri = 0; ri < advRefOrder.length; ri++) {
      const entry = advRefObj[advRefOrder[ri]];
      sections.push(adversaryToRolz(entry.adv, entry.count, prefixes[entry.adv.id]));
    }

  } else if (tab === 'scenes') {
    sections.push('=' + item.name);
    if (item.imageUrl) sections.push('[img ' + item.imageUrl + ']');

    for (let ei = 0; ei < (item.environments || []).length; ei++) {
      const env = (data.environments || []).filter(e => e.id === item.environments[ei])[0];
      if (env) sections.push(environmentToRolz(env));
    }

    const advRefObj = {};
    const advRefOrder = [];
    for (let gi = 0; gi < (item.groups || []).length; gi++) {
      const group = (data.groups || []).filter(g => g.id === item.groups[gi])[0];
      if (!group) continue;
      for (let ri = 0; ri < (group.adversaries || []).length; ri++) {
        const ref = group.adversaries[ri];
        const adv = (data.adversaries || []).filter(a => a.id === ref.adversaryId)[0];
        if (!adv) continue;
        if (advRefObj[adv.id]) { advRefObj[adv.id].count += ref.count || 1; }
        else { advRefObj[adv.id] = { adv: adv, count: ref.count || 1 }; advRefOrder.push(adv.id); }
      }
    }
    for (let ri = 0; ri < (item.adversaries || []).length; ri++) {
      const ref = item.adversaries[ri];
      const adv = (data.adversaries || []).filter(a => a.id === ref.adversaryId)[0];
      if (!adv) continue;
      if (advRefObj[adv.id]) { advRefObj[adv.id].count += ref.count || 1; }
      else { advRefObj[adv.id] = { adv: adv, count: ref.count || 1 }; advRefOrder.push(adv.id); }
    }

    const sceneAdvEntries = advRefOrder.map(id => ({ id: id, name: advRefObj[id].adv.name }));
    const prefixes = generatePrefixes(sceneAdvEntries);
    for (let ri = 0; ri < advRefOrder.length; ri++) {
      const entry = advRefObj[advRefOrder[ri]];
      sections.push(adversaryToRolz(entry.adv, entry.count, prefixes[entry.adv.id]));
    }
  }

  return sections.join('\n\n');
}
