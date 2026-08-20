import { describe, it, expect } from 'vitest';
import {
  applyHelpAllyToIntent,
  collectIntentHelpCostRows,
  collectRollResourceCostRows,
  defaultHelpLabel,
  eligibleHelpCharacters,
  formatHelpAllyRollSuffix,
  mergeHelpAllyEntry,
  mergePendingResourceCostMaps,
  pickPlayerHelpCharacter,
  remainingHopeForCharacter,
  resolveHeldHelpAllyRows,
  splitHelpAllySuffix,
  subtractPendingResourceCostRows,
  validateHelpAllyRequest,
} from '../../src/client/lib/help-an-ally.js';
import {
  applyOwnPoolToRollText,
  extractOwnPoolFromRollText,
} from '../../src/client/lib/advantage-disadvantage-pool.js';

const ada = {
  instanceId: 'ada',
  elementType: 'character',
  name: 'Ada',
  hope: 3,
  maxHope: 6,
  assignedPlayerUid: 'player-a',
  assignedPlayerEmail: 'a@example.com',
};
const beau = {
  instanceId: 'beau',
  elementType: 'character',
  name: 'Beau',
  hope: 2,
  maxHope: 6,
  assignedPlayerUid: 'player-b',
  assignedPlayerEmail: 'b@example.com',
};
const cara = {
  instanceId: 'cara',
  elementType: 'character',
  name: 'Cara',
  hope: 0,
  maxHope: 6,
};
const elements = [ada, beau, cara];
const GM = { role: 'gm', uid: 'gm-1', email: 'gm@example.com' };
const PLAYER_B = { role: 'player', uid: 'player-b', email: 'b@example.com' };
const PLAYER_A = { role: 'player', uid: 'player-a', email: 'a@example.com' };

const tableIntent = {
  intentId: 'int-1',
  characterInstanceId: 'ada',
  _rollVisibility: 'table',
  pending: { meta: { _attackerInstanceId: 'ada' } },
  helps: [],
};

describe('defaultHelpLabel / mergeHelpAllyEntry', () => {
  it('defaults to "{name} helps"', () => {
    expect(defaultHelpLabel('Ada')).toBe('Ada helps');
    expect(defaultHelpLabel('')).toBe('Ally helps');
  });

  it('upserts and removes by instanceId', () => {
    const once = mergeHelpAllyEntry([], { instanceId: 'beau', label: 'Beau helps' });
    expect(once).toHaveLength(1);
    expect(once[0].die).toBe('d6');
    expect(once[0].hopeCost).toBe(1);
    const two = mergeHelpAllyEntry(once, { instanceId: 'cara', label: 'Cara helps' });
    expect(two.map((h) => h.instanceId)).toEqual(['beau', 'cara']);
    const relabel = mergeHelpAllyEntry(two, { instanceId: 'beau', label: 'Beau assists' });
    expect(relabel[0].label).toBe('Beau assists');
    expect(mergeHelpAllyEntry(relabel, { instanceId: 'beau', active: false })).toHaveLength(1);
    expect(mergeHelpAllyEntry(relabel, { instanceId: 'cara', remove: true })).toHaveLength(1);
  });
});

describe('eligibleHelpCharacters / pickPlayerHelpCharacter', () => {
  it('returns no one on a reaction', () => {
    expect(eligibleHelpCharacters({
      actorInstanceId: 'ada',
      activeElements: elements,
      viewer: GM,
      isReaction: true,
    })).toEqual([]);
  });

  it('excludes the actor; GM sees every other PC', () => {
    const ids = eligibleHelpCharacters({
      actorInstanceId: 'ada',
      activeElements: elements,
      viewer: GM,
    }).map((c) => c.instanceId);
    expect(ids).toEqual(['beau', 'cara']);
  });

  it('players only see their assigned PCs that are not the actor', () => {
    expect(eligibleHelpCharacters({
      actorInstanceId: 'ada',
      activeElements: elements,
      viewer: PLAYER_B,
    }).map((c) => c.instanceId)).toEqual(['beau']);
    expect(eligibleHelpCharacters({
      actorInstanceId: 'ada',
      activeElements: elements,
      viewer: PLAYER_A,
    })).toEqual([]);
  });

  it('picks the primary assigned character unless that PC is the actor', () => {
    const extra = {
      instanceId: 'beau-2',
      elementType: 'character',
      name: 'Beau Two',
      assignedPlayerUid: 'player-b',
      assignedPlayerEmail: 'b@example.com',
    };
    expect(pickPlayerHelpCharacter({
      actorInstanceId: 'ada',
      activeElements: [ada, extra, beau],
      viewer: PLAYER_B,
    })?.instanceId).toBe('beau-2');
    expect(pickPlayerHelpCharacter({
      actorInstanceId: 'beau-2',
      activeElements: [ada, extra, beau],
      viewer: PLAYER_B,
    })?.instanceId).toBe('beau');
  });
});

