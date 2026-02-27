import puppeteer from 'puppeteer';

const FCG_ORIGIN = 'https://freshcutgrass.app';
const ALLOWED_PATH_PREFIX = '/homebrew/';

export function validateFCGUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== FCG_ORIGIN) return false;
    if (!parsed.pathname.startsWith(ALLOWED_PATH_PREFIX)) return false;
    const username = parsed.pathname.slice(ALLOWED_PATH_PREFIX.length).split('/')[0];
    return username.length > 0;
  } catch {
    return false;
  }
}

// Map FCG role/type strings to our internal values
const ROLE_MAP = {
  bruiser:     'bruiser',
  skirmisher:  'skirmisher',
  minion:      'minion',
  leader:      'leader',
  artillery:   'artillery',
  horde:       'horde',
  solo:        'solo',
  standard:    'bruiser',
  elite:       'bruiser',
  support:     'leader',
  striker:     'skirmisher',
  controller:  'bruiser',
};

const ENV_TYPES = new Set(['traversal', 'exploration', 'social', 'event']);

function normRole(raw) {
  const lower = (raw || '').toLowerCase().trim();
  return ROLE_MAP[lower] || 'bruiser';
}

function normEnvType(raw) {
  const lower = (raw || '').toLowerCase().trim();
  return ENV_TYPES.has(lower) ? lower : 'event';
}

function isEnvType(raw) {
  const lower = (raw || '').toLowerCase().trim();
  return ENV_TYPES.has(lower);
}

function isEncounterType(raw) {
  return (raw || '').toLowerCase().trim() === 'encounter';
}


