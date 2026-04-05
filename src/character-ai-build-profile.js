import {
  ADVANCEMENT_BAND_LABELS,
  SLOT_BUDGET_PER_BAND,
  advancementLevelToBand,
  advancementTypesAvailableForLevelRow,
  expectedExperienceRowCount,
  maxSelectableDomainCardLevelForRow,
} from './client/lib/advancement-rules.js';
import { CHARACTER_AI_EXPERIENCE_EXAMPLES } from './character-ai-experience-examples.js';
import { normalizeLookupKey } from './character-ai-resolve.js';

const DESC_MAX = 80;

function truncDesc(text) {
  if (text == null) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  if (s.length <= DESC_MAX) return s;
  return `${s.slice(0, DESC_MAX - 1)}…`;
}

function mapFeatureSummary(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type || 'passive',
    description: truncDesc(row.description),
  };
}

function mapFeatureDetails(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type || 'passive',
    description: typeof row.description === 'string' ? row.description : '',
  };
}

function uniqueById(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function groupAbilityRowsByDomainAndLevel(rows) {
  const byDomain = new Map();
  for (const row of uniqueById(rows)) {
    const domain = String(row.domain || '').trim();
    const level = Math.max(1, Number(row.level) || 1);
    if (!domain) continue;
    if (!byDomain.has(domain)) byDomain.set(domain, new Map());
    const byLevel = byDomain.get(domain);
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push({
      id: row.id,
      name: row.name,
      domain,
      level,
      description: truncDesc(row.description),
    });
  }

  return [...byDomain.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([domain, levels]) => ({
      domain,
      levels: [...levels.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([level, cards]) => ({
          level,
          cards: cards.sort((a, b) => a.name.localeCompare(b.name)),
        })),
    }));
}

function classSubclassRows(classRow, srdData) {
  const wanted = new Set((classRow?.subclasses || []).map((name) => normalizeLookupKey(name)));
  return (srdData.subclasses || []).filter((row) => wanted.has(normalizeLookupKey(row.name)));
}

function resolveSubclassForClass(classRow, rawSubclassId, srdData) {
  if (!classRow || !rawSubclassId) return null;
  const subclasses = classSubclassRows(classRow, srdData);
  const exactId = subclasses.find((row) => row.id === rawSubclassId);
  if (exactId) return exactId;
  const match = subclasses.find((row) => normalizeLookupKey(row.name) === normalizeLookupKey(rawSubclassId));
  return match || null;
}

function featureNameList(rows) {
  return (rows || []).map((row) => row?.name).filter(Boolean);
}

function mapSubclassSummary(row) {
  return {
    id: row.id,
    name: row.name,
    description: truncDesc(row.description),
    spellcastTrait: row.spellcast_trait || null,
    featureNames: [
      ...featureNameList(row.foundation_features),
      ...featureNameList(row.specialization_features),
      ...featureNameList(row.mastery_features),
    ],
  };
}

function mapCompactClassRow(classRow, srdData) {
  const subclasses = classSubclassRows(classRow, srdData).map(mapSubclassSummary);
  return {
    id: classRow.id,
    name: classRow.name,
    description: truncDesc(classRow.description),
    domains: classRow.domains || [],
    suggestedTraits: classRow.suggested_traits || '',
    startingHp: classRow.starting_hp ?? null,
    startingEvasion: classRow.starting_evasion ?? null,
    hopeFeature: classRow.hope_feature?.name || null,
    classFeatureNames: featureNameList(classRow.class_features),
    subclasses,
  };
}

function mapFeatureBearingOption(row, extra = {}) {
  return {
    id: row.id,
    name: row.name,
    ...extra,
  };
}

function mapCompactDomainCard(row) {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    level: row.level || 1,
    description: truncDesc(row.description),
  };
}

function mapClassDetails(classRow) {
  return {
    id: classRow.id,
    name: classRow.name,
    description: typeof classRow.description === 'string' ? classRow.description : '',
    domains: classRow.domains || [],
    suggestedTraits: classRow.suggested_traits || '',
    startingHp: classRow.starting_hp ?? null,
    startingEvasion: classRow.starting_evasion ?? null,
    suggestedPrimary: classRow.suggested_primary || null,
    suggestedSecondary: classRow.suggested_secondary || null,
    suggestedArmor: classRow.suggested_armor || null,
    hopeFeature: classRow.hope_feature
      ? {
          name: classRow.hope_feature.name,
          description: classRow.hope_feature.description || '',
        }
      : null,
    classFeatures: (classRow.class_features || []).map(mapFeatureDetails).filter(Boolean),
    backgroundQuestions: Array.isArray(classRow.background_questions) ? classRow.background_questions : [],
    connections: Array.isArray(classRow.connections) ? classRow.connections : [],
  };
}

