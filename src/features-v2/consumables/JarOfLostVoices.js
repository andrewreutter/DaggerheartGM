/**
 * SRD consumable — Jar of Lost Voices (common roll table 47).
 * daggerheart-srd/consumables/Jar of Lost Voices.md
 */

export const JarOfLostVoices = {
  name: 'Jar of Lost Voices',
  description:
    'You can open this jar to release a deafening echo of voices for a number of minutes equal to your Instinct. Creatures within Far range unprepared for the sound take 6d8 magic damage.',
  onUse(table) {
    const instinct = Number(table.me.traits?.instinct ?? 0);
    const duration =
      instinct > 0
        ? `The echo lasts ${instinct} minute${instinct === 1 ? '' : 's'} (your Instinct score). `
        : 'The echo lasts a number of minutes equal to your Instinct. ';
    table.me.actionLoop(
      'Jar of Lost Voices',
      `${duration}Creatures within Far range who are unprepared for the sound take 6d8 magic damage each — the GM decides who was prepared. Roll damage as needed (e.g. 6d8 mag per target).`
    );
  },
};