describe('formatHelpAllyRollSuffix / splitHelpAllySuffix', () => {
  const beau = { instanceId: 'beau', label: 'Beau helps' };
  const cara = { instanceId: 'cara', label: 'Cara helps' };

  it('formats one d6 and keep-highest for two d6s', () => {
    expect(formatHelpAllyRollSuffix([beau])).toBe(' Beau helps [d6]');
    expect(formatHelpAllyRollSuffix([beau, cara])).toBe(' Beau helps and Cara helps [2d6kh]');
  });

  it('lists mixed dice individually', () => {
    expect(formatHelpAllyRollSuffix([
      { ...beau, die: 'd8' },
      { ...cara, die: 'd6' },
    ])).toBe(' Beau helps [d8] and Cara helps [d6]');
  });

  it('splits a trailing help block using helps', () => {
    const { text, helpSuffix } = splitHelpAllySuffix('Ada Agility [d12] [d12] Beau helps [d6]', [beau]);
    expect(text).toBe('Ada Agility [d12] [d12]');
    expect(helpSuffix).toBe(' Beau helps [d6]');
  });

  it('still splits a leftover — help: prefix', () => {
    const { text, helpSuffix } = splitHelpAllySuffix('Ada Agility [d12] [d12] — help: Beau helps [d6]');
    expect(text).toBe('Ada Agility [d12] [d12]');
    expect(helpSuffix).toBe(' — help: Beau helps [d6]');
  });
});

describe('own-pool extract ignores help suffix', () => {
  const base = 'Ada Agility [d12] [d12]';
  const helps = [{ instanceId: 'beau', label: 'Beau helps' }];

  it('does not treat helper names as own-pool advantage', () => {
    const withHelp = `${base} Beau helps [d6]`;
    const extracted = extractOwnPoolFromRollText(withHelp, { helps });
    expect(extracted.advantageNames).toEqual([]);
    expect(extracted.disadvantageNames).toEqual([]);
    expect(extracted.strippedText).toBe(base);
    expect(extracted.helpSuffix).toBe(' Beau helps [d6]');
  });

  it('keeps help after own-pool rewrite (and after cancelled)', () => {
    const withBoth = `${base} Aim [d6] — cancelled: Cover vs Retract Beau helps [d6]`;
    const extracted = extractOwnPoolFromRollText(withBoth, { helps });
    expect(extracted.advantageNames).toEqual(['Aim']);
    expect(extracted.helpSuffix).toBe(' Beau helps [d6]');
    const next = applyOwnPoolToRollText(withBoth, { disadvantageNames: ['Retract'], helps });
    expect(next).toContain(' Beau helps [d6]');
    expect(next.endsWith(' Beau helps [d6]')).toBe(true);
  });

  it('still ignores a leftover — help: block without helps', () => {
    const withHelp = `${base} — help: Beau helps [d6]`;
    const extracted = extractOwnPoolFromRollText(withHelp);
    expect(extracted.advantageNames).toEqual([]);
    expect(extracted.strippedText).toBe(base);
    expect(extracted.helpSuffix).toBe(' — help: Beau helps [d6]');
  });
});

