import { describe, it, expect } from 'vitest';
import { buildAdversaryFeatureTodoLines } from '../../scripts/lib/adversary-feature-todo-builder.mjs';

describe('buildAdversaryFeatureTodoLines', () => {
  it('tags Fear gain and trigger on a typical reaction', () => {
    const lines = buildAdversaryFeatureTodoLines({
      name: 'Momentum',
      type: 'reaction',
      description: 'When the Bear makes a successful attack against a PC, you gain a Fear.',
    });
    const flat = lines.join('\n');
    expect(flat).toMatch(/FEAR_GAIN/);
    expect(flat).toMatch(/TRIGGER/);
  });

  it('tags Fear spend on actions that spend Fear', () => {
    const lines = buildAdversaryFeatureTodoLines({
      name: 'Group Attack',
      type: 'action',
      description: '**Spend a Fear** to choose a target and spotlight all Giant Rats within Close range.',
    });
    expect(lines.join('\n')).toMatch(/FEAR_SPEND/);
  });
});
