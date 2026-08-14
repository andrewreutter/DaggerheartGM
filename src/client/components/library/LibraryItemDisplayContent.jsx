import { useCallback, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { Map, StickyNote, Swords, Trees } from 'lucide-react';
import { AdversaryCardContent, EnvironmentCardContent } from '../DetailCardContent.jsx';
import { CharacterDetailPane, TRAIT_LABELS } from '../CharacterDisplay.jsx';
import { LibraryItemImageThumb } from './LibraryItemImageThumb.jsx';
import { getLibraryItemImageUrls } from '../../lib/library-item-image-urls.js';
import { MarkdownText } from '../../lib/markdown.js';
import { LIBRARY_GENERIC_DETAIL_COLLECTIONS } from '../../lib/library-filter-config.js';
import { GuideFeatureCard } from '../features/GuideFeatureCard.jsx';
import { coerceLibraryAttack } from '../../lib/library-attack-display.js';
import { libraryTierBodyLine, showLibraryLevelBadge } from '../../lib/library-tier-subtitle.js';
import { expandDomainCardEntries } from '../../lib/library-domain-cards.js';
import { TierShieldBadge } from '../TierShieldBadge.jsx';

const GENERIC_DETAIL_SET = new Set(LIBRARY_GENERIC_DETAIL_COLLECTIONS);

/**
 * Generic metadata keys that skip the chip row (full-width label + value, always after chips).
 * Keys are SRD/normalized field names (see `normalizeClass` / `normalizeCommunity` in parser).
 */
const LIBRARY_GENERIC_METADATA_TAIL_KEYS = {
  classes: new Set(['background_questions', 'class_items', 'connections']),
  communities: new Set(['traits']),
};

/** Uppercase section titles in Library card preview / item detail (features, attack, domain spell tiers, etc.). */
const LIB_SECTION_HEADER_BORDER =
  'text-xs font-semibold text-dh-muted uppercase tracking-wide border-b border-dh-border pb-1 mb-1.5';
const LIB_SECTION_LABEL = 'text-xs font-medium uppercase tracking-wider text-dh-muted mb-1';

/** Label + value column; width is set by GenericMetadataFieldChips after measuring content. */
const LIB_GENERIC_FIELD_CHIP = 'min-w-0 flex flex-col';
/** Chip labels must stay one line so width measurement matches full text (e.g. "RECALL COST"). */
const LIB_GENERIC_FIELD_CHIP_TITLE = `${LIB_SECTION_LABEL} whitespace-nowrap`;
/** Floor so tiny values (e.g. "1") still get a readable chip width. */
const GENERIC_METADATA_CHIP_MIN_PX = 64;

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
    <span className="text-[9px] rounded px-1 py-0.5 border shrink-0 font-bold dh-tint-attack-trait">
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
        <div className="w-full min-w-0 rounded border border-dh-border bg-dh-raised/70 px-2 py-1.5 text-[11px] text-dh">
          <div className="flex items-start gap-2">
            <Swords size={10} className="shrink-0 text-dh-muted mt-0.5" />
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
      <div className="w-full min-w-0 rounded border border-dh-border bg-dh-raised/70 px-2 py-1.5 select-none text-[11px]">
        <div className="flex items-center gap-2 flex-wrap">
          <Swords size={10} className="shrink-0 text-dh-muted" />
          <span className="font-semibold text-dh truncate min-w-0">{name}</span>
          {damage ? (
            <span className="text-dh font-semibold tabular-nums shrink-0">{damage}</span>
          ) : null}
          <span className="text-dh-muted shrink-0">
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

  const scopeByIdCollections = new Set([
    'abilities',
    'classes',
    'subclasses',
    'ancestries',
    'communities',
    'beastforms',
    'items',
    'consumables',
  ]);
  if (scopeByIdCollections.has(collection) && typeof row.id === 'string') {
    row._sourceScopeKey = `${collection}:${row.id}`;
  }
  if (collection === 'weapons' && typeof row.name === 'string') {
    row._source = 'weapon_property';
  }
  if (collection === 'armor' && typeof row.name === 'string') {
    row._source = 'armor_property';
  }
  return row;
}

