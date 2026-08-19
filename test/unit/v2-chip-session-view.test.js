import { describe, it, expect } from 'vitest';
import {
  buildV2ChipViewer,
  getPrimaryCharacterInstanceId,
  getGmHelperBannerSuffix,
  getGmHelperBannerTooltip,
} from '../../src/client/lib/v2-chip-session-view.js';

describe('v2-chip-session-view', () => {
  const tableCharacters = [
    { instanceId: 'pc-a', assignedPlayerUid: 'uid-1', assignedPlayerEmail: 'a@x.com' },
    { instanceId: 'pc-b', assignedPlayerEmail: 'player@y.com' },
    { instanceId: 'pc-un', assignedPlayerEmail: '' },
    {
      instanceId: 'pc-multi',
      assignedPlayerEmail: 'a@x.com',
      assignedPlayerEmails: ['a@x.com', 'shared@x.com'],
    },
  ];

  describe('getPrimaryCharacterInstanceId', () => {
    it('resolves by uid first', () => {
      expect(
        getPrimaryCharacterInstanceId({
          tableCharacters,
          userUid: 'uid-1',
          playerEmailOrPreview: 'other@z.com',
        })
      ).toBe('pc-a');
    });

    it('resolves by email when uid does not match', () => {
      expect(
        getPrimaryCharacterInstanceId({
          tableCharacters,
          userUid: 'other',
          playerEmailOrPreview: 'player@y.com',
        })
      ).toBe('pc-b');
    });

    it('returns null when unassigned', () => {
      expect(
        getPrimaryCharacterInstanceId({
          tableCharacters,
          userUid: 'nope',
          playerEmailOrPreview: '',
        })
      ).toBe(null);
    });

    it('resolves by assignedPlayerEmails array when email is in the list', () => {
      expect(
        getPrimaryCharacterInstanceId({
          tableCharacters,
          userUid: 'uid-none',
          playerEmailOrPreview: 'shared@x.com',
        })
      ).toBe('pc-multi');
    });
  });

  describe('buildV2ChipViewer', () => {
    it('GM: sessionRole gm, viewer unscoped', () => {
      const r = buildV2ChipViewer({
        isPlayer: false,
        user: { uid: 'gm' },
        playerEmail: 'gm@x.com',
        tableCharacters,
      });
      expect(r.sessionRole).toBe('gm');
      expect(r.assignedCharacterInstanceId).toBe(null);
      expect(r.viewer).toEqual({ role: 'gm' });
    });

    it('player: viewerCharacterInstanceId matches assigned PC', () => {
      const r = buildV2ChipViewer({
        isPlayer: true,
        user: { uid: 'uid-1' },
        playerEmail: '',
        tableCharacters,
      });
      expect(r.sessionRole).toBe('player');
      expect(r.assignedCharacterInstanceId).toBe('pc-a');
      expect(r.viewer).toEqual({ role: 'player', viewerCharacterInstanceId: 'pc-a' });
    });

    it('preview-as-player email overrides playerEmail for lookup', () => {
      const r = buildV2ChipViewer({
        isPlayer: true,
        user: { uid: 'x' },
        playerEmail: 'gm@x.com',
        previewAsPlayerEmail: 'player@y.com',
        tableCharacters,
      });
      expect(r.assignedCharacterInstanceId).toBe('pc-b');
    });
  });

  describe('getGmHelperBannerSuffix', () => {
    const rollChar = { _attackerInstanceId: 'pc-a', _attackerType: 'character' };
    const rollAdv = { _attackerInstanceId: 'adv-1', _attackerType: 'adversary' };

    it('shows for GM + character attacker + assignee', () => {
      expect(
        getGmHelperBannerSuffix({
          sessionRole: 'gm',
          roll: rollChar,
          attackerElement: { assignedPlayerUid: 'u1' },
        })
      ).toBe(' · GM');
    });

    it('shows when assignee is email-only', () => {
      expect(
        getGmHelperBannerSuffix({
          sessionRole: 'gm',
          roll: rollChar,
          attackerElement: { assignedPlayerEmail: 'p@x.com' },
        })
      ).toBe(' · GM');
    });

    it('hides for player session', () => {
      expect(
        getGmHelperBannerSuffix({
          sessionRole: 'player',
          roll: rollChar,
          attackerElement: { assignedPlayerUid: 'u1' },
        })
      ).toBe('');
    });

    it('hides for adversary attacker', () => {
      expect(
        getGmHelperBannerSuffix({
          sessionRole: 'gm',
          roll: rollAdv,
          attackerElement: { assignedPlayerUid: 'u1' },
        })
      ).toBe('');
    });

    it('hides when PC has no assignee', () => {
      expect(
        getGmHelperBannerSuffix({
          sessionRole: 'gm',
          roll: rollChar,
          attackerElement: { assignedPlayerEmail: '' },
        })
      ).toBe('');
    });
  });

  describe('getGmHelperBannerTooltip', () => {
    it('returns hint text when suffix applies', () => {
      expect(
        getGmHelperBannerTooltip({
          sessionRole: 'gm',
          roll: { _attackerInstanceId: 'c1' },
          attackerElement: { assignedPlayerUid: 'u' },
        })
      ).toBe('GM acting for assigned player');
    });

    it('returns empty when suffix does not apply', () => {
      expect(
        getGmHelperBannerTooltip({
          sessionRole: 'player',
          roll: { _attackerInstanceId: 'c1' },
          attackerElement: { assignedPlayerUid: 'u' },
        })
      ).toBe('');
    });
  });
});