describe('pending-cost rows', () => {
  it('returns attacker costs plus each helper Hope', () => {
    expect(collectRollResourceCostRows({
      _attackerInstanceId: 'ada',
      _hopeCost: 1,
      _experienceHopeCost: 1,
      _helpAlly: [{ instanceId: 'beau', hopeCost: 1 }, { instanceId: 'cara', hopeCost: 1 }],
    })).toEqual([
      { instanceId: 'ada', hope: 2, stress: 0, armorMark: 0, armorClear: 0 },
      { instanceId: 'beau', hope: 1, stress: 0, armorMark: 0, armorClear: 0 },
      { instanceId: 'cara', hope: 1, stress: 0, armorMark: 0, armorClear: 0 },
    ]);
  });

  it('merges intent help rows onto an existing cost map', () => {
    const merged = mergePendingResourceCostMaps(
      { ada: { hope: 1, stress: 0, armorMark: 0, armorClear: 0 } },
      collectIntentHelpCostRows([{ instanceId: 'beau', hopeCost: 1 }]),
    );
    expect(merged.beau.hope).toBe(1);
    expect(merged.ada.hope).toBe(1);
  });

  it('subtracts helper rows on cancel', () => {
    const next = subtractPendingResourceCostRows(
      { beau: { hope: 1, stress: 0, armorMark: 0, armorClear: 0 } },
      collectIntentHelpCostRows([{ instanceId: 'beau', hopeCost: 1 }]),
    );
    expect(next.beau).toBeUndefined();
  });

  it('remaining Hope subtracts queued costs', () => {
    expect(remainingHopeForCharacter(beau, { beau: { hope: 1 } })).toBe(1);
    expect(remainingHopeForCharacter(cara, {})).toBe(0);
  });

  it('drops held helps once a matching roll is in the banner queue', () => {
    expect(resolveHeldHelpAllyRows({
      pendingIntent: { intentId: 'int-1', helps: [{ instanceId: 'beau' }] },
      held: { intentId: 'int-1', helps: [{ instanceId: 'beau' }] },
      pendingBanners: [{ _preRollIntentId: 'int-1' }],
    })).toEqual([]);
    expect(resolveHeldHelpAllyRows({
      pendingIntent: null,
      held: { intentId: 'int-1', helps: [{ instanceId: 'beau', hopeCost: 1 }] },
      pendingBanners: [],
    })).toEqual([{ instanceId: 'beau', hopeCost: 1 }]);
  });
});

describe('validateHelpAllyRequest / applyHelpAllyToIntent', () => {
  it('409s when the intent is gone or the id mismatches', () => {
    expect(validateHelpAllyRequest({
      intent: null, intentId: 'int-1', instanceId: 'beau', active: true, viewer: PLAYER_B, helperEl: beau,
    }).status).toBe(409);
    expect(validateHelpAllyRequest({
      intent: tableIntent, intentId: 'other', instanceId: 'beau', active: true, viewer: PLAYER_B, helperEl: beau,
    }).status).toBe(409);
  });

  it('403s when a player is not assigned to that PC', () => {
    expect(validateHelpAllyRequest({
      intent: tableIntent, intentId: 'int-1', instanceId: 'cara', active: true, viewer: PLAYER_B, helperEl: cara,
    }).status).toBe(403);
  });

  it('400s on reaction, self-help, unknown PC, or no Hope', () => {
    expect(validateHelpAllyRequest({
      intent: { ...tableIntent, pending: { meta: { _isReaction: true } } },
      intentId: 'int-1', instanceId: 'beau', active: true, viewer: PLAYER_B, helperEl: beau,
    }).status).toBe(400);
    expect(validateHelpAllyRequest({
      intent: tableIntent, intentId: 'int-1', instanceId: 'ada', active: true, viewer: GM, isGm: true, helperEl: ada,
    }).error).toMatch(/yourself/);
    expect(validateHelpAllyRequest({
      intent: tableIntent, intentId: 'int-1', instanceId: 'ghost', active: true, viewer: GM, isGm: true, helperEl: null,
    }).error).toMatch(/Unknown/);
    expect(validateHelpAllyRequest({
      intent: tableIntent, intentId: 'int-1', instanceId: 'cara', active: true, viewer: GM, isGm: true, helperEl: cara,
    }).error).toMatch(/Hope/);
  });

  it('allows a label update on an existing help row even with 0 Hope', () => {
    const withHelp = { ...tableIntent, helps: [{ instanceId: 'cara', label: 'Cara helps', hopeCost: 1 }] };
    expect(validateHelpAllyRequest({
      intent: withHelp, intentId: 'int-1', instanceId: 'cara', active: true, viewer: GM, isGm: true, helperEl: cara,
    }).ok).toBe(true);
  });

  it('merges only that row onto the intent', () => {
    const added = applyHelpAllyToIntent(tableIntent, {
      instanceId: 'beau',
      active: true,
      helperEl: beau,
      viewer: PLAYER_B,
    });
    expect(added.helps).toHaveLength(1);
    expect(added.helps[0].label).toBe('Beau helps');
    expect(added.helps[0].playerEmail).toBe('b@example.com');
    const gone = applyHelpAllyToIntent(added, { instanceId: 'beau', active: false });
    expect(gone.helps).toEqual([]);
  });
});
