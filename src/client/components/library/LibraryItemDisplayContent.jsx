import { Swords } from 'lucide-react';
import { AdversaryCardContent, EnvironmentCardContent } from '../DetailCardContent.jsx';
import { CharacterDetailPane, TRAIT_LABELS } from '../CharacterDisplay.jsx';
import { ExpandedTablePreview } from '../ItemDetailView.jsx';
import { LibraryItemImageThumb } from './LibraryItemImageThumb.jsx';
import { getLibraryItemImageUrls } from '../../lib/library-item-image-urls.js';
import { MarkdownText } from '../../lib/markdown.js';
import { computeSceneBudget } from '../../lib/battle-points.js';
import { LIBRARY_GENERIC_DETAIL_COLLECTIONS } from '../../lib/library-filter-config.js';
import { GuideFeatureCard } from '../features/GuideFeatureCard.jsx';
import { coerceLibraryAttack } from '../../lib/library-attack-display.js';
import { libraryTierBodyLine } from '../../lib/library-tier-subtitle.js';
import { expandDomainCardEntries } from '../../lib/library-domain-cards.js';

const GENERIC_DETAIL_SET = new Set(LIBRARY_GENERIC_DETAIL_COLLECTIONS);

/** Uppercase section titles in Library card preview / item detail (features, attack, domain spell tiers, etc.). */
const LIB_SECTION_HEADER_BORDER =
  'text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-800 pb-1 mb-1.5';
const LIB_SECTION_LABEL = 'text-xs font-medium uppercase tracking-wider text-slate-500 mb-1';

/** Stub character element so `GuideFeatureCard` can run V2 preview chips in `interactionMode="preview"`. */
const LIBRARY_PREVIEW_EL_STUB = { instanceId: null, elementType: 'character', name: '' };

const LIBRARY_COLLECTION_SOURCE_TYPE = {
  abilities: 'domain',
  ancestries: 'ancestry',
  armor: 'armor',
  beastforms: 'beastform',
  classes: 'class',
  communities: 'community',
  consumables: 'consumable',
  domains: 'domain',
  items: 'item',
  subclasses: 'subclass',
  weapons: 'weapon',
};

function attackTraitBadge(trait) {
  if (!trait || !String(trait).trim()) return null;
  const t = String(trait).trim();
  const k = t.toLowerCase();
  const short = TRAIT_LABELS[k] || (t.length <= 8 ? t.toUpperCase() : `${t.slice(0, 8)}…`);
  return (
    <span className="text-[9px] rounded px-1 py-0.5 border shrink-0 font-bold bg-sky-900/50 border-sky-700/50 text-sky-300">
      {short}
    </span>
  );
}

/** Read-only weapon-style card for SRD `attack` objects (adversary-shaped) or prose beastform attacks. */
function LibraryAttackAsWeaponCard({ attack }) {
  const coerced = coerceLibraryAttack(attack);
  if (!coerced) return null;
  if (coerced.kind === 'text') {
    return (
      <div className="mb-4">
        <div className={LIB_SECTION_HEADER_BORDER}>
          Attack
        </div>
        <div className="w-full min-w-0 rounded border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-[11px] text-slate-200">
          <div className="flex items-start gap-2">
            <Swords size={10} className="shrink-0 text-slate-500 mt-0.5" />
            <MarkdownText text={coerced.text} className="dh-md text-[11px] leading-snug flex-1 min-w-0" />
          </div>
        </div>
      </div>
    );
  }
  const { name, modifier, range, damage, trait } = coerced;
  return (
    <div className="mb-4">
      <div className={LIB_SECTION_HEADER_BORDER}>
        Attack
      </div>
      <div className="w-full min-w-0 rounded border border-slate-700 bg-slate-800/60 px-2 py-1.5 select-none text-[11px]">
        <div className="flex items-center gap-2 flex-wrap">
          <Swords size={10} className="shrink-0 text-slate-500" />
          <span className="font-semibold text-slate-200 truncate min-w-0">{name}</span>
          {damage ? (
            <span className="text-yellow-300 font-semibold tabular-nums shrink-0">{damage}</span>
          ) : null}
          <span className="text-slate-500 shrink-0">
            {modifier >= 0 ? '+' : ''}
            {modifier} {range}
          </span>
          {attackTraitBadge(trait)}
        </div>
      </div>
    </div>
  );
}

function featureRowsRenderableAsCards(rows) {
  return (
    Array.isArray(rows) &&
    rows.length > 0 &&
    rows.every((f) => f && typeof f === 'object' && (f.name != null || f.title != null))
  );
}

