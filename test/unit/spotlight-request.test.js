import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  buildSpotlightRequestNotification,
  findPendingSpotlightRequestForCharacter,
} from '../../src/client/lib/spotlight-request.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

describe('buildSpotlightRequestNotification', () => {
  it('builds a pending _action banner with a serializable resume payload', () => {
    const rollMeta = {
      _attackerInstanceId: 'pc-1',
      _intentPanelForActionRoll: true,
      _traitKey: 'agility',
    };
    const n = buildSpotlightRequestNotification({
      characterName: 'Ada',
      displayName: 'Ada Agility',
      rollText: 'Ada Agility Hope [d12] Fear [d12]',
      rollMeta,
    });
    expect(n._action).toBe(true);
    expect(n._spotlightRequest).toBe(true);
    expect(n.rollUser).toBe('Ada');
    expect(n.actionName).toBe('Agility');
    expect(n.actionText).toBe('Ada is requesting the spotlight to do Agility.');
    expect(n._attackerInstanceId).toBe('pc-1');
    expect(n._spotlightRequestResume).toEqual({
      rollText: 'Ada Agility Hope [d12] Fear [d12]',
      displayName: 'Ada Agility',
      rollMeta,
    });
  });

  it('clones rollMeta so functions are dropped', () => {
    const n = buildSpotlightRequestNotification({
      characterName: 'Ada',
      displayName: 'Ada Longsword',
      rollText: 'Ada Longsword [d20]',
      rollMeta: { _attackerInstanceId: 'pc-1', onClick: () => {} },
    });
    expect(n._spotlightRequestResume.rollMeta.onClick).toBeUndefined();
    expect(n._spotlightRequestResume.rollMeta._attackerInstanceId).toBe('pc-1');
  });
});

describe('findPendingSpotlightRequestForCharacter', () => {
  it('returns only that PC’s pending spotlight-request banners', () => {
    const banners = [
      { _spotlightRequest: true, _attackerInstanceId: 'pc-1', _rollDbId: 11 },
      { _spotlightRequest: true, _attackerInstanceId: 'pc-2', _rollDbId: 12 },
      { _action: true, _attackerInstanceId: 'pc-1', _rollDbId: 13 },
      { _spotlightRequest: true, _attackerInstanceId: 'pc-1' },
    ];
    expect(findPendingSpotlightRequestForCharacter(banners, 'pc-1')).toEqual([banners[0]]);
    expect(findPendingSpotlightRequestForCharacter(banners, 'pc-2')).toEqual([banners[1]]);
    expect(findPendingSpotlightRequestForCharacter(banners, null)).toEqual([]);
  });
});

describe('handlePlayerOwnRoll spotlight request wiring', () => {
  it('posts a request banner instead of only toasting when the player lacks spotlight', () => {
    const gm = readFileSync(join(root, 'src/client/components/GMTableView.jsx'), 'utf8');
    expect(gm).toMatch(/buildSpotlightRequestNotification/);
    expect(gm).toMatch(/resumeFromSpotlightGrant/);
    expect(gm).toMatch(/return 'spotlight-requested'/);
    expect(gm).not.toMatch(/showSpotlightBlockedHint\("You don't hold the spotlight\."\)/);
  });

  it('skips Devastating stress when sendWeaponRoll was a spotlight request', () => {
    const hover = readFileSync(join(root, 'src/client/components/CharacterHoverCard.jsx'), 'utf8');
    expect(hover).toMatch(/status === 'spotlight-requested'/);
    expect(hover).toMatch(/if \(status === 'spotlight-requested'\) return status;/);
  });

  it('tints ActionBanner yellow for _spotlightRequest and shows GM Cancel beside Acknowledge', () => {
    const dice = readFileSync(join(root, 'src/client/components/DiceRoller.jsx'), 'utf8');
    expect(dice).toMatch(/roll\._spotlightRequest === true/);
    expect(dice).toMatch(/border-yellow-400\/35 bg-yellow-400\/10/);
    expect(dice).toMatch(/roll\._sessionStart \|\| isSpotlightRequest \|\| actionAckTouchesTableState/);
  });
});
