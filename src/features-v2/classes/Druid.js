/**
 * Druid class features — SRD: daggerheart-srd/classes/Druid.md
 *
 * Beastform/Evolution: tier-filtered options come from `table.me.beastformOptions`
 * (host must call `attachBeastformOptions` before snapshots). Active form is stored
 * under `table.feature` key **`activeBeastform`** (`{ beastformId, viaEvolution }`).
 * **Evolution** also stores **`evolutionTraitKey`** (trait to add +1) — pass
 * `{ evolutionTraitKey }` from `activateChip` alongside `selectedId`.
 *
 * Declarative overlay (`applyDeclarativeFeatures`): merges beastform trait/evasion, virtual
 * natural weapon, `weaponRenderHints` disable for inventory weapons, and **`domainLoadoutDisabled`**.
 * `hooks.onStateChange` on **Beastform** clears beastform state when HP reaches 0.
 */

import { when } from '../engine/when.js';
import { queueInternalMutation } from '../engine/table.js';

function hasActiveBeastformInTable(table) {
  return table.me?.inBeastform === true;
}

function droppedToZeroHpWhileInBeastform(table) {
  const hp = table.me?.currentHP;
  if (hp == null || hp > 0) return false;
  return hasActiveBeastformInTable(table);
}

function clearBeastformState(table) {
  queueInternalMutation(table, 'setFeatureState', {
    featureKey: 'Beastform',
    key: 'activeBeastform',
    value: null,
  });
  queueInternalMutation(table, 'setFeatureState', {
    featureKey: 'Evolution',
    key: 'activeBeastform',
    value: null,
  });
  queueInternalMutation(table, 'setFeatureState', {
    featureKey: 'Evolution',
    key: 'evolutionTraitKey',
    value: null,
  });
}

const beastformHooks = {
  onStateChange: when(droppedToZeroHpWhileInBeastform, (table) => {
    clearBeastformState(table);
  }),
};

export const Evolution = {
  name: 'Evolution',
  description:
    'Spend 3 Hope to transform into a Beastform without marking a Stress. When you do, choose one trait to raise by +1 until you drop out of that Beastform.',
  hopeCost: 3,
  isDisabled: (table) => hasActiveBeastformInTable(table),
  isSelect: (table) => {
    const opts = table.me?.beastformOptions ?? [];
    return opts.map((o) => ({
      id: o.id,
      name: `${o.name} (Evolution)`,
      description: o.examples || '',
    }));
  },
  onUse(table, chip) {
    const id = chip.get('selectedId');
    if (!id) return;
    table.feature.set('activeBeastform', { beastformId: id, viaEvolution: true });
    const traitKey = chip.get('evolutionTraitKey');
    if (traitKey) table.feature.set('evolutionTraitKey', traitKey);
  },
};

export const Beastform = {
  name: 'Beastform',
  description:
    "Mark a Stress to magically transform into a creature of your tier or lower from the Beastform list. You can drop out of this form at any time. While transformed, you can't use weapons or cast spells from domain cards, but you can still use other features or abilities you have access to. Spells you cast before you transform stay active and last for their normal duration, and you can talk and communicate as normal. Additionally, you gain the Beastform's features, add their Evasion bonus to your Evasion, and use the trait specified in their statistics for your attack. While you're in a Beastform, your armor becomes part of your body and you mark Armor Slots as usual; when you drop out of a Beastform, those marked Armor Slots remain marked. If you mark your last Hit Point, you automatically drop out of this form.",
  stressCost: 1,
  isDisabled: (table) => hasActiveBeastformInTable(table),
  isSelect: (table) => {
    const opts = table.me?.beastformOptions ?? [];
    return opts.map((o) => ({
      id: o.id,
      name: o.name,
      description: o.examples || '',
    }));
  },
  onUse(table, chip) {
    const id = chip.get('selectedId');
    if (!id) return;
    table.feature.set('activeBeastform', { beastformId: id, viaEvolution: false });
  },
  hooks: beastformHooks,
};

export const Wildtouch = {
  name: 'Wildtouch',
  description:
    'You can perform harmless, subtle effects that involve nature—such as causing a flower to rapidly grow, summoning a slight gust of wind, or starting a campfire at will.',
};
