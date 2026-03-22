/**
 * Syndicate subclass features — SRD: daggerheart-srd/subclasses/Syndicate.md
 */

import { when, isActing, isTargeted, hasDamage } from '../engine/when.js';

export const WellConnected = {
  name: 'Well-Connected',
  description:
    "When you arrive in a prominent town or environment, you know somebody who calls this place home. Give them a name, note how you think they could be useful, and choose one fact from the following list:\n\n- They owe me a favor, but they'll be hard to find.\n- They're going to ask for something in exchange.\n- They're always in a great deal of trouble.\n- We used to be together. It's a long story.\n- We didn't part on great terms.",
};

function contactsEverywhereSelectOptions(table) {
  const mastery = (table.me?.contactsEverywhereSessionUses ?? 1) >= 3;
  const base = [
    {
      id: 'gold',
      name: 'Gold, tool, or object',
      description: 'They provide 1 handful of gold, a unique tool, or a mundane object.',
    },
    {
      id: 'hopeFear',
      name: '+3 to Hope or Fear on your next action roll',
      description: 'Their help adds +3 to your Hope or Fear die result on your next action roll.',
    },
    {
      id: 'snipe',
      name: '+2d8 on next damage',
      description: 'The next time you deal damage, add 2d8 from the shadows.',
    },
  ];
  if (mastery) {
    base.push(
      {
        id: 'hpShield',
        name: 'Shielding contact (reduce HP marked)',
        description:
          'When you mark 1 or more Hit Points, they rush out to shield you, reducing the Hit Points marked by 1 (next time you take damage).',
      },
      {
        id: 'presenceD20',
        name: 'Conversation backup (d20 Hope die)',
        description:
          'When you make a Presence roll in conversation, they back you up — roll a d20 as your Hope Die for that roll.',
      }
    );
  }
  return base;
}

export const ContactsEverywhere = {
  name: 'Contacts Everywhere',
  description:
    'Once per session, you can briefly call on a shady contact. Choose one of the following benefits and describe what brought them here to help you in this moment:\n\n- They provide 1 handful of gold, a unique tool, or a mundane object that the situation requires.\n- On your next action roll, their help provides a +3 bonus to the result of your Hope or Fear Die.\n- The next time you deal damage, they snipe from the shadows, adding **2d8** to your damage roll.',
  hooks: {
    /** When **Reliable Backup** mastery option **presenceD20** was chosen, next Presence action roll uses d20 Hope die. */
    onIntent: when(
      isActing,
      (table) => table.action?.trait === 'presence',
      (table) => table.rolls?.action?.hopeDie != null,
      (table) => table.feature.get('conversationHopeD20') === true,
      (table) => {
        table.rolls.action.hopeDie.setDie('d20');
        table.feature.set('conversationHopeD20', false);
      }
    ),
    /** **hpShield** — reduce incoming HP damage by 1 once when you take damage. */
    onReviewAction: when(
      isTargeted,
      hasDamage,
      (table) => table.feature.get('pendingHpShield') === true,
      (table) => {
        table.action.reducePendingDamageForTarget(table.me.instanceId, 1);
        table.feature.set('pendingHpShield', false);
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      frequency: 'session',
      frequencyMaxUses: (table) => Math.max(1, table.me?.contactsEverywhereSessionUses ?? 1),
      description: 'Call on a shady contact — pick one benefit.',
      isSelect: contactsEverywhereSelectOptions,
      onUse(table, chip) {
        const id = chip.get('selectedId');
        if (id === 'gold') {
          table.me.actionLoop(
            'Contacts Everywhere',
            'Your contact provides 1 handful of gold, a unique tool, or a mundane object the situation requires (GM).'
          );
        } else if (id === 'hopeFear') {
          table.me.actionLoop(
            'Contacts Everywhere',
            'On your next action roll, add +3 to your Hope or Fear die result (GM).'
          );
        } else if (id === 'snipe') {
          table.me.actionLoop(
            'Contacts Everywhere',
            'The next time you deal damage, add 2d8 to your damage roll (GM).'
          );
        } else if (id === 'hpShield') {
          table.feature.set('pendingHpShield', true);
          table.me.actionLoop(
            'Contacts Everywhere',
            'Your contact will shield you — the next time you mark Hit Points, reduce the HP marked by 1 (GM).'
          );
        } else if (id === 'presenceD20') {
          table.feature.set('conversationHopeD20', true);
          table.me.actionLoop(
            'Contacts Everywhere',
            'On your next Presence roll in conversation, roll a d20 as your Hope Die (GM).'
          );
        }
      },
    },
  ],
};

/**
 * Mastery — **3× Contacts Everywhere per session** and two extra benefit options (see `contactsEverywhereSelectOptions`).
 */
export const ReliableBackup = {
  name: 'Reliable Backup',
  description:
    'You can use your "Contacts Everywhere" feature three times per session. The following options are added to the list of benefits you can choose from when you use that feature:\n\n- When you mark 1 or more Hit Points, they can rush out to shield you, reducing the Hit Points marked by 1.\n- When you make a Presence Roll in conversation, they back you up. You can roll a **d20** as your Hope Die.',
  contactsEverywhereSessionUses: 3,
};