function mapSubclassDetails(row) {
  return {
    id: row.id,
    name: row.name,
    description: typeof row.description === 'string' ? row.description : '',
    spellcastTrait: row.spellcast_trait || null,
    foundationFeatures: (row.foundation_features || []).map(mapFeatureDetails).filter(Boolean),
    specializationFeatures: (row.specialization_features || []).map(mapFeatureDetails).filter(Boolean),
    masteryFeatures: (row.mastery_features || []).map(mapFeatureDetails).filter(Boolean),
  };
}

function tierLimitedArmor(srdData, targetLevel) {
  return (srdData.armor || [])
    .filter((row) => (row.tier || 1) <= targetLevel)
    .map((row) =>
      mapFeatureBearingOption(row, {
        tier: row.tier || 1,
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function tierLimitedWeapons(srdData, targetLevel) {
  return (srdData.weapons || [])
    .filter((row) => (row.tier || 1) <= targetLevel)
    .map((row) =>
      mapFeatureBearingOption(row, {
        tier: row.tier || 1,
        trait: row.trait || null,
        burden: row.burden || null,
        primaryOrSecondary: row.primary_or_secondary || null,
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function compactAncestryOptions(srdData) {
  return (srdData.ancestries || [])
    .map((row) =>
      mapFeatureBearingOption(row, {
        featureNames: featureNameList(row.features),
        experienceBonusFeatureNames: (row.features || [])
          .filter((feat) => /experience/i.test(String(feat?.description || '')))
          .map((feat) => feat.name),
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function compactCommunityOptions(srdData) {
  return (srdData.communities || [])
    .map((row) =>
      mapFeatureBearingOption(row, {
        featureNames: featureNameList(row.features),
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function primaryDomainCardRows(classRow, srdData, targetLevel) {
  const allowed = new Set(classRow?.domains || []);
  return uniqueById(
    (srdData.abilities || []).filter((row) => {
      if (!allowed.has(row.domain)) return false;
      return (row.level || 1) <= targetLevel;
    }),
  );
}

function multiclassDomainCardRows(multiclassDomain, srdData, targetLevel) {
  const want = String(multiclassDomain || '').trim();
  if (!want) return [];
  return uniqueById(
    (srdData.abilities || []).filter((row) => {
      if (String(row.domain || '').trim() !== want) return false;
      const cap = maxSelectableDomainCardLevelForRow(targetLevel, targetLevel, row.domain, multiclassDomain);
      return (row.level || 1) <= cap;
    }),
  );
}

function rowDomainCardOptions({ primaryRows, multiclassRows, targetLevel, advancementLevel, multiclassDomain }) {
  const out = [];
  for (const row of uniqueById([...(primaryRows || []), ...(multiclassRows || [])])) {
    const cap = maxSelectableDomainCardLevelForRow(
      targetLevel,
      advancementLevel,
      row.domain,
      multiclassDomain,
    );
    if ((row.level || 1) > cap) continue;
    out.push(row);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function buildAdvancementRows({ primaryRows, multiclassRows, targetLevel, multiclassDomain }) {
  const rows = {};
  for (let level = 2; level <= targetLevel; level++) {
    const domainCardOptions = rowDomainCardOptions({
      primaryRows,
      multiclassRows,
      targetLevel,
      advancementLevel: level,
      multiclassDomain,
    });
    rows[String(level)] = {
      level,
      band: advancementLevelToBand(level),
      allowedPickTypes: advancementTypesAvailableForLevelRow({
        advancementLevel: level,
        characterLevel: targetLevel,
      }),
      domainCardOptions: domainCardOptions.map((row) => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        level: row.level || 1,
      })),
    };
  }
  return rows;
}

function buildAdvancementBandBudgets(targetLevel) {
  const maxLevel = Math.max(1, Math.min(10, Math.round(Number(targetLevel) || 1)));
  const bands = ['A', 'B', 'C'];
  return bands
    .map((band) => {
      const levels = [];
      for (let level = 2; level <= maxLevel; level++) {
        if (advancementLevelToBand(level) === band) levels.push(level);
      }
      if (!levels.length) return null;
      return {
        band,
        label: ADVANCEMENT_BAND_LABELS[band],
        levels,
        pickTypeBudgets: { ...(SLOT_BUDGET_PER_BAND[band] || {}) },
        notes:
          band === 'A'
            ? [
                'These budgets are shared across levels 2-4, not per row.',
                'proficiency, subclass_upgrade, and multiclass are not legal in this band.',
              ]
            : [
                'These budgets are shared across all rows in this band, not per row.',
                'subclass_upgrade and multiclass cross out each other in the same band.',
              ],
      };
    })
    .filter(Boolean);
}

function buildMulticlassCandidates(classRow, srdData, targetLevel) {
  if (targetLevel < 5) return [];
  const primaryClassId = classRow?.id || null;
  const out = [];
  for (const mcClass of srdData.classes || []) {
    if (!mcClass?.id || mcClass.id === primaryClassId) continue;
    const subclasses = classSubclassRows(mcClass, srdData);
    const domains = mcClass.domains || [];
    for (const subclass of subclasses) {
      if (domains.length > 1) {
        for (const domainName of domains) {
          out.push({
            classId: mcClass.id,
            className: mcClass.name,
            subclassId: subclass.id,
            subclassName: subclass.name,
            multiclassDomain: domainName,
            domains,
            summary: `${mcClass.name} / ${subclass.name} using ${domainName}`,
          });
        }
      } else {
        out.push({
          classId: mcClass.id,
          className: mcClass.name,
          subclassId: subclass.id,
          subclassName: subclass.name,
          multiclassDomain: domains[0] || null,
          domains,
          summary: `${mcClass.name} / ${subclass.name}`,
        });
      }
    }
  }
  return out.sort((a, b) => a.summary.localeCompare(b.summary));
}

export function buildCompactCharacterAiCatalog(srdData, opts = {}) {
  const targetLevel = Math.max(1, Math.min(10, Math.round(Number(opts.targetLevel) || 1)));
  return {
    targetLevel,
    classes: (srdData.classes || [])
      .map((row) => mapCompactClassRow(row, srdData))
      .sort((a, b) => a.name.localeCompare(b.name)),
    ancestries: compactAncestryOptions(srdData),
    communities: compactCommunityOptions(srdData),
    domainCardIndex: uniqueById(srdData.abilities || [])
      .map(mapCompactDomainCard)
      .sort((a, b) => a.name.localeCompare(b.name)),
    experienceExamples: CHARACTER_AI_EXPERIENCE_EXAMPLES,
  };
}

export function fetchCharacterBuildProfile(rawArgs, srdData) {
  const targetLevel = Math.max(1, Math.min(10, Math.round(Number(rawArgs?.targetLevel) || 1)));
  const classId = typeof rawArgs?.classId === 'string' ? rawArgs.classId.trim() : '';
  const subclassId = typeof rawArgs?.subclassId === 'string' ? rawArgs.subclassId.trim() : '';
  const multiclassClassId =
    typeof rawArgs?.multiclassClassId === 'string' ? rawArgs.multiclassClassId.trim() : '';
  const multiclassSubclassId =
    typeof rawArgs?.multiclassSubclassId === 'string' ? rawArgs.multiclassSubclassId.trim() : '';
  const requestedMulticlassDomain =
    typeof rawArgs?.multiclassDomain === 'string' ? rawArgs.multiclassDomain.trim() : '';

  /** @type {{ path: string, code: string, message: string }[]} */
  const errors = [];

  const classRow = srdData.classesById?.[classId] || null;
  if (!classRow) {
    errors.push({ path: 'classId', code: 'invalid_class', message: `Unknown classId "${classId}"` });
  }

  const subclassRow = classRow ? resolveSubclassForClass(classRow, subclassId, srdData) : null;
  if (classRow && !subclassRow) {
    errors.push({
      path: 'subclassId',
      code: 'invalid_subclass',
      message: `Subclass "${subclassId}" is not valid for class "${classRow.name}"`,
    });
  }

  let multiclassClassRow = null;
  let multiclassSubclassRow = null;
  let multiclassDomain = null;

  if (multiclassClassId || multiclassSubclassId || requestedMulticlassDomain) {
    if (targetLevel < 5) {
      errors.push({
        path: 'multiclassClassId',
        code: 'multiclass_below_level_5',
        message: 'Multiclass profiles are only legal at targetLevel 5 or higher',
      });
    }
    multiclassClassRow = srdData.classesById?.[multiclassClassId] || null;
    if (!multiclassClassRow) {
      errors.push({
        path: 'multiclassClassId',
        code: 'invalid_multiclass_class',
        message: `Unknown multiclassClassId "${multiclassClassId}"`,
      });
    }
    if (multiclassClassRow && classRow && multiclassClassRow.id === classRow.id) {
      errors.push({
        path: 'multiclassClassId',
        code: 'duplicate_multiclass_class',
        message: 'multiclassClassId must differ from classId',
      });
    }
    multiclassSubclassRow = multiclassClassRow
      ? resolveSubclassForClass(multiclassClassRow, multiclassSubclassId, srdData)
      : null;
    if (multiclassClassRow && !multiclassSubclassRow) {
      errors.push({
        path: 'multiclassSubclassId',
        code: 'invalid_multiclass_subclass',
        message: `Subclass "${multiclassSubclassId}" is not valid for multiclass "${multiclassClassRow.name}"`,
      });
    }
    const domains = multiclassClassRow?.domains || [];
    if (multiclassClassRow && domains.length > 1) {
      multiclassDomain =
        domains.find((name) => normalizeLookupKey(name) === normalizeLookupKey(requestedMulticlassDomain)) || null;
      if (!multiclassDomain) {
        errors.push({
          path: 'multiclassDomain',
          code: 'invalid_multiclass_domain',
          message: `multiclassDomain "${requestedMulticlassDomain}" is not valid for "${multiclassClassRow.name}"`,
        });
      }
    } else {
      multiclassDomain = domains[0] || null;
    }
  }

  if (errors.length) {
    return {
      ok: false,
      targetLevel,
      errors,
    };
  }

  const primaryRows = primaryDomainCardRows(classRow, srdData, targetLevel);
  const startingAbilityOptions = primaryRows.filter((row) => (row.level || 1) <= 1);
  const multiclassRows = multiclassDomain ? multiclassDomainCardRows(multiclassDomain, srdData, targetLevel) : [];
  const legalDomainRows = uniqueById([...(primaryRows || []), ...(multiclassRows || [])]);

  return {
    ok: true,
    targetLevel,
    profileId: [
      classRow.id,
      subclassRow.id,
      multiclassClassRow?.id || null,
      multiclassSubclassRow?.id || null,
      multiclassDomain || null,
    ]
      .filter(Boolean)
      .join(':'),
    primaryClass: mapClassDetails(classRow),
    primarySubclass: mapSubclassDetails(subclassRow),
    legalDomains: [
      ...(classRow.domains || []),
      ...(multiclassDomain ? [multiclassDomain] : []),
    ],
    startingAbilityOptions: startingAbilityOptions.map((row) => ({
      id: row.id,
      name: row.name,
      domain: row.domain,
      level: row.level || 1,
    })),
    legalDomainCards: legalDomainRows.map(mapCompactDomainCard),
    groupedDomainCards: groupAbilityRowsByDomainAndLevel(legalDomainRows),
    advancementRows: buildAdvancementRows({
      primaryRows,
      multiclassRows,
      targetLevel,
      multiclassDomain,
    }),
    advancementBandBudgets: buildAdvancementBandBudgets(targetLevel),
    ancestryOptions: compactAncestryOptions(srdData),
    communityOptions: compactCommunityOptions(srdData),
    armorOptions: tierLimitedArmor(srdData, targetLevel),
    weaponOptions: tierLimitedWeapons(srdData, targetLevel),
    experienceRowCount: expectedExperienceRowCount(targetLevel),
    multiclass:
      multiclassClassRow && multiclassSubclassRow
        ? {
            classId: multiclassClassRow.id,
            className: multiclassClassRow.name,
            subclassId: multiclassSubclassRow.id,
            subclassName: multiclassSubclassRow.name,
            multiclassDomain,
            domainOptions: multiclassRows.map((row) => ({
              id: row.id,
              name: row.name,
              domain: row.domain,
              level: row.level || 1,
            })),
          }
        : null,
    multiclassCandidates: buildMulticlassCandidates(classRow, srdData, targetLevel),
    guidance: {
      sheetDisplayNamesFeaturesEnabled: false,
      repairAttemptsMax: 2,
      note:
        targetLevel < 5
          ? 'Stay single-class at targetLevel under 5. Match the closest legal class fantasy and keep every committed card in-class.'
          : 'If the concept needs off-domain magic, prefer a legal multiclass profile and validate before final output.',
      advancementBudgetNote:
        'allowedPickTypes are only row-level gates. The shared slot budgets live in advancementBandBudgets and must be respected across all levels in the same band.',
    },
  };
}
