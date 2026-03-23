import { describe, it, expect } from 'vitest';
import {
  buildSubItemsFromV2RollDiePayloads,
  v2RollDieExtrasFromActionLoopPayload,
} from '../../src/client/lib/v2-action-notification-dice.js';

describe('buildSubItemsFromV2RollDiePayloads', () => {
  it('maps single d6 engine payload to server-shaped subItem', () => {
    expect(
      buildSubItemsFromV2RollDiePayloads([{ notation: 'd6', results: [4], total: 4 }])
    ).toEqual([
      {
        pre: 'Die',
        input: 'd6',
        result: '4',
        details: '(4)',
        post: '',
      },
    ]);
  });

  it('maps 2d6 with two results', () => {
    expect(
      buildSubItemsFromV2RollDiePayloads([{ notation: '2d6', results: [4, 5], total: 9 }])
    ).toEqual([
      {
        pre: 'Die',
        input: '2d6',
        result: '9',
        details: '(4+5)',
        post: '',
      },
    ]);
  });
});

describe('v2RollDieExtrasFromActionLoopPayload', () => {
  it('returns subItems and flag when _v2RollDiePayloads present', () => {
    expect(
      v2RollDieExtrasFromActionLoopPayload({
        _v2RollDiePayloads: [{ notation: 'd6', results: [3], total: 3 }],
      })
    ).toEqual({
      subItems: [
        { pre: 'Die', input: 'd6', result: '3', details: '(3)', post: '' },
      ],
      _v2AnimateDice: true,
    });
  });

  it('returns empty object when no payloads', () => {
    expect(v2RollDieExtrasFromActionLoopPayload({})).toEqual({});
    expect(v2RollDieExtrasFromActionLoopPayload({ _v2RollDiePayloads: [] })).toEqual({});
  });
});
