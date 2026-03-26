import { describe, it, expect } from 'vitest';
import {
  applyChargedProficiencyBonusToRollText,
  applyDevastatingDamageRewriteToRollText,
} from '../../src/client/lib/weapon-roll-text.js';

describe('applyDevastatingDamageRewriteToRollText', () => {
  it('rewrites damage bracket to d20 and updates Devastating tag', () => {
    const t =
      'A Sword Hope [d12] Fear [d12] Agility [2] damage [d8] phy {Devastating: test}';
    expect(applyDevastatingDamageRewriteToRollText(t)).toBe(
      'A Sword Hope [d12] Fear [d12] Agility [2] damage [d20] phy {Devastating: d20 damage die, mark 1 Stress (active)}'
    );
  });
});

describe('applyChargedProficiencyBonusToRollText', () => {
  it('inserts Charged [+1] before damage and updates tag', () => {
    const t =
      'A Rapier Hope [d12] Fear [d12] Agility [2] damage [d8] phy {Charged: old}';
    expect(applyChargedProficiencyBonusToRollText(t)).toBe(
      'A Rapier Hope [d12] Fear [d12] Agility [2] Charged [+1] damage [d8] phy {Charged: +1 Proficiency on this attack (mark 1 Stress)}'
    );
  });
});