function normalizeLibraryFeatureRow(feat, parentItem, collection) {
  if (!feat || typeof feat !== 'object') return null;
  const row = { ...feat };
  if (row.name == null && row.title != null) row.name = row.title;
  if (row.description == null) row.description = '';
  if (!row.type) row.type = 'passive';
  if (!row.source && parentItem?.name) row.source = parentItem.name;
  const st = LIBRARY_COLLECTION_SOURCE_TYPE[collection];
  if (st && row.sourceType == null) row.sourceType = st;
  return row;
}

/** SRD ability row → GuideFeatureCard row (Library abilities tab / domain dereference). */
function abilityToLibraryGuideRow(ability, parentDomain) {
  if (!ability || typeof ability !== 'object') return null;
  const meta = `Level ${ability.level} · ${ability.type || 'passive'} · Recall ${ability.recall_cost ?? 0}`;
  return normalizeLibraryFeatureRow(
    {
      id: ability.id,
      name: ability.name,
      type: ability.type || 'passive',
      description: ability.description ? `${meta}\n\n${ability.description}` : meta,
    },
    parentDomain,
    'abilities',
  );
}

/**
 * Which item keys hold `{ name, description, type? }[]` feature lists for generic Library detail.
 * (SRD shape differs per collection — e.g. classes use `class_features`, subclasses use tier columns.)
 */
function getLibraryFeatureSections(item, collection) {
  const sections = [];
  const push = (key, label) => {
    const rows = item?.[key];
    if (!featureRowsRenderableAsCards(rows)) return;
    sections.push({ key, label, rows });
  };
  if (collection === 'classes') {
    push('class_features', 'Class features');
    return sections;
  }
  if (collection === 'subclasses') {
    push('foundation_features', 'Foundation');
    push('specialization_features', 'Specialization');
    push('mastery_features', 'Mastery');
    return sections;
  }
  push('features', 'Features');
  return sections;
}

/** Extra subtitle for generic library preview (tier icon is on the card/modal title). */
function LibraryTierAdversaryRow({ item, collection }) {
  if (item?.tier === undefined || item?.tier === null || item?.tier === '') return null;
  const sub = libraryTierBodyLine(item, collection);
  if (!sub) return null;
  return (
    <div className="mb-4 text-sm text-slate-400 capitalize">{sub}</div>
  );
}

function LibraryGuideFeatureCards({ rows, sectionLabel, parentItem, collection }) {
  if (!featureRowsRenderableAsCards(rows)) return null;
  return (
    <div className="space-y-1.5 mb-4">
      <div className={LIB_SECTION_HEADER_BORDER}>
        {sectionLabel}
      </div>
      <div className="space-y-1.5">
        {rows.map((raw, i) => {
          const row = normalizeLibraryFeatureRow(raw, parentItem, collection);
          if (!row) return null;
          return (
            <GuideFeatureCard
              key={row.id || `${row.name}-${i}`}
              featRow={row}
              featureKey={row.id || `lib-feat-${String(row.name)}-${i}`}
              el={LIBRARY_PREVIEW_EL_STUB}
              open
              onToggle={() => {}}
              interactionMode="preview"
            />
          );
        })}
      </div>
    </div>
  );
}