export async function scrapeFCG(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Suppress console noise from the SPA
    page.on('console', () => {});
    page.on('pageerror', () => {});

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for at least one card to appear
    await page.waitForSelector('.MuiCard-root', { timeout: 30000 });

    // Small extra wait for all cards to fully render
    await new Promise(r => setTimeout(r, 1500));

    // Get count of list-level cards (not inside modals)
    const cardCount = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('.MuiCard-root'));
      const modal = document.querySelector('[role="presentation"]');
      return all.filter(c => !modal || !modal.contains(c)).length;
    });

    if (cardCount === 0) {
      return { adversaries: [], environments: [], encounters: [] };
    }

    const adversaries = [];
    const environments = [];
    const encounters = [];

    for (let i = 0; i < cardCount; i++) {
      // Click the i-th list card
      await page.evaluate((idx) => {
        const modal = document.querySelector('[role="presentation"]');
        const all = Array.from(document.querySelectorAll('.MuiCard-root'));
        const listCards = all.filter(c => !modal || !modal.contains(c));
        const target = listCards[idx];
        if (target) {
          const btn = target.querySelector('button') || target;
          btn.click();
        }
      }, i);

      // Wait for modal to appear
      try {
        await page.waitForSelector('[role="presentation"] .MuiCard-root', { timeout: 8000 });
      } catch {
        // Card may not have opened a modal (e.g. non-adversary card) — skip
        continue;
      }

      // Small settle wait
      await new Promise(r => setTimeout(r, 400));

      // Extract all data from the modal
      const item = await page.evaluate(() => {
        const modal = document.querySelector('[role="presentation"]');
        if (!modal) return null;

        const card = modal.querySelector('.MuiCard-root');
        if (!card) return null;

        // ---- Role / Type badge ----
        // The badge text sits in the card header area, as a small label before the name.
        // We look for the tier number to find the header section, then grab sibling text.
        // Most reliably: scan all text nodes for known type names.
        const allText = card.innerText || card.textContent || '';

        // Extract the type from the first line area (it appears as a small badge label)
        // Walk through child elements in the card header region to find the badge
        let roleType = '';
        const cardContent = card.querySelector('.MuiCardContent-root');

        // The header (role badge + tier) sits above MuiCardContent-root.
        // The badge text is a short word like "Traversal", "Minion", "Standard", etc.
        const knownTypes = ['Traversal', 'Social', 'Exploration', 'Event', 'Encounter', 'Minion', 'Standard', 'Elite', 'Solo', 'Leader', 'Support', 'Bruiser', 'Striker', 'Controller', 'Artillery', 'Horde', 'Skirmisher'];
        // Walk ALL elements in the card to find the badge
        for (const el of card.querySelectorAll('*')) {
          const t = el.textContent.trim();
          if (knownTypes.includes(t) && el.children.length === 0) {
            roleType = t;
            break;
          }
        }

        // ---- Tier ----
        // Look for a standalone 1-4 number in the header region (above card content)
        let tier = 1;
        const headerArea = card.firstElementChild;
        for (const el of (headerArea ? headerArea.querySelectorAll('*') : [])) {
          if (cardContent && cardContent.contains(el)) continue;
          const t = el.textContent.trim();
          if (/^[1-4]$/.test(t) && el.children.length === 0) {
            tier = parseInt(t);
            break;
          }
        }

        if (!cardContent) return null;

        // ---- Name ----
        // The name is the first large-text element inside card content
        // Heuristic: first div/span child with non-trivial text and no sub-elements
        let name = '';
        for (const el of cardContent.querySelectorAll('*')) {
          const t = el.textContent.trim();
          if (t.length > 1 && t.length < 80 && el.children.length === 0) {
            name = t;
            break;
          }
        }

        // ---- Helper: find text following a label ----
        const findAfterLabel = (labelRe) => {
          const walker = document.createTreeWalker(cardContent, NodeFilter.SHOW_TEXT);
          let node;
          let found = false;
          while ((node = walker.nextNode())) {
            const t = node.textContent.trim();
            if (found && t.length > 0) return t;
            if (labelRe.test(t)) found = true;
          }
          return '';
        };

        // ---- Difficulty ----
        let difficulty = 10;
        const diffText = findAfterLabel(/^Difficulty:?$/i);
        if (diffText) difficulty = parseInt(diffText) || 10;
        // Also try inline "Difficulty: 12"
        const diffInline = allText.match(/Difficulty:\s*(\d+)/i);
        if (diffInline) difficulty = parseInt(diffInline[1]);

        // ---- Attack modifier ----
        let attackModifier = 0;
        const atkText = findAfterLabel(/^Attack:?$/i);
        if (atkText) attackModifier = parseInt(atkText) || 0;
        const atkInline = allText.match(/\bAttack:\s*([+-]?\d+)/i);
        if (atkInline) attackModifier = parseInt(atkInline[1]);

        // ---- HP & Stress ----
        let hp = null, stress = null;
        const hpInline = allText.match(/\bHP:\s*(\d+)/i);
        if (hpInline) hp = parseInt(hpInline[1]);
        const stressInline = allText.match(/\bSTRESS:\s*(\d+)/i);
        if (stressInline) stress = parseInt(stressInline[1]);

        // ---- Major / Severe thresholds ----
        let majorThreshold = null, severeThreshold = null;
        const majInline = allText.match(/Major.*?:\s*(\d+)/i);
        if (majInline) majorThreshold = parseInt(majInline[1]);
        const sevInline = allText.match(/Severe.*?:\s*(\d+)/i);
        if (sevInline) severeThreshold = parseInt(sevInline[1]);

        // ---- Motives & Tactics ----
        let motives = '';
        // Look for the text node right after the "Motives & Tactics:" label in the DOM
        const motiveWalker = document.createTreeWalker(cardContent, NodeFilter.SHOW_TEXT);
        let mNode, mFound = false;
        while ((mNode = motiveWalker.nextNode())) {
          const t = mNode.textContent.trim();
          if (mFound && t.length > 0) { motives = t; break; }
          if (/Motives\s*(&|and)\s*Tactics/i.test(t)) mFound = true;
        }

        // ---- Specific Attacks ("Name: Range | Damage") ----
        const attacks = [];
        // Look for elements whose text matches "Word(s): Range | Number"
        for (const el of cardContent.querySelectorAll('*')) {
          if (el.children.length > 0) continue;
          const t = el.textContent.trim();
          // Attack name element (bold/span) followed by sibling text "Range | Damage"
          // Typical pattern in DOM: <span>Shoot</span> then text node ": Far | 3"
          // We check the parent's full text
          if (t.length < 50) {
            const parent = el.parentElement;
            if (parent) {
              const parentText = parent.textContent.trim();
              const atkMatch = parentText.match(/^([^:]+):\s*(\w[\w\s]*)\s*\|\s*(\d+)/);
              if (atkMatch && attacks.findIndex(a => a.name === atkMatch[1].trim()) === -1) {
                attacks.push({
                  name: atkMatch[1].trim(),
                  range: atkMatch[2].trim(),
                  damage: parseInt(atkMatch[3]) || 0,
                });
              }
            }
          }
        }

        // ---- Features ----
        // Features section is delineated by a "Features" section header (card-divider)
        // Each feature has: Name - Type (icons) \n description \n [italics GM prompt]
        const features = [];

        const featureItems = [];
        let currentFeature = null;

        // Walk the DOM in order looking for feature blocks
        // Features live in a container after the "Features" section header
        // Use innerText lines for reliable ordered traversal
        const lines = (cardContent.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);

        // Find the "Features" heading line
        let featLineIdx = lines.findIndex(l => /^Features$/i.test(l));
        let hpLineIdx = lines.findIndex(l => /^HP\s*&\s*Stress$/i.test(l));
        if (hpLineIdx < 0) hpLineIdx = lines.length;

        if (featLineIdx >= 0) {
          const featureLines = lines.slice(featLineIdx + 1, hpLineIdx);

          // Parse features from lines. Pattern:
          // "FeatureName - Type" (possibly with trailing icon text like "Passive" or "Action")
          // Then description lines
          // Then optional GM prompt (italic, starts with a question word often)
          // Each new "Name - Type" line starts a new feature

          // Some features may have fear cost appended: "Name - Action  1" (icon + number)
          const featureHeaderRe2 = /^(.+?)\s+-\s+(Passive|Action|Reaction)/i;

          for (const line of featureLines) {
            const m = featureHeaderRe2.exec(line);
            if (m) {
              if (currentFeature) featureItems.push(currentFeature);
              // Fear cost: look for digits after the type
              const afterType = line.slice(m.index + m[0].length).trim();
              const fearMatch = afterType.match(/(\d+)/);
              currentFeature = {
                name: m[1].trim(),
                type: m[2].toLowerCase(),
                fearCost: fearMatch ? parseInt(fearMatch[1]) : null,
                descLines: [],
                gmPromptLines: [],
              };
            } else if (currentFeature) {
              // Heuristic: GM prompts are italicized questions (not parseable from innerText alone)
              // Use a simple heuristic: if the line ends with "?" it's likely a GM prompt
              if (line.endsWith('?')) {
                currentFeature.gmPromptLines.push(line);
              } else {
                currentFeature.descLines.push(line);
              }
            }
          }
          if (currentFeature) featureItems.push(currentFeature);
        }

        for (const f of featureItems) {
          const desc = f.descLines.join(' ').trim();
          const gmPrompt = f.gmPromptLines.join(' ').trim();
          const description = gmPrompt ? `${desc}\n\n${gmPrompt}` : desc;
          features.push({
            name: f.name,
            type: f.type,
            fearCost: f.fearCost,
            description,
          });
        }

        // ---- Description ----
        // The description is the short text right after the name, before stats/motives
        // In innerText it typically appears as the 2nd line (after name)
        let description = '';
        const nameIdx = lines.findIndex(l => l === name);
        if (nameIdx >= 0) {
          // Look at the next few lines for a description (before stat labels)
          const statLabels = /^(Difficulty|Attack|HP|Stress|Motives|Features|By\s)/i;
          for (let li = nameIdx + 1; li < Math.min(nameIdx + 5, lines.length); li++) {
            if (statLabels.test(lines[li])) break;
            if (lines[li].length > 5) { description = lines[li]; break; }
          }
        }

        return {
          name,
          roleType,
          tier,
          difficulty,
          attackModifier,
          hp,
          stress,
          majorThreshold,
          severeThreshold,
          motives,
          attacks,
          features,
          description,
          rawText: cardContent.innerText || '',
        };
      });

      // Close modal by clicking the X button or backdrop
      await page.evaluate(() => {
        // Try close button first
        const closeBtn = document.querySelector('[role="presentation"] button[aria-label="close"], [role="presentation"] button svg');
        if (closeBtn) {
          const btn = closeBtn.closest ? closeBtn.closest('button') : closeBtn;
          if (btn) { btn.click(); return; }
        }
        // Fall back: click backdrop
        const backdrop = document.querySelector('.MuiBackdrop-root');
        if (backdrop) backdrop.click();
      });

      await new Promise(r => setTimeout(r, 400));

      if (!item || !item.name) continue;

      // Categorize into adversary, environment, or encounter
      if (isEncounterType(item.roleType)) {
        encounters.push({
          name: item.name,
          description: item.description || '',
          tier: item.tier,
          features: item.features.map(f => ({
            name: f.name,
            type: f.type,
            description: f.description,
          })),
          rawText: item.rawText || '',
        });
      } else if (isEnvType(item.roleType)) {
        environments.push({
          name: item.name,
          description: item.description || '',
          features: item.features.map(f => ({
            name: f.name,
            type: f.type,
            description: f.description,
          })),
          tier: item.tier,
          type: normEnvType(item.roleType),
        });
      } else {
        // Build primary attack from the first specific attack + modifier
        const firstAtk = item.attacks[0];
        const attack = firstAtk
          ? {
              name: firstAtk.name,
              range: normalizeRange(firstAtk.range),
              modifier: item.attackModifier,
              trait: 'Phy',
              damage: `${firstAtk.damage}`,
            }
          : { name: '', range: 'Melee', modifier: item.attackModifier, trait: 'Phy', damage: '' };

        // Extra attacks become features
        const extraAtkFeatures = item.attacks.slice(1).map(a => ({
          name: a.name,
          type: 'action',
          description: `${item.attackModifier >= 0 ? '+' : ''}${item.attackModifier} ${normalizeRange(a.range)} | ${a.damage} phy`,
        }));

        adversaries.push({
          name: item.name,
          count: 1,
          description: item.description || '',
          motive: item.motives || '',
          difficulty: item.difficulty,
          hp_max: item.hp ?? 6,
          stress_max: item.stress ?? 3,
          hp_thresholds: {
            major: item.majorThreshold ?? Math.floor((item.hp ?? 6) / 2),
            severe: item.severeThreshold ?? (item.hp ?? 6),
          },
          attack,
          experiences: [],
          features: [
            ...extraAtkFeatures,
            ...item.features.map(f => ({
              name: f.name,
              type: f.type,
              description: f.description,
            })),
          ],
          tier: item.tier,
          role: normRole(item.roleType),
        });
      }
    }

    return { adversaries, environments, encounters };
  } finally {
    await browser.close();
  }
}

const RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];
function normalizeRange(raw) {
  if (!raw) return 'Melee';
  const lower = raw.toLowerCase().trim();
  return RANGES.find(r => r.toLowerCase() === lower) || 'Melee';
}

