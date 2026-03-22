/**
 * Arcana domain spell — SRD: daggerheart-srd/abilities/Unleash Chaos.md
 */

function spellcastTraitValue(table) {
  const key = table.me?.spellcastTrait;
  if (!key || !table.me?.traits || typeof table.me.traits !== 'object') return 0;
  const v = table.me.traits[key];
  return Math.max(0, Number(v) || 0);
}

function spellcastTraitLabel(table) {
  const key = table.me?.spellcastTrait;
  if (!key || typeof key !== 'string') return 'Presence';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export const UnleashChaos = {
  name: 'Unleash Chaos',
  description:
    'At the beginning of a session, place a number of tokens equal to your Spellcast trait on this card.\n\nMake a **Spellcast Roll** against a target within Far range and spend any number of tokens to channel raw energy from within yourself to unleash against them. On a success, roll a number of **d10s** equal to the tokens you spent and deal that much magic damage to the target. **Mark a Stress** to replenish this card with tokens (up to your Spellcast trait).\n\nAt the end of each session, clear all unspent tokens.',
  hooks: {
    onSessionStart(table) {
      table.feature.set('unleashChaosTokens', spellcastTraitValue(table));
    },
  },
  chips: [
    {
      name: 'Replenish',
      placements: ['card'],
      stressCost: 1,
      description: 'Mark a Stress to refill tokens up to your Spellcast trait.',
      onUse(table) {
        table.feature.set('unleashChaosTokens', spellcastTraitValue(table));
      },
    },
    {
      name: 'Unleash Chaos',
      placements: ['card'],
      description:
        'Spellcast vs Far. Choose how many tokens to spend. On success, roll that many d10s as magic damage (GM resolves the roll).',
      isDisabled: (table) => (table.feature.get('unleashChaosTokens') ?? 0) < 1,
      isSelect: (table) => {
        const cur = table.feature.get('unleashChaosTokens') ?? 0;
        const n = Math.max(0, Math.floor(Number(cur)) || 0);
        if (n < 1) return [];
        return Array.from({ length: n }, (_, i) => {
          const k = i + 1;
          return {
            id: String(k),
            name: `${k} token${k === 1 ? '' : 's'}`,
            description: `Spend ${k} token(s). On success, roll ${k}d10 magic damage.`,
          };
        });
      },
      onUse(table, chip) {
        const id = chip.get('selectedId');
        const spend = parseInt(String(id), 10);
        const cur = table.feature.get('unleashChaosTokens') ?? 0;
        if (!Number.isFinite(spend) || spend < 1 || spend > cur) return;
        table.feature.set('unleashChaosTokens', cur - spend);
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Unleash Chaos',
          `Spellcast (${trait}) vs a target within Far range. You committed ${spend} token(s). On success, roll ${spend}d10 magic damage to the target.`,
          { trait }
        );
      },
    },
  ],
};
