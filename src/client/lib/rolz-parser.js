import { generateId } from './helpers.js';
import { RANGES } from './constants.js';

export function parseRolzMarkdown(text) {
  const lines = text.split('\n');

  const stripBB = (s) => s.replace(/\[\/?\w+[^\]]*\]/g, '').trim();

  const imgMatch = text.match(/\[img\s+(https?:\/\/[^\]]+)\]/);
  const imageUrl = imgMatch ? imgMatch[1].trim() : null;

  let sceneName = '';
  for (const line of lines) {
    const m = line.match(/^=(?!=)\s*(.+)/);
    if (m) {
      sceneName = m[1].replace(/\s+\d+\s+BP\s*$/i, '').trim();
      break;
    }
  }

  const sectionBlocks = [];
  let current = null;
  for (const line of lines) {
    if (/^==(?!=)/.test(line)) {
      if (current) sectionBlocks.push(current);
      current = { header: line.replace(/^==\s*/, '').trim(), bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    }
  }
  if (current) sectionBlocks.push(current);

  const environments = [];
  const adversaries = [];

  for (const section of sectionBlocks) {
    const body = section.bodyLines.join('\n');
    const isAdversary = /\[const\s+HP\b/i.test(body);

    if (!isAdversary) {
      const name = section.header;
      const featuresMarkerIdx = body.search(/\[b\]FEATURES\[\/b\]/i);
      const descBlock = featuresMarkerIdx >= 0 ? body.slice(0, featuresMarkerIdx) : body;
      const description = descBlock.split('\n')
        .map(l => stripBB(l))
        .filter(l => l.length > 0)
        .join('\n')
        .trim();

      const features = featuresMarkerIdx >= 0
        ? parseFeatures(body.slice(featuresMarkerIdx))
        : [];

      environments.push({ name, description, features, tier: 1, type: 'event' });
    } else {
      const countMatch = section.header.match(/^(.+?)\s+x(\d+)\s*$/i);
      const advName = countMatch ? countMatch[1].trim() : section.header;
      const count = countMatch ? parseInt(countMatch[2]) : 1;

      const motivesIdx = body.search(/\[b\]Motives/i);
      const hrIdx = body.search(/\[hr\]/i);
      const descEnd = motivesIdx >= 0 ? motivesIdx : (hrIdx >= 0 ? hrIdx : 0);
      const description = body.slice(0, descEnd).split('\n')
        .map(l => stripBB(l))
        .filter(l => l.length > 0)
        .join('\n')
        .trim();

      let motive = '';
      const motiveMatch = body.match(/\[b\]Motives[^[]*\[\/b\]\s*(.*?)(?:\[hr\]|\[b\]FEATURES|\[button|$)/is);
      if (motiveMatch) motive = stripBB(motiveMatch[1]).trim();

      const diffMatch = body.match(/\[const\s+DIFFICULTY\s+(\d+)\]/i);
      const hpMatch = body.match(/\[const\s+HP\s+(\d+)\]/i);
      const stressMatch = body.match(/\[const\s+STRESS\s+(\d+)\]/i);
      const threshMatch = body.match(/\[const\s+THRESHOLDS\s+(\d+)\s*\/\s*(\d+)\]/i);

      const difficulty = diffMatch ? parseInt(diffMatch[1]) : 10;
      const hp_max = hpMatch ? parseInt(hpMatch[1]) : 6;
      const stress_max = stressMatch ? parseInt(stressMatch[1]) : 3;
      const hp_thresholds = threshMatch
        ? { major: parseInt(threshMatch[1]), severe: parseInt(threshMatch[2]) }
        : { major: 3, severe: 6 };

      const experiences = [];
      const expMatch = body.match(/\[b\]Experiences\[\/b\]\s*:?\s*([^\n\[]+)/i);
      if (expMatch) {
        const expStr = expMatch[1].trim();
        const expParts = expStr.split(',').map(s => s.trim()).filter(Boolean);
        for (const part of expParts) {
          const em = part.match(/^(.+?)\s*\+(\d+)$/);
          if (em) experiences.push({ id: generateId(), name: em[1].trim(), modifier: parseInt(em[2]) });
        }
      }

      const buttonRe = /\[button\s+(.+?)\s+\{d20([+-]\d+)\},\s*\{([^}]+)\}\]\s*([^\n\[]*)/gi;
      const buttonMatches = [...body.matchAll(buttonRe)];

      let attack = { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' };
      const extraAttackFeatures = [];

      for (let i = 0; i < buttonMatches.length; i++) {
        const bm = buttonMatches[i];
        const atkName = bm[1].trim();
        const mod = parseInt(bm[2]);
        const dtParts = bm[3].trim().split(/\s+/);
        const damage = dtParts[0] || '';
        const rawTrait = dtParts[1] || 'phy';
        const trait = rawTrait.charAt(0).toUpperCase() + rawTrait.slice(1).toLowerCase();
        const traitNorm = ['Mag', 'Dir'].includes(trait) ? trait : 'Phy';
        const rangeRaw = bm[4].trim();
        const rangeNorm = RANGES.find(r => r.toLowerCase() === rangeRaw.toLowerCase()) || 'Melee';

        if (i === 0) {
          attack = { name: atkName, range: rangeNorm, modifier: mod, trait: traitNorm, damage };
        } else {
          extraAttackFeatures.push({
            id: generateId(),
            name: atkName,
            type: 'action',
            description: `${mod >= 0 ? '+' : ''}${mod} ${rangeNorm} | ${damage} ${traitNorm.toLowerCase()}`
          });
        }
      }

      const featuresMarkerIdx = body.search(/\[b\]FEATURES\[\/b\]/i);
      const parsedFeatures = featuresMarkerIdx >= 0
        ? parseFeatures(body.slice(featuresMarkerIdx))
        : [];

      const features = [...extraAttackFeatures, ...parsedFeatures];

      adversaries.push({
        name: advName,
        count,
        description,
        motive,
        difficulty,
        hp_max,
        stress_max,
        hp_thresholds,
        attack,
        experiences,
        features,
        tier: 1,
        role: 'bruiser'
      });
    }
  }

  return { sceneName, imageUrl, environments, adversaries };
}

export function parseFeatures(block) {
  const features = [];
  const parts = block.split(/\[b\]/);
  for (const part of parts) {
    if (!part.trim() || /^FEATURES/i.test(part.trim())) continue;
    const closeIdx = part.indexOf('[/b]');
    if (closeIdx < 0) continue;
    const header = part.slice(0, closeIdx).trim();
    const descRaw = part.slice(closeIdx + 4).trim();
    const descClean = descRaw.replace(/^[:.]?\s*/, '');

    let featureName = header;
    let featureType = 'action';

    const typeMatch = header.match(/^(.+?)\s+-\s+(Passive|Action|Reaction)(?:\s*:\s*(.+))?$/i);
    if (typeMatch) {
      featureName = typeMatch[1].trim();
      featureType = typeMatch[2].toLowerCase();
      const inlineCost = typeMatch[3];
      const description = inlineCost
        ? `${inlineCost.trim()} ${stripAllBB(descClean)}`.trim()
        : stripAllBB(descClean);
      if (featureName && description) {
        features.push({ id: generateId(), name: featureName, type: featureType, description });
      }
      continue;
    }

    const isFear = /spend\s+\w+\s+fear/i.test(header) || /spend\s+\w+\s+fear/i.test(descClean);
    if (isFear) featureType = 'action';

    const cleanName = stripAllBB(header).trim();
    if (cleanName) {
      features.push({ id: generateId(), name: cleanName, type: featureType, description: stripAllBB(descClean) });
    }
  }

  return features.filter(f => f.name && f.name.length > 0);
}

export function stripAllBB(s) {
  return s.replace(/\[\/?\w+[^\]]*\]/g, '').trim();
}
