/**
 * Druid class features — per-feature descriptors.
 *
 * SRD (class): Becoming a druid is more than an occupation; it's a calling for those who wish to learn from and protect
 * the magic of the wilderness. Through years of study and dedication, druids can learn to transform into beasts and
 * shape nature itself.
 *
 * SRD (Beastform): Mark a Stress to magically transform into a creature of your tier or lower from the Beastform list.
 * You can drop out of this form at any time. While transformed, you can't use weapons or cast spells from domain
 * cards, but you can still use other features or abilities. You gain the Beastform's features, add their Evasion
 * bonus to your Evasion, and use the trait specified in their statistics for your attack. If you mark your last Hit
 * Point, you automatically drop out of this form.
 *
 * SRD (Evolution, Hope): **Spend 3 Hope** to transform into a Beastform without marking a Stress. When you do, choose
 * one trait to raise by +1 until you drop out of that Beastform.
 *
 * Implementation: Beastform/Evolution — onFeatureActivated set activeBeastform from roll._beastform. Drop out —
 * onFeatureActivated clear activeBeastform. Elemental Incarnation — onFeatureActivated set activeChanneledElement;
 * onDamageReceived clear on Severe.
 */

/** @type {Record<string, object>} */
const features = {
  Beastform: {
    name: 'Beastform',
    class: 'Druid',
    onFeatureActivated({ selfEl, updateActiveElement, roll }) {
      if (!selfEl?.instanceId || !roll?._beastform) return;
      updateActiveElement(selfEl.instanceId, { activeBeastform: roll._beastform });
    },
  },

  Evolution: {
    name: 'Evolution',
    class: 'Druid',
    onFeatureActivated({ selfEl, updateActiveElement, roll }) {
      if (!selfEl?.instanceId || !roll?._beastform) return;
      updateActiveElement(selfEl.instanceId, { activeBeastform: roll._beastform });
    },
  },

  'Drop out of Beastform': {
    name: 'Drop out of Beastform',
    class: 'Druid',
    onFeatureActivated({ selfEl, updateActiveElement }) {
      if (!selfEl?.instanceId) return;
      updateActiveElement(selfEl.instanceId, { activeBeastform: null, selectedBeastformAdvantage: null });
    },
  },

  'Elemental Incarnation': {
    name: 'Elemental Incarnation',
    class: 'Druid',
    forceActionNotification: true,
    onFeatureActivated({ subFeatureName, selfEl }) {
      if (!selfEl?.instanceId) return;
      const sub = (subFeatureName ?? '').toLowerCase();
      const element = ['fire', 'earth', 'water', 'air'].find(e => sub.includes(e)) ?? null;
      selfEl.setFlag('activeChanneledElement', element);
    },
    onDamageReceived({ character, hpLoss }) {
      if (hpLoss >= 3 && character.activeChanneledElement) {
        character.setFlag('activeChanneledElement', null);
      }
    },
  },
};

export default features;
