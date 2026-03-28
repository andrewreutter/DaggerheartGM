/**
 * Builds taxonomized TODO lines for adversary feature modules from SRD description text.
 * Used by `scripts/apply-adversary-feature-todos.mjs`.
 */

const MAKES_ATTACK_RE = /\bmakes?\b.*?\battack\b/is;
const ATTACK_DESC_RE = /^([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*([^\s]+)\s+(\w+)$/i;
const RANGE_IN_ATTACK = /make an attack[^.]{0,160}\b(Melee|Very Close|Close|Far|Very Far)\b/i;
const STANDARD = /standard attack/i;
const DICE_PATTERN_RE = /\d+d\d+(?:[+-]\d+)?/gi;

function stripMd(s) {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentenceSplit(desc) {
  const t = String(desc || '').trim();
  if (!t) return [];
  const parts = t
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z*0-9•\-])/))
    .flatMap((line) => line.split(/\s*;\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const out = [];
  for (const p of parts) {
    if (p.startsWith('- ') || /^\d+\.\s/.test(p)) {
      out.push(p);
      continue;
    }
    const subs = p.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
    if (subs.length > 1) out.push(...subs);
    else out.push(p);
  }
  return out;
}

function mechanicalHint(s) {
  const t = String(s || '').trim();
  if (/^-\s*\d+\./.test(t) || /^•\s/.test(t)) return true;
  const x = stripMd(s).toLowerCase();
  return (
    /\b(attack|damage|deal|roll|hope|fear|stress|mark|spend|gain|lose|succeed|fail|reaction|threshold|hp|armor|range|within|close|far|melee|spotlight|describe|choose|target|advantage|disadvantage|difficulty|evasion|condition|restrained|vulnerable|hidden|poison|summon|teleport|flying|knock|direct magic|physical damage|magic damage)/i.test(
      x
    ) ||
    /\d+d\d+/.test(x) ||
    /\b(take|deal)\s+\d/.test(x)
  );
}

/**
 * @param {{ name: string, type: string, description: string, hasAffinities?: boolean, hasChips?: boolean, adversaryAuraReminder?: string }} p
 * @returns {string[]} lines without leading ` * `
 */
export function buildAdversaryFeatureTodoLines(p) {
  const { name, type, description: descRaw } = p;
  const auraSurfaced =
    typeof p.adversaryAuraReminder === 'string' && p.adversaryAuraReminder.trim() !== '';
  const desc = String(descRaw || '');
  const d = desc;
  const scope =
    type === 'action' ? 'ACTION' : type === 'reaction' ? 'REACTION' : 'PASSIVE';

  const line = (tag, text) => `${scope} [${tag}]: ${text}`;

  /** @type {Map<string, string>} key = scope::TAG::dedupeText */
  const m = new Map();

  function add(tag, text) {
    const k = `${scope}::${tag}::${text}`;
    if (!m.has(k)) m.set(k, line(tag, text));
  }

  if (!name) {
    add('DEFER', 'Fix module: missing `name` field.');
    return [...m.values()];
  }
  if (!desc) {
    add('DEFER', 'Fix module: missing `description` field.');
    return [...m.values()];
  }

  // --- Named families (passive) — full-line coverage + narrative if extra prose exists ---
  if (type === 'passive' && /^Horde\s*\(/i.test(name)) {
    add(
      'HORDE',
      'When half or more HP is marked, standard attack damage becomes this passive’s dice expression (per SRD).'
    );
    for (const sent of sentenceSplit(desc)) {
      if (!mechanicalHint(sent) && stripMd(sent).length > 20) {
        add('NARRATIVE_BANNER', `GM/table narration or flavor: ${stripMd(sent).slice(0, 220)}`);
      }
    }
    return [...m.values()].map((x) => ` * TODO ${x}`);
  }
  if (type === 'passive' && /^Minion\s*\(/i.test(name)) {
    const n = name.match(/\((\d+)\)/);
    add(
      'MINION',
      n
        ? `Defeat on any damage; for every ${n[1]} damage to this pool, defeat another minion in range (per SRD).`
        : 'Minion defeat-on-hit and spill rules (per SRD).'
    );
    for (const sent of sentenceSplit(desc)) {
      if (!mechanicalHint(sent) && stripMd(sent).length > 20) {
        add('NARRATIVE_BANNER', `GM/table narration or flavor: ${stripMd(sent).slice(0, 220)}`);
      }
    }
    return [...m.values()].map((x) => ` * TODO ${x}`);
  }
  if (type === 'passive' && /^Relentless\s*\(/i.test(name)) {
    add(
      'RELENTLESS',
      'Allow up to the stated number of spotlights per GM turn; Fear spend to spotlight unchanged (per SRD).'
    );
    for (const sent of sentenceSplit(desc)) {
      if (!mechanicalHint(sent) && stripMd(sent).length > 20) {
        add('NARRATIVE_BANNER', `GM/table narration or flavor: ${stripMd(sent).slice(0, 220)}`);
      }
    }
    return [...m.values()].map((x) => ` * TODO ${x}`);
  }

  // --- Explicit one-offs (passive) ---
  if (type === 'passive' && name === 'Ghost') {
    add(
      'AFFINITY',
      p.hasAffinities
        ? 'Physical resistance — registry has `damageAffinities`; ensure damage pipeline applies to adversaries.'
        : 'Physical resistance (per SRD).'
    );
    add('MOVEMENT', 'Mark Stress to move up to Close range through solid objects (not automated).');
    return [...m.values()].map((x) => ` * TODO ${x}`);
  }
  if (type === 'passive' && name === 'Terrifying') {
    if (!auraSurfaced) {
      add('AURA', 'Successful attack: PCs within Close lose Hope; GM gains Fear (not automated).');
    }
    add('TRACK', 'Card toggle is bookkeeping only; apply Hope/Fear manually per SRD.');
    return [...m.values()].map((x) => ` * TODO ${x}`);
  }

  const affinityOnly = [
    'Arcane Form',
    'Wards',
    'Obsidian Scales',
    'Only Bones',
    'Unyielding',
    'Warped Fortitude',
  ];
  if (type === 'passive' && affinityOnly.includes(name) && p.hasAffinities) {
    add(
      'AFFINITY',
      'Resistance line — registry has `damageAffinities`; ensure incoming damage respects type (per SRD).'
    );
    return [...m.values()].map((x) => ` * TODO ${x}`);
  }

  // --- Action shape buckets (same heuristics as gen-adversary-action-stubs) ---
  if (type === 'action') {
    const attackMatch = ATTACK_DESC_RE.exec(d);
    const forceAttack = !attackMatch && MAKES_ATTACK_RE.test(d);
    const dicePatterns = !attackMatch && !forceAttack && d ? [...d.matchAll(DICE_PATTERN_RE)] : [];
    if (attackMatch) {
      add('ATTACKSHAPED_RANGE', 'Descriptor + roll wiring for compact `+Range | damage trait` attack line (`adversary-roll-descriptors.js`).');
    } else if (forceAttack) {
      if (
        STANDARD.test(d) ||
        /shared attack|two targets|three targets|all .*within|each\.|Combine this damage/i.test(d)
      ) {
        add('ATTACKSHAPED_DAMAGE', 'Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).');
      } else if (RANGE_IN_ATTACK.test(d)) {
        add('ATTACKSHAPED_RANGE', 'Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).');
      } else {
        add('ATTACKSHAPED_DAMAGE', 'Descriptor + roll wiring for attack actions (`adversary-roll-descriptors.js`).');
      }
    } else if (dicePatterns.length > 0) {
      add('ACTIONSECONDARY', 'Secondary dice / saves / pools (`clientHoverUseRoll`, banner chips per authoring guide).');
    }
  }

  // --- Fear track (any type): explicit “Fear actions” / resource lines ---
  if (/\bspend\s+(a\s+)?fear\b/i.test(d) || /\*\*Spend a Fear\*\*/i.test(d)) {
    add('FEAR_SPEND', 'GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).');
  }
  if (/\bgain\s+(a\s+)?fear\b/i.test(d) || /\byou gain a fear\b/i.test(d) || /gain \*\*.*fear/i.test(d)) {
    add('FEAR_GAIN', 'GM gains Fear — wire to Fear track (per SRD trigger).');
  }

  // --- Phrase matchers (shared) ---
  if (/countdown/i.test(d)) {
    add('COUNTDOWN', 'Countdown activation, ticks, maximum value, and trigger effects (per SRD).');
  }
  if (/token on (their|the) stat block/i.test(d)) {
    add('TOKEN', 'Two-step spotlight token: first spotlight sets intent, second clears and acts (per SRD).');
  }
  if (/spend a handful of gold|handfuls of gold|handful of gold/i.test(d)) {
    add('GOLD', 'Gold pools, disadvantage bypass, HP-for-gold, attack bonus from gold (per SRD).');
  }
  if (/social actions|presence roll.*merchant|against the merchant/i.test(d)) {
    add('SOCIAL', 'Social roll modifiers, discounts, disadvantage on future rolls (per SRD).');
  }
  if (/resistant to|resistance to/i.test(d) && !p.hasAffinities) {
    add('AFFINITY', 'Damage type resistance — add `damageAffinities` and/or pipeline (per SRD).');
  }
  if (/immune to all damage|immune to/i.test(d)) {
    add('AFFINITY', 'Immunity or special damage rules (per SRD).');
  }
  if (/armor slot without receiving|mark an armor slot/i.test(d) && /without receiving|can't mark an armor slot/i.test(d)) {
    add('ARMOR', 'Target marks Armor Slot without benefit; if they cannot, mark extra HP instead (per SRD).');
  }
  if (/When .+ takes (physical )?damage, reduce it by/i.test(d) || /takes damage, reduce it by/i.test(d)) {
    add('DAMAGE', 'Flat or rolled damage reduction before thresholds (per SRD).');
  }
  if (/deal(s)? \*\*/i.test(d) && /instead of (their|the) standard damage/i.test(d)) {
    add('DAMAGE', 'Replace standard attack damage with stated dice under condition (per SRD).');
  }
  if (/double damage/i.test(d) || /deals double damage/i.test(d)) {
    add('DAMAGE', 'Double damage under stated condition (per SRD).');
  }
  if (/direct damage/i.test(d)) {
    add('DAMAGE', '“Direct damage” bypasses armor/threshold rules as per SRD table conventions.');
  }
  if (/half damage/i.test(d)) {
    add('DAMAGE', 'Half damage on success vs full on failure where stated (per SRD).');
  }
  if (/lose a hope|lose \*\*?\d*d?\d*\*\*? hope/i.test(d) || /they lose a hope/i.test(d)) {
    add('RESOURCE', 'PC Hope loss (per SRD trigger).');
  }
  if (/mark a stress|\*\*Mark a Stress\*\*/i.test(d)) {
    add('RESOURCE', 'Adversary Stress mark for movement/ability (per SRD).');
  }
  if (/can't spend hope to use features|can't spend hope/i.test(d)) {
    add('RESOURCE', 'Block or gate PC Hope spend on features vs this adversary (per SRD).');
  }
  if (/both physical and magic|physical and magic/i.test(d)) {
    add('DAMAGE', 'Standard attack damage counts as both physical and magic for thresholds/tags (per SRD).');
  }
  if (/roll \*\*2d4\*\*|attack modifier/i.test(d) && /2d4/i.test(d)) {
    add('ROLL', 'Use rolled dice as attack modifier instead of static mod (per SRD).');
  }
  if (/After making a standard attack,.*move anywhere|After making a standard attack/i.test(d) && /move anywhere within Far range/i.test(d)) {
    add('MOVEMENT', 'After standard attack, reposition within stated range (per SRD).');
  }
  if (/disadvantage/i.test(d)) {
    add('ROLL', 'Disadvantage on stated rolls (per SRD).');
  }
  if (/\badvantage\b/i.test(d) && !/disadvantage/i.test(d)) {
    add('ROLL', 'Advantage on stated attacks or rolls (per SRD).');
  }
  if (/reaction roll|Reaction Roll/i.test(d)) {
    add('ROLL', 'Reaction rolls (trait as stated) and outcomes (per SRD).');
  }
  if (/evasion is halved/i.test(d) || /Evasion is halved/i.test(d)) {
    add('EVASION', 'Halve target Evasion against stated attacks (per SRD).');
  }
  if (/bonus to (their )?difficulty/i.test(d) || /\+[0-9]+ bonus to (their )?difficulty/i.test(d)) {
    add('DIFFICULTY', 'Difficulty modifier while condition holds (per SRD).');
  }
  if (/teleport/i.test(d)) {
    add('MOVEMENT', 'Teleport timing, range, and costs (per SRD).');
  }
  if (/While flying|while .+ is flying|Divine Flight|Deadly Flight|Flight\b|Flying\b|Levitation/i.test(d)) {
    add('MOVEMENT', 'Flying movement, range swaps, and rider rules (per SRD).');
    if (/spend a fear.*far range/i.test(d)) {
      add('FEAR_SPEND', 'Fear spend to extend movement before action (per SRD).');
    }
  }
  if (/knocked back|knock(?:s)? back/i.test(d)) {
    add('MOVEMENT', 'Forced movement range (per SRD).');
  }
  if (/from one shadow to another|through stone and earth|through solid objects/i.test(d)) {
    add('MOVEMENT', 'Special movement or phasing (per SRD).');
  }
  if (/Climber\b|^Climber/i.test(name)) {
    add('MOVEMENT', 'Climb speed / vertical movement (per SRD).');
  }
  if (/_Vulnerable_|_Restrained_|_Hidden_|_Glow|_Entranced_|_Guilty_|become(s)? _/i.test(d)) {
    add('CONDITION', 'Apply/remove conditions on targets (per SRD).');
  }
  if (/summon/i.test(d)) {
    add('SUMMON', 'Summon placement, tier, and count (per SRD).');
  }
  if (/attack all targets|against two targets|make their standard attack against/i.test(d)) {
    add('MULTI_TARGET', 'Multi-target or sweep attacks (per SRD).');
  }
  if (/spotlight/i.test(d) && !/^Relentless/i.test(name)) {
    add('SPOTLIGHT', 'Spotlight/Fear interactions (per SRD).');
  }
  if (
    !auraSurfaced &&
    /Within (Close|Far|Melee|Very (Close|Far)) range/i.test(d) &&
    /(lose|gain|hope|fear|stress|disadvantage)/i.test(d)
  ) {
    add('AURA', 'Range-limited effect on PCs (per SRD).');
  }
  if (/environmental damage|earthquake|avalanche|rubble/i.test(d)) {
    add('ENVIRONMENT', 'Environmental hazard damage and Restrained from terrain (per SRD).');
  }
  if (/head/i.test(d) && /Hydra|heads?/i.test(d)) {
    add('HEAD', 'Head count, lose head on Major+ damage, spotlight cap (per SRD).');
  }
  if (/Major or greater damage.*additional hp|additional hp.*physical/i.test(d)) {
    add('DAMAGE', 'Extra HP marks on threshold (per SRD).');
  }
  if (/construct|zombie hulk|patchwork/i.test(d) && /additional hp/i.test(d)) {
    add('CONSTRUCT', 'Construct brittle/extra HP rules (per SRD).');
  }
  if (p.hasChips) {
    add('TRACK', 'Card chips are UI helpers; remaining mechanics manual unless wired.');
  }

  // --- Reactions: trigger window ---
  if (type === 'reaction' && /^when\b/i.test(stripMd(d))) {
    add('TRIGGER', 'Reaction window — detect event, optional costs, then resolve (per SRD).');
  }
  if (type === 'reaction' && /make a standard attack/i.test(d)) {
    add('ATTACK', 'Roll / apply standard attack from statblock (`adversary-roll-descriptors.js`).');
  }

  // --- Describe / flavor that should still surface as action notification banner ---
  if (/\bdescribe\b/i.test(d)) {
    add('NARRATIVE_BANNER', '“Describe …” — post action-notification / banner prompt for GM (no dice).');
  }

  // --- Per-sentence narrative coverage ---
  const covered = m.size > 0;
  for (const sent of sentenceSplit(desc)) {
    const st = stripMd(sent);
    if (st.length < 12) continue;
    if (mechanicalHint(sent)) continue;
    add('NARRATIVE_BANNER', `Purely narrative / reminder clause — banner or log only: ${st.slice(0, 240)}`);
  }

  if (!covered && m.size === 0) {
    add('SRD', 'Automate or surface each clause in `description` (tag by area: damage, rolls, resources, movement).');
  }

  return [...m.values()].map((x) => ` * TODO ${x}`);
}
