/**
 * Druid class features — SRD: daggerheart-srd/classes/Druid.md
 *
 * Beastform/Evolution: tier-filtered options come from **`table.registry.beastforms`**
 * (host passes the V2 registry on `buildTableSnapshot` / `gameState.registry`). Shared persistence uses
 * **`table.source`** (scope `classes:srd-cls-druid` from the loader): **`activeBeastform`**
 * (`{ beastformId, viaEvolution }`) and **`evolutionTraitKey`** (Evolution only).
 *
 * Declarative overlay (`applyDeclarativeFeatures`): merges beastform trait/evasion,
 * **`virtualWeapon`** + **`virtualSources`** on this feature (`when(hasActiveBeastformInTable, …)`), `weaponRenderHints`
 * disable for inventory weapons, and **`domainLoadoutDisabled`**.
 * `hooks.onStateChange` on **Beastform** clears beastform state when HP reaches 0.
 * **Drop out** is a second `card` chip on the **Beastform** feature (`when(hasActiveBeastformInTable, …)`), not a separate class feature.
 * Transform selects (**Beastform** / **Evolution**) stay visible while transformed so the player can switch forms; `onUse` clears cross-path state via `table.source`.
 * Dropping out queues `setFeatureState` only; the client also clears legacy `element.activeBeastform` when applying that mutation (`table-ops`).
 */

import { when } from '../engine/when.js';
import {
  resolveBeastformVirtualSources,
  resolveBeastformVirtualWeapon,
} from '../engine/beastform-virtual-weapon-decl.js';
import { beastformRowToTooltipMarkdown } from '../beastforms/format-beastform-tooltip.js';

function characterTierFromLevel(level) {
  const n = Number(level) || 1;
  if (n >= 8) return 4;
  if (n >= 5) return 3;
  if (n >= 2) return 2;
  return 1;
}

/**
 * Beastforms this Druid may pick (tier ≤ PC tier), sorted. Reads `table.registry.beastforms`.
 */
function druidBeastformSelectRows(table) {
  const map = table.registry?.beastforms;
  if (!map || typeof map !== 'object') return [];
  const me = table.me;
  if (!me?.isCharacter) return [];
  const tier =
    me.tier != null ? Number(me.tier) || 1 : characterTierFromLevel(me.level ?? 1);
  return Object.values(map)
    .filter((b) => b && typeof b === 'object' && Number(b.tier) <= tier)
    .sort((a, b) => Number(a.tier) - Number(b.tier) || String(a.name).localeCompare(String(b.name)));
}

function hasActiveBeastformInTable(table) {
  return table.me?.inBeastform === true;
}

/** When taking the Beastform path, clear Evolution-only `evolutionTraitKey` (shared `activeBeastform` is set next in `onUse`). */
function clearOtherBeastformPath(table, fromFeatureKey) {
  if (fromFeatureKey === 'Beastform') {
    table.source.set('evolutionTraitKey', null);
  }
}

function droppedToZeroHpWhileInBeastform(table) {
  const hp = table.me?.currentHP;
  if (hp == null || hp > 0) return false;
  return hasActiveBeastformInTable(table);
}

function clearBeastformState(table) {
  table.source.set('activeBeastform', null);
  table.source.set('evolutionTraitKey', null);
}

const beastformHooks = {
  onStateChange: when(droppedToZeroHpWhileInBeastform, (table) => {
    clearBeastformState(table);
  }),
};

const EVOLUTION_DESCRIPTION =
  'Spend 3 Hope to transform into a Beastform without marking a Stress. When you do, choose one trait to raise by +1 until you drop out of that Beastform.';

export const Evolution = {
  name: 'Evolution',
  description: EVOLUTION_DESCRIPTION,
  chips: [
    {
      placements: ['card'],
      name: 'Evolution',
      description: EVOLUTION_DESCRIPTION,
      hopeCost: 3,
      isSelect: (table) => {
        const opts = druidBeastformSelectRows(table);
        return opts.map((o) => ({
          id: o.id,
          name: `${o.name} (Evolution)`,
          description: beastformRowToTooltipMarkdown(o),
        }));
      },
      onUse(table, chip) {
        const id = chip.get('selectedId');
        if (!id) return;
        clearOtherBeastformPath(table, 'Evolution');
        table.source.set('activeBeastform', { beastformId: id, viaEvolution: true });
        const traitKey = chip.get('evolutionTraitKey');
        if (traitKey) table.source.set('evolutionTraitKey', traitKey);
      },
    },
  ],
};

const BEASTFORM_DESCRIPTION =
  "Mark a Stress to magically transform into a creature of your tier or lower from the Beastform list. You can drop out of this form at any time. While transformed, you can't use weapons or cast spells from domain cards, but you can still use other features or abilities you have access to. Spells you cast before you transform stay active and last for their normal duration, and you can talk and communicate as normal. Additionally, you gain the Beastform's features, add their Evasion bonus to your Evasion, and use the trait specified in their statistics for your attack. While you're in a Beastform, your armor becomes part of your body and you mark Armor Slots as usual; when you drop out of a Beastform, those marked Armor Slots remain marked. If you mark your last Hit Point, you automatically drop out of this form.";

/** Card / Actions strip title — see `displayName` on feature rows (`build-feature-card-model.js`). */
function beastformFeatureDisplayName(table) {
  if (!hasActiveBeastformInTable(table)) return 'Beastform';
  const n = table.me?.activeBeastformDisplayName;
  return n ? `Beastform — ${n}` : 'Beastform';
}

export const Beastform = {
  name: 'Beastform',
  displayName: beastformFeatureDisplayName,
  description: BEASTFORM_DESCRIPTION,
  /** Natural attack from the active beastform SRD row — only while `table.me.inBeastform`. */
  virtualWeapon: when(hasActiveBeastformInTable, resolveBeastformVirtualWeapon),
  /** Sub-features from `registry.beastforms[id].features` — expanded via `virtualSources` in `applyDeclarativeFeatures`. */
  virtualSources: when(hasActiveBeastformInTable, resolveBeastformVirtualSources),
  hooks: beastformHooks,
  chips: [
    {
      placements: ['card'],
      name: (table) => 'Beastform',
      description: BEASTFORM_DESCRIPTION,
      stressCost: 1,
      isSelect: (table) => {
        const opts = druidBeastformSelectRows(table);
        return opts.map((o) => ({
          id: o.id,
          name: o.name,
          description: beastformRowToTooltipMarkdown(o),
        }));
      },
      onUse(table, chip) {
        const id = chip.get('selectedId');
        if (!id) return;
        clearOtherBeastformPath(table, 'Beastform');
        table.source.set('activeBeastform', { beastformId: id, viaEvolution: false });
      },
    },
    /** Only collected while transformed — same as auto-drop at 0 HP. */
    when(hasActiveBeastformInTable, {
      placements: ['card'],
      name: (table) => {
        const n = table.me?.activeBeastformDisplayName;
        return n ? `Drop out of ${n} Beastform` : 'Drop out of Beastform';
      },
      description:
        'Leave your current Beastform. You return to your normal form; marked Armor Slots stay marked.',
      onUse(table) {
        clearBeastformState(table);
      },
    }),
  ],
};

export const Wildtouch = {
  name: 'Wildtouch',
  description:
    'You can perform harmless, subtle effects that involve nature—such as causing a flower to rapidly grow, summoning a slight gust of wind, or starting a campfire at will.',
};