/** Domain tab: `cards` lists spell names per level — resolve against SRD abilities and show GuideFeatureCards. */
function LibraryDomainSpellCards({ domainItem, srdData, parentItem }) {
  const { sections } = expandDomainCardEntries(domainItem, srdData);
  if (!sections.length) {
    return (
      <div className="mb-4">
        <div className={LIB_SECTION_LABEL}>Cards</div>
        <GenericFieldValue value={domainItem.cards} />
      </div>
    );
  }
  return (
    <div className="space-y-4 mb-4">
      {sections.map(({ level, entries }) => (
        <div key={level}>
          <div className={LIB_SECTION_HEADER_BORDER}>
            Level {level} spells
          </div>
          <div className="space-y-1.5">
            {entries.map((ent, i) => {
              if (ent.ability) {
                const row = abilityToLibraryGuideRow(ent.ability, parentItem);
                if (!row) return null;
                return (
                  <GuideFeatureCard
                    key={ent.ability.id || `dom-${level}-${i}`}
                    featRow={row}
                    featureKey={ent.ability.id || `dom-${level}-${i}`}
                    el={LIBRARY_PREVIEW_EL_STUB}
                    open
                    onToggle={() => {}}
                    interactionMode="preview"
                  />
                );
              }
              return (
                <div
                  key={`unresolved-${level}-${i}`}
                  className="rounded border border-amber-800/50 bg-amber-950/25 px-2 py-1.5 text-[11px] text-amber-200/90"
                >
                  <span className="font-semibold">Unresolved pick: </span>
                  <span className="font-mono text-amber-100/85">
                    {typeof ent.raw === 'object' ? JSON.stringify(ent.raw) : String(ent.raw)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function labelizeKey(key) {
  return String(key).replace(/_/g, ' ');
}

function GenericFieldValue({ value }) {
  if (value == null) return <span className="text-slate-500">—</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number') return <span>{value}</span>;
  if (typeof value === 'string') {
    if (value.length > 120 || value.includes('\n')) {
      return <MarkdownText text={value} className="text-sm text-slate-200 dh-md" />;
    }
    return <span className="text-slate-200">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-500">—</span>;
    if (value.every(v => v && typeof v === 'object' && (v.name != null || v.description != null))) {
      return (
        <ul className="list-disc pl-4 space-y-2">
          {value.map((v, i) => (
            <li key={v.id || i} className="text-slate-200">
              {v.name && <span className="font-medium text-white">{v.name}</span>}
              {v.type && <span className="text-xs text-slate-500 ml-1">({v.type})</span>}
              {v.description && <MarkdownText text={v.description} className="text-sm mt-0.5 dh-md" />}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul className="list-disc pl-4 text-slate-300">
        {value.map((v, i) => (
          <li key={i}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    return (
      <pre className="text-xs bg-slate-950/80 border border-slate-800 rounded p-2 overflow-x-auto text-slate-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span>{String(value)}</span>;
}

function GenericLibraryRecordBody({ item, collection, srdData }) {
  const skip = new Set([
    'id',
    'name',
    '_source',
    '_owner',
    'clone_count',
    'play_count',
    'popularity',
    'is_public',
    'imageUrl',
    '_additionalImages',
  ]);
  const renderTierAdversaryRow = item?.tier != null && item.tier !== '';
  const tierFieldSkip = new Set();
  if (renderTierAdversaryRow) {
    tierFieldSkip.add('tier');
    if (collection === 'weapons') {
      tierFieldSkip.add('primary_or_secondary');
      tierFieldSkip.add('physical_or_magical');
    }
  }
  const featureSections = getLibraryFeatureSections(item, collection);
  const featureKeysRendered = new Set(featureSections.map((s) => s.key));
  const renderClassHopeFeature =
    collection === 'classes' && item?.hope_feature && typeof item.hope_feature === 'object' && item.hope_feature.name;
  const renderAttackWeaponCard = coerceLibraryAttack(item?.attack) != null;

  const hasDomainCardList = collection === 'domains' && Array.isArray(item?.cards) && item.cards.length > 0;
  const abilitiesReady = srdData && Array.isArray(srdData.abilities);

  const entries = Object.entries(item || {}).filter(([k]) => {
    if (skip.has(k) || tierFieldSkip.has(k) || k.startsWith('_')) return false;
    if (collection === 'domains' && k === 'description') return false;
    if (collection === 'domains' && k === 'cards' && hasDomainCardList) return false;
    return true;
  });
  entries.sort(([a], [b]) => a.localeCompare(b));

  const featureBlocks = (
    <>
      {featureSections.map(({ key, label, rows }) => (
        <LibraryGuideFeatureCards
          key={key}
          rows={rows}
          sectionLabel={label}
          parentItem={item}
          collection={collection}
        />
      ))}
      {renderClassHopeFeature && (
        <LibraryGuideFeatureCards
          key="hope-feature"
          rows={[{ ...item.hope_feature, type: item.hope_feature.type || 'passive' }]}
          sectionLabel="Hope feature"
          parentItem={item}
          collection={collection}
        />
      )}
    </>
  );

  const attackBlock = renderAttackWeaponCard ? <LibraryAttackAsWeaponCard attack={item.attack} /> : null;
  const tierBlock = renderTierAdversaryRow ? <LibraryTierAdversaryRow item={item} collection={collection} /> : null;

  const domainDescriptionBlock =
    collection === 'domains' && item?.description ? (
      <MarkdownText text={item.description} className="text-sm text-slate-200 dh-md mb-4" />
    ) : null;

  const domainSpellBlock =
    hasDomainCardList && !abilitiesReady ? (
      <div className="mb-4 text-sm text-slate-400">Loading spell reference…</div>
    ) : hasDomainCardList && abilitiesReady && srdData.abilities.length === 0 ? (
      <div className="mb-4">
        <div className={LIB_SECTION_LABEL}>Cards</div>
        <GenericFieldValue value={item.cards} />
      </div>
    ) : hasDomainCardList && abilitiesReady ? (
      <LibraryDomainSpellCards domainItem={item} srdData={srdData} parentItem={item} />
    ) : null;

  const entryBlocks = entries
    .filter(
      ([key]) =>
        !featureKeysRendered.has(key) &&
        !(renderClassHopeFeature && key === 'hope_feature') &&
        !(renderAttackWeaponCard && key === 'attack'),
    )
    .map(([key, val]) => (
      <div key={key}>
        <div className={LIB_SECTION_LABEL}>{labelizeKey(key)}</div>
        <GenericFieldValue value={val} />
      </div>
    ));

  return (
    <div className="space-y-4 pr-1">
      {attackBlock}
      {tierBlock}
      {domainDescriptionBlock}
      {domainSpellBlock}
      {featureBlocks}
      {entryBlocks}
    </div>
  );
}

/**
 * Compact battle budget summary bar for scene detail view.
 * Shows tier, BP cost, adjusted budget with modifiers.
 */
function SceneBudgetBar({ item, data, partySize = 1, partyTier = 1, characters = [] }) {
  const { tier, bp, budget, autoMods, userMods, totalMod, adjustedBudget } = computeSceneBudget(item, data, partySize, partyTier);

  const hasAdversaries = bp > 0 || tier != null;
  if (!hasAdversaries) return null;

  const diff = bp - adjustedBudget;
  const diffColor = diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-400';

  const { lowerTierAdversary } = autoMods;
  const topTierChars = lowerTierAdversary.active
    ? characters.filter(c => (c.tier ?? 1) >= (lowerTierAdversary.partyTier ?? 1))
    : [];
  const lowerTierAdvNames = lowerTierAdversary.active
    ? [...new Map((lowerTierAdversary.lowerTierItems || []).map(a => [a.name || a.role, a])).values()]
    : [];
  const lowerTierTooltip = lowerTierAdversary.active
    ? [
        `Party T${lowerTierAdversary.partyTier ?? 1}${topTierChars.length > 0 ? `: ${topTierChars.map(c => c.name).join(', ')}` : ''}`,
        lowerTierAdvNames.length > 0 ? `Lower: ${lowerTierAdvNames.map(a => `${a.name || a.role} T${a.tier ?? 1}`).join(', ')}` : '',
      ].filter(Boolean).join(' · ')
    : '';

  const activeMods = [
    autoMods.twoOrMoreSolos.active && { label: '2+ Solos', value: -2, auto: true },
    lowerTierAdversary.active && { label: 'Lower-tier adversary', value: +1, auto: true, tooltip: lowerTierTooltip },
    autoMods.noHeavyRoles.active && { label: 'No heavy roles', value: +1, auto: true },
    userMods.lessDifficult && { label: 'Less difficult', value: -1, auto: false },
    userMods.damageBoostPlusOne && { label: '+1 damage', value: -1, auto: false },
    userMods.damageBoostD4 && { label: '+1d4 damage', value: -2, auto: false },
    userMods.damageBoostStatic && { label: '+2 damage', value: -2, auto: false },
    userMods.slightlyMoreDangerous && { label: 'Slightly more dangerous', value: +1, auto: false },
    userMods.moreDangerous && { label: 'More dangerous', value: +2, auto: false },
  ].filter(Boolean);

  return (
    <div className="mb-3 p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg">
      <div className="flex items-center gap-3 flex-wrap">
        {tier != null && (
          <span className="relative inline-flex items-center justify-center w-6 h-6 shrink-0" title={`Tier ${tier}`}>
            <svg viewBox="0 0 20 22" className="absolute inset-0 w-full h-full" fill="none">
              <path d="M10 1L19 5v7c0 5-4 8-9 9C5 20 1 17 1 12V5l9-4z" fill="#0f2040" stroke="#3b82f6" strokeWidth="1.5" />
            </svg>
            <span className="relative text-[11px] font-bold text-blue-200 leading-none mt-0.5">{tier}</span>
          </span>
        )}
        <span className="text-sm text-slate-300">
          <span className="font-bold text-white">{bp}</span>
          <span className="text-slate-500"> BP</span>
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-sm text-slate-300">
          Budget <span className="font-bold text-white">{adjustedBudget}</span>
          {totalMod !== 0 && (
            <span className={`ml-1 text-xs ${totalMod > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ({totalMod > 0 ? '+' : ''}{totalMod})
            </span>
          )}
        </span>
        <span className={`text-xs font-semibold ${diffColor}`}>
          {diff === 0 ? 'On budget' : diff > 0 ? `+${diff} over budget` : `${Math.abs(diff)} under budget`}
        </span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-500">{partySize} PC{partySize !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {activeMods.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {activeMods.map((m, i) => (
            <span
              key={i}
              title={m.tooltip || undefined}
              className={`text-xs px-1.5 py-0.5 rounded-full border ${
                m.value > 0
                  ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300'
                  : 'bg-red-900/40 border-red-700/50 text-red-300'
              } ${m.auto ? '' : 'border-dashed'} ${m.tooltip ? 'cursor-help' : ''}`}
            >
              {m.label} {m.value > 0 ? '+' : ''}{m.value}
            </span>
          ))}
        </div>
      )}
      {lowerTierAdversary.active && (
        <div className="mt-1.5 space-y-0.5">
          <p className="text-xs text-sky-400/80 leading-snug">
            Party T{lowerTierAdversary.partyTier ?? 1}{topTierChars.length > 0 ? `: ${topTierChars.map(c => c.name).join(', ')}` : ''}
          </p>
          {lowerTierAdvNames.length > 0 && (
            <p className="text-xs text-emerald-400/70 leading-snug">
              Lower: {lowerTierAdvNames.map(a => `${a.name || a.role} T${a.tier ?? 1}`).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Library grid card: first item image at upper-right; `float-right` so body text wraps beside it.
 * When `asFloat` is false, renders only the thumb (compact cards with no detail preview).
 */
export function LibraryItemCardLeadImage({ item, asFloat = true }) {
  const urls = getLibraryItemImageUrls(item);
  if (urls.length === 0) return null;
  const thumb = <LibraryItemImageThumb item={item} variant="card" />;
  if (!asFloat) {
    return <div className="shrink-0 pointer-events-none">{thumb}</div>;
  }
  return (
    <div className="float-right ml-2 mb-2 shrink-0 pointer-events-none">
      {thumb}
    </div>
  );
}

/** Compact library cards (no detail preview): thumbnail under title bar, right-aligned. */
export function LibraryItemCardCompactRow({ item }) {
  if (getLibraryItemImageUrls(item).length === 0) return null;
  return (
    <div className="flex shrink-0 justify-end pt-0.5">
      <LibraryItemCardLeadImage item={item} asFloat={false} />
    </div>
  );
}

/**
 * Same collection-specific body as the ItemDetailModal preview pane (carousel / header excluded).
 */
export function LibraryItemDisplayContent({
  item,
  collection,
  data,
  partySize = 1,
  partyTier = 1,
  characters = [],
  srdData = null,
  enriching = false,
  adversaryScaledMeta = null,
  onAdversaryScaledToggle,
  onSaveElement,
  isOwn = false,
  cardKey = 'library-preview',
  /** When `'libraryCard'`, shows the first image floated upper-right so content flows around it. */
  layout = 'default',
}) {
  const libraryCard = layout === 'libraryCard';

  return (
    <>
      {enriching ? (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-rose-950/40 border border-rose-800/50">
          <div className="w-3 h-3 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
          <span className="text-sm text-rose-300">Loading full details…</span>
        </div>
      ) : null}

      {libraryCard && !enriching ? <LibraryItemCardLeadImage item={item} /> : null}

      {collection === 'adversaries' && (
        <AdversaryCardContent
          element={item}
          hoveredFeature={null}
          cardKey={cardKey}
          scaledMeta={adversaryScaledMeta}
          onScaledToggle={onAdversaryScaledToggle}
          suppressTierBadge
        />
      )}
      {collection === 'environments' && (
        <EnvironmentCardContent element={item} hoveredFeature={null} cardKey={cardKey} suppressTierBadge />
      )}
      {collection === 'scenes' && data && (
        <>
          {item.description && (
            <MarkdownText text={item.description} className="text-sm italic text-slate-300 mb-3" />
          )}
          <SceneBudgetBar item={item} data={data} partySize={partySize} partyTier={partyTier} characters={characters} />
          <ExpandedTablePreview
            item={item}
            tab={collection}
            data={data}
            onSaveElement={onSaveElement}
            isOwn={isOwn}
            damageBoost={
              item.battleMods?.damageBoostD4 ? 'd4'
              : item.battleMods?.damageBoostStatic ? 'static'
              : item.battleMods?.damageBoostPlusOne ? 'plusOne'
              : null
            }
          />
        </>
      )}
      {collection === 'adventures' && item.description && (
        <MarkdownText text={item.description} className="text-sm italic text-slate-300" />
      )}
      {collection === 'characters' && (
        <CharacterDetailPane item={item} srdData={srdData} />
      )}
      {GENERIC_DETAIL_SET.has(collection) && (
        <GenericLibraryRecordBody item={item} collection={collection} srdData={srdData} />
      )}
    </>
  );
}
