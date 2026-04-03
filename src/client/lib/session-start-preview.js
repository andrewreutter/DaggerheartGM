/**
 * Preview copy for the Start Session action banner. Logic must stay aligned with
 * {@link runSessionStartClear} in GMTableView.jsx (V2 hooks + legacy onSessionStart).
 *
 * @param {object[]} activeElements — table character elements (+ others allowed; filtered internally)
 * @param {object} opts
 * @param {object | null} opts.v2Registry
 * @param {object | null} opts.srdData
 * @param {Record<string, object>} opts.v2ClassSubclassFeatureDescriptorsByName
 * @param {(name: string) => object | undefined} opts.getV2OriginFeatureDescriptor
 * @returns {string} markdown for `actionText`
 */
export function buildSessionStartBannerActionText(activeElements, opts) {
  const {
    v2Registry,
    srdData,
    v2ClassSubclassFeatureDescriptorsByName,
    getV2OriginFeatureDescriptor,
  } = opts;

  const hookLabels = collectSessionStartHookLabels(activeElements, {
    v2Registry,
    srdData,
    v2ClassSubclassFeatureDescriptorsByName,
    getV2OriginFeatureDescriptor,
  });

  const intro = [
    '**Nothing changes on the table until you press Acknowledge.** After you do, the app will:',
    '',
    '- Reset **session-frequency** feature uses',
    '- Clear **session-refresh** modifiers (e.g. Rally die tokens)',
    '- Refresh **Rally** pooled dice on the table',
  ].join('\n');

  const hooksBlock = hookLabels.length
    ? ['', '**Then run session-start effects on these character features:**', ...hookLabels.map((l) => `- ${l}`)].join('\n')
    : ['', '*No character session-start hooks detected on the table.*'].join('\n');

  return intro + hooksBlock;
}

/**
 * @param {object[]} activeElements
 * @param {object} opts
 * @returns {string[]} stable sorted labels (feature names, or "Character — Feature")
 */
export function collectSessionStartHookLabels(activeElements, opts) {
  const {
    v2Registry,
    srdData,
    v2ClassSubclassFeatureDescriptorsByName,
    getV2OriginFeatureDescriptor,
  } = opts;

  const charactersList = (activeElements || []).filter((e) => e.elementType === 'character');
  const labels = [];

  const resolveV2SessionStartDescriptor = (f) => {
    if (typeof f.onSessionStart === 'function') return null;
    const desc = v2ClassSubclassFeatureDescriptorsByName[f.name] || getV2OriginFeatureDescriptor(f.name);
    const hook = f.hooks?.onSessionStart ?? desc?.hooks?.onSessionStart;
    if (typeof hook !== 'function') return null;
    const sessionStartOnce = desc?.sessionStartOnce === true;
    return { name: f.name, sessionStartOnce };
  };

  if (v2Registry && srdData) {
    const onceDone = new Set();
    for (const char of charactersList) {
      for (const f of char.activeFeatures || []) {
        const t = f.type;
        if (t !== 'ancestry' && t !== 'community' && t !== 'class' && t !== 'subclass') continue;
        const r = resolveV2SessionStartDescriptor(f);
        if (!r || !r.sessionStartOnce) continue;
        if (onceDone.has(r.name)) continue;
        onceDone.add(r.name);
        labels.push(r.name);
      }
    }
    for (const char of charactersList) {
      const cname = char.name?.trim() || 'Character';
      for (const f of char.activeFeatures || []) {
        const t = f.type;
        if (t !== 'ancestry' && t !== 'community' && t !== 'class' && t !== 'subclass') continue;
        const r = resolveV2SessionStartDescriptor(f);
        if (!r || r.sessionStartOnce) continue;
        labels.push(`${cname} — ${f.name}`);
      }
    }
  }

  const sessionByName = new Map();
  for (const char of charactersList) {
    for (const f of char.activeFeatures || []) {
      if (typeof f.onSessionStart !== 'function') continue;
      if (typeof f.hooks?.onSessionStart === 'function') continue;
      const t = f.type;
      if (t !== 'ancestry' && t !== 'community' && t !== 'class' && t !== 'subclass') continue;
      if (!sessionByName.has(f.name)) sessionByName.set(f.name, f);
    }
  }
  for (const [, descriptor] of sessionByName) {
    if (descriptor.sessionStartOnce) {
      labels.push(descriptor.name);
    } else {
      for (const char of charactersList) {
        const has = (char.activeFeatures || []).some(
          (af) =>
            af.name === descriptor.name &&
            typeof af.onSessionStart === 'function' &&
            typeof af.hooks?.onSessionStart !== 'function'
        );
        if (has) {
          const cname = char.name?.trim() || 'Character';
          labels.push(`${cname} — ${descriptor.name}`);
        }
      }
    }
  }

  const uniq = [...new Set(labels)];
  uniq.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return uniq;
}
