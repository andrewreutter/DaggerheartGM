/**
 * Midnight domain — Specter of the Dark (Tier 3 domain spell / SRD level 10)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';

function clearSpectral(table) {
  table.feature.set('spectralActive', false);
}

/** True when the current action roll includes at least one target other than the actor. */
function targetsAnotherCreature(table) {
  const me = table.me?.instanceId;
  if (!me) return false;
  const ids = table.action?.targetInstanceIds ?? [];
  if (ids.length > 0) {
    return ids.some((id) => id !== me);
  }
  const t = table.action?.target?.instanceId;
  return t != null && t !== me;
}

function isActionRollThatEndsSpectral(table) {
  const t = table.action?.type;
  return (
    t === 'attack' ||
    t === 'spellcast' ||
    t === 'trait' ||
    t === 'action' ||
    t === 'reaction' ||
    t === 'tagTeam'
  );
}

function spectralEndPredicate(table) {
  return (
    table.feature.get('spectralActive') === true &&
    isActionRollThatEndsSpectral(table) &&
    targetsAnotherCreature(table)
  );
}

export const SpecterOfTheDark = {
  name: 'Specter of the Dark',
  description:
    '**Mark a Stress** to become _Spectral_ until you make an action roll targeting another creature. While _Spectral_, you\'re immune to physical damage and can float and pass through solid objects. Other creatures can still see you while you\'re in this form.',
  stressCost: 1,
  damageAffinities: {
    immunities: [when((table) => table.feature.get('spectralActive') === true, 'physical')],
  },
  hooks: {
    onIntent: when(isActing, spectralEndPredicate, clearSpectral),
  },
  onUse(table) {
    table.feature.set('spectralActive', true);
    table.me.actionLoop(
      'Specter of the Dark',
      'You mark 1 Stress and become Spectral: immune to physical damage, floating, able to pass through solid objects (others can still see you). This ends when you make an action roll targeting another creature.',
      {}
    );
  },
};