/** SRD ability row → GuideFeatureCard row (Library abilities tab / domain dereference). */
function abilityToLibraryGuideRow(ability, parentDomain) {
  if (!ability || typeof ability !== 'object') return null;
  const meta = `${ability.type || 'passive'} · Recall ${ability.recall_cost ?? 0}`;
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

/**
 * Extra subtitle when tier is lifted to the card title (adversaries, environments, etc.).
 * Weapons omit this — `primary_or_secondary` / `physical_or_magical` are shown as metadata chips.
 */
function LibraryTierAdversaryRow({ item, collection }) {
  if (item?.tier === undefined || item?.tier === null || item?.tier === '') return null;
  const sub = libraryTierBodyLine(item, collection);
  if (!sub) return null;
  return (
    <div className="mb-4 text-sm text-dh-muted capitalize">{sub}</div>
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

function stripLeadingMarkdownHeading(text, title = '') {
  const raw = String(text || '');
  const trimmed = raw.trimStart();
  const headingMatch = trimmed.match(/^#\s+([^\n]+)\n*/);
  if (!headingMatch) return raw;
  const heading = String(headingMatch[1] || '').trim().toLowerCase();
  const titleNorm = String(title || '').trim().toLowerCase();
  if (titleNorm && heading !== titleNorm) return raw;
  return trimmed.slice(headingMatch[0].length).trimStart();
}

/** Cheap fingerprint so metadata chips remount when any field value changes (uniform width remeasure). */
function hashFieldEntriesKey(rows) {
  let h = 0;
  for (const r of rows) {
    h = (Math.imul(31, h) + r.key.length) | 0;
    const s = typeof r.val === 'string' ? r.val : JSON.stringify(r.val);
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

function GenericFieldValue({ value }) {
  if (value == null) return <span className="text-dh-muted">—</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number') return <span>{value}</span>;
  if (typeof value === 'string') {
    if (value.length > 120 || value.includes('\n')) {
      return <MarkdownText text={value} className="text-sm text-dh dh-md" />;
    }
    return <span className="text-dh">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-dh-muted">—</span>;
    if (value.every(v => v && typeof v === 'object' && (v.name != null || v.description != null))) {
      return (
        <ul className="list-disc pl-4 space-y-2">
          {value.map((v, i) => (
            <li key={v.id || i} className="text-dh">
              {v.name && <span className="font-medium text-dh">{v.name}</span>}
              {v.type && <span className="text-xs text-dh-muted ml-1">({v.type})</span>}
              {v.description && <MarkdownText text={v.description} className="text-sm mt-0.5 dh-md" />}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul className="list-disc pl-4 text-dh">
        {value.map((v, i) => (
          <li key={i}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    return (
      <pre className="text-xs bg-dh-inset border border-dh-border rounded p-2 overflow-x-auto text-dh">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span>{String(value)}</span>;
}

/**
 * Flex-wrap field chips with uniform width = min(longest title/value block, container),
 * so wrapped rows stay column-aligned without fixed minmax columns.
 * Remount via `key` from parent when the item/fields change so width state resets before measure.
 */
function GenericMetadataFieldChips({ fields }) {
  const rootRef = useRef(null);
  const [chipWidth, setChipWidth] = useState(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const chips = root.querySelectorAll('[data-lib-field-chip]');
    if (!chips.length) {
      setChipWidth(null);
      return;
    }
    const containerW = root.clientWidth;
    if (containerW <= 0) return;

    let maxNatural = 0;
    chips.forEach((chip) => {
      const titleEl = chip.querySelector('[data-lib-field-chip-title]');
      const valueEl = chip.querySelector('[data-lib-field-chip-value]');
      const titleW = titleEl?.scrollWidth ?? 0;
      const valueW = valueEl?.scrollWidth ?? 0;
      const blockW = Math.max(titleW, valueW, chip.scrollWidth);
      maxNatural = Math.max(maxNatural, blockW);
    });
    const w = Math.min(Math.max(maxNatural, GENERIC_METADATA_CHIP_MIN_PX), containerW);
    setChipWidth((prev) => (prev === w ? prev : w));
  }, []);

  useLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div ref={rootRef} className="flex flex-wrap items-start gap-x-4 gap-y-3">
      {fields.map(({ key, val }) => (
        <div
          key={key}
          data-lib-field-chip
          className={`${LIB_GENERIC_FIELD_CHIP} ${chipWidth == null ? 'w-max max-w-full' : ''}`}
          style={
            chipWidth != null
              ? {
                  width: chipWidth,
                  flex: '0 0 auto',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }
              : undefined
          }
        >
          <div data-lib-field-chip-title className={LIB_GENERIC_FIELD_CHIP_TITLE}>
            {labelizeKey(key)}
          </div>
          <div data-lib-field-chip-value className="min-w-0 w-max max-w-full">
            <GenericFieldValue value={val} />
          </div>
        </div>
      ))}
    </div>
  );
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
  const featureSections = getLibraryFeatureSections(item, collection);
  const featureKeysSig = featureSections.map((s) => s.key).join('|');
  const renderClassHopeFeature =
    collection === 'classes' && item?.hope_feature && typeof item.hope_feature === 'object' && item.hope_feature.name;
  const renderAttackWeaponCard = coerceLibraryAttack(item?.attack) != null;
  const isRulesCollection = collection === 'rules';

  const hasDomainCardList = collection === 'domains' && Array.isArray(item?.cards) && item.cards.length > 0;
  const abilitiesReady = srdData && Array.isArray(srdData.abilities);

  const { chipFieldEntries, tailFieldEntries } = useMemo(() => {
    const tierFieldSkip = new Set();
    if (item?.tier != null && item.tier !== '') {
      tierFieldSkip.add('tier');
    }
    if (showLibraryLevelBadge(collection, item)) {
      tierFieldSkip.add('level');
    }
    const keysRendered = new Set(featureKeysSig ? featureKeysSig.split('|').filter(Boolean) : []);
    const ent = Object.entries(item || {})
      .filter(([k]) => {
        if (skip.has(k) || tierFieldSkip.has(k) || k.startsWith('_')) return false;
        if (k === 'description') return false;
        if (isRulesCollection && (k === 'body' || k === 'excerpt' || k === 'breadcrumb' || k === 'breadcrumb_titles' || k === 'source_file')) return false;
        if (collection === 'domains' && k === 'cards' && hasDomainCardList) return false;
        return true;
      })
      .sort(([a], [b]) => a.localeCompare(b));
    const filtered = ent.filter(
      ([key]) =>
        !keysRendered.has(key) &&
        !(renderClassHopeFeature && key === 'hope_feature') &&
        !(renderAttackWeaponCard && key === 'attack'),
    );
    const tailKeySet = LIBRARY_GENERIC_METADATA_TAIL_KEYS[collection] ?? new Set();
    const chipPairs = [];
    const tailPairs = [];
    for (const pair of filtered) {
      if (tailKeySet.has(pair[0])) tailPairs.push(pair);
      else chipPairs.push(pair);
    }
    chipPairs.sort(([a], [b]) => a.localeCompare(b));
    tailPairs.sort(([a], [b]) => a.localeCompare(b));
    return {
      chipFieldEntries: chipPairs.map(([key, val]) => ({ key, val })),
      tailFieldEntries: tailPairs.map(([key, val]) => ({ key, val })),
    };
  }, [
    item,
    collection,
    hasDomainCardList,
    featureKeysSig,
    renderClassHopeFeature,
    renderAttackWeaponCard,
    isRulesCollection,
  ]);

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
  const tierBlock =
    renderTierAdversaryRow && collection !== 'weapons' ? (
      <LibraryTierAdversaryRow item={item} collection={collection} />
    ) : null;

  /** Full-width prose, no label — always before other generic fields. */
  const descriptionBlock = item?.description && !isRulesCollection ? (
    <div className="w-full min-w-0">
      <MarkdownText text={item.description} className="text-sm text-dh dh-md" />
    </div>
  ) : null;

  const rulesBodyBlock = isRulesCollection && item?.body ? (
    <div className="w-full min-w-0 space-y-3">
      {item?.breadcrumb ? (
        <div className="text-xs uppercase tracking-wide text-dh-muted">
          {item.breadcrumb}
        </div>
      ) : null}
      <MarkdownText
        text={stripLeadingMarkdownHeading(item.body, item.name)}
        className="text-sm text-dh dh-md"
      />
    </div>
  ) : null;

  const domainSpellBlock =
    hasDomainCardList && !abilitiesReady ? (
      <div className="mb-4 text-sm text-dh-muted">Loading spell reference…</div>
    ) : hasDomainCardList && abilitiesReady && srdData.abilities.length === 0 ? (
      <div className="mb-4">
        <div className={LIB_SECTION_LABEL}>Cards</div>
        <GenericFieldValue value={item.cards} />
      </div>
    ) : hasDomainCardList && abilitiesReady ? (
      <LibraryDomainSpellCards domainItem={item} srdData={srdData} parentItem={item} />
    ) : null;

  const metadataChipsKey =
    chipFieldEntries.length > 0
      ? `${item?.id ?? 'na'}:${chipFieldEntries.map((f) => f.key).join(',')}:${hashFieldEntriesKey(chipFieldEntries)}`
      : '';

  return (
    <div className="space-y-4 pr-1">
      {descriptionBlock}
      {rulesBodyBlock}
      {tierBlock}
      {chipFieldEntries.length > 0 ? (
        <GenericMetadataFieldChips key={metadataChipsKey} fields={chipFieldEntries} />
      ) : null}
      {tailFieldEntries.length > 0 ? (
        <div className="flex flex-col gap-4 w-full min-w-0">
          {tailFieldEntries.map(({ key, val }) => (
            <div key={key} className="w-full min-w-0">
              <div className={LIB_SECTION_LABEL}>{labelizeKey(key)}</div>
              <GenericFieldValue value={val} />
            </div>
          ))}
        </div>
      ) : null}
      {attackBlock}
      {domainSpellBlock}
      {featureBlocks}
    </div>
  );
}

function countSceneElementsByType(item, elementType) {
  const elements = Array.isArray(item?.activeElements) ? item.activeElements : [];
  return elements.filter(el => el?.elementType === elementType).length;
}

/**
 * Lightweight scene summary: first-map thumbnail, denormalized tier/BP, and element counts.
 * @param {{ item: object, compact?: boolean, fill?: boolean }} props
 *   `fill` — library grid card: map grows into available height and keeps aspect via object-contain.
 */
export function SceneLibraryCard({ item, compact = false, fill = false }) {
  const mapImageUrl = item?.maps?.[0]?.mapImageUrl;
  const mapCount = Array.isArray(item?.maps) ? item.maps.length : 0;
  const envCount = countSceneElementsByType(item, 'environment');
  const advCount = countSceneElementsByType(item, 'adversary');
  const noteCount = countSceneElementsByType(item, 'note');
  const showTier = item?.tier != null && item.tier !== '';
  const showBp = item?.bp != null && item.bp !== '';

  const counts = [
    { Icon: Map, label: 'Maps', count: mapCount },
    { Icon: Trees, label: 'Environments', count: envCount },
    { Icon: Swords, label: 'Adversaries', count: advCount },
    { Icon: StickyNote, label: 'Notes', count: noteCount },
  ];

  const mapBoxClass = fill
    ? 'flex-1 min-h-0 flex items-center justify-center overflow-hidden rounded border border-dh-border/80 bg-dh-canvas/40'
    : `overflow-hidden rounded border border-dh-border/80 ${compact ? 'h-20' : 'h-36'}`;

  return (
    <div
      className={
        fill
          ? 'h-full min-h-0 flex flex-col gap-1.5 p-1.5 bg-dh-inset border border-dh-border rounded-lg'
          : 'mb-3 p-2.5 bg-dh-inset border border-dh-border rounded-lg space-y-2.5'
      }
    >
      {mapImageUrl ? (
        <div className={mapBoxClass}>
          <img
            src={mapImageUrl}
            alt=""
            className={
              fill
                ? 'max-h-full max-w-full w-auto h-auto object-contain'
                : 'h-full w-full object-contain'
            }
          />
        </div>
      ) : null}
      {(showTier || showBp) && (
        <div className={`flex items-center gap-2 flex-wrap ${fill ? 'shrink-0' : ''}`}>
          {showTier ? (
            <span className="shrink-0" title={`Tier ${item.tier}`}>
              <TierShieldBadge tier={item.tier} size={compact || fill ? 'sm' : 'md'} />
            </span>
          ) : null}
          {showBp ? (
            <span className="text-xs font-semibold tabular-nums text-blue-200 border border-blue-700/50 bg-blue-900/30 rounded px-1.5 py-0.5">
              {item.bp} BP
            </span>
          ) : null}
        </div>
      )}
      <div className={`flex flex-wrap gap-x-3 gap-y-1 text-xs text-dh-muted ${fill ? 'shrink-0' : ''}`}>
        {counts.map(({ Icon, label, count }) => (
          <span key={label} className="inline-flex items-center gap-1" title={label}>
            <Icon size={12} className="shrink-0" aria-hidden />
            <span className="tabular-nums font-medium text-dh">{count}</span>
            <span>{label}</span>
          </span>
        ))}
      </div>
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
  /** Own characters only: updates Hope / HP / Stress / Armor from the live sheet preview. */
  onCharacterRuntimeUpdate,
  isOwn = false,
  cardKey = 'library-preview',
  /** When `'libraryCard'`, shows the first image floated upper-right so content flows around it. */
  layout = 'default',
  /** When provided, character portrait image becomes click-to-fullscreen. */
  onOpenImageLightbox,
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
      {collection === 'scenes' && (
        <>
          {item.description && (
            <MarkdownText text={item.description} className="text-sm italic text-dh mb-3" />
          )}
          <SceneLibraryCard item={item} compact={libraryCard} />
        </>
      )}
      {collection === 'adventures' && item.description && (
        <MarkdownText text={item.description} className="text-sm italic text-dh" />
      )}
      {collection === 'characters' && (
        <CharacterDetailPane item={item} srdData={srdData} onCharacterRuntimeUpdate={onCharacterRuntimeUpdate} onOpenImageLightbox={onOpenImageLightbox} />
      )}
      {GENERIC_DETAIL_SET.has(collection) && (
        <GenericLibraryRecordBody item={item} collection={collection} srdData={srdData} />
      )}
    </>
  );
}
