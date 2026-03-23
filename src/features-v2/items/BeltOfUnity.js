/**
 * SRD item — Belt of Unity (daggerheart-srd/items/Belt of Unity.md, roll 60)
 *
 * Tag Team resolution stays at the table; this wires session frequency, Hope cost, and a table notice.
 */

export const BeltOfUnity = {
  name: 'Belt of Unity',
  description:
    'Once per session, you can spend 5 Hope to lead a Tag Team Roll with three PCs instead of two.',
  hopeCost: 5,
  frequency: 'session',
  onUse(table) {
    table.me.actionLoop(
      'Belt of Unity',
      'Lead a Tag Team Roll with three PCs (instead of the usual two). Resolve the roll at the table per Tag Team rules.'
    );
  },
};
