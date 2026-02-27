import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { 
  Users, Map, ShieldAlert, Swords, BookOpen, LayoutDashboard, 
  Plus, Trash2, Edit, Play, Search, Heart, Zap, AlertCircle, X, Copy
} from 'lucide-react';

// --- Firebase Initialization ---
const { firebaseConfig } = await fetch('/api/config').then(r => r.json());
let app, auth;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch(e) {
  console.error('Firebase initialization failed:', e);
}

// --- Constants & Enums ---
const ROLES = ['bruiser', 'skirmisher', 'minion', 'leader', 'artillery', 'horde', 'solo'];
const ENV_TYPES = ['traversal', 'exploration', 'social', 'event'];
const FEATURE_TYPES = ['action', 'reaction', 'passive'];
const TIERS = [1, 2, 3, 4];
const DAMAGE_TYPES = ['Phy', 'Mag', 'Dir'];
const RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];

// --- Helper Functions ---
const generateId = () => crypto.randomUUID();

const parseFeatureCategory = (feature) => {
  if (!feature.description) return 'Actions';
  const desc = feature.description;
  if (/spend.*fear/i.test(desc) || /mark.*fear/i.test(desc)) return 'Fear Actions';
  if (feature.type === 'reaction') return 'Reactions';
  if (feature.type === 'passive') return 'Passives';
  return 'Actions';
};

// --- Rolz Markdown Parser ---
function parseRolzMarkdown(text) {
  const lines = text.split('\n');

  // Strip BBCode tags for display text
  const stripBB = (s) => s.replace(/\[\/?\w+[^\]]*\]/g, '').trim();

  // Extract image URL
  const imgMatch = text.match(/\[img\s+(https?:\/\/[^\]]+)\]/);
  const imageUrl = imgMatch ? imgMatch[1].trim() : null;

  // Find scene name from first single-= heading (not ==)
  let sceneName = '';
  for (const line of lines) {
    const m = line.match(/^=(?!=)\s*(.+)/);
    if (m) {
      // Strip trailing "N BP" budget point annotation
      sceneName = m[1].replace(/\s+\d+\s+BP\s*$/i, '').trim();
      break;
    }
  }

  // Split into sections on ==heading lines
  const sectionBlocks = [];
  let current = null;
  for (const line of lines) {
    if (/^==(?!=)/.test(line)) {
      if (current) sectionBlocks.push(current);
      current = { header: line.replace(/^==\s*/, '').trim(), bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    }
  }
  if (current) sectionBlocks.push(current);

  const environments = [];
  const adversaries = [];

  for (const section of sectionBlocks) {
    const body = section.bodyLines.join('\n');
    const isAdversary = /\[const\s+HP\b/i.test(body);

    if (!isAdversary) {
      // --- Environment ---
      const name = section.header;
      // Description: text before [b]FEATURES[/b]
      const featuresMarkerIdx = body.search(/\[b\]FEATURES\[\/b\]/i);
      const descBlock = featuresMarkerIdx >= 0 ? body.slice(0, featuresMarkerIdx) : body;
      const description = descBlock.split('\n')
        .map(l => stripBB(l))
        .filter(l => l.length > 0)
        .join('\n')
        .trim();

      const features = featuresMarkerIdx >= 0
        ? parseFeatures(body.slice(featuresMarkerIdx))
        : [];

      environments.push({ name, description, features, tier: 1, type: 'event' });
    } else {
      // --- Adversary ---
      // Name and optional count from header: "Name x2"
      const countMatch = section.header.match(/^(.+?)\s+x(\d+)\s*$/i);
      const advName = countMatch ? countMatch[1].trim() : section.header;
      const count = countMatch ? parseInt(countMatch[2]) : 1;

      // Description: lines before [b]Motives
      const motivesIdx = body.search(/\[b\]Motives/i);
      const hrIdx = body.search(/\[hr\]/i);
      const descEnd = motivesIdx >= 0 ? motivesIdx : (hrIdx >= 0 ? hrIdx : 0);
      const description = body.slice(0, descEnd).split('\n')
        .map(l => stripBB(l))
        .filter(l => l.length > 0)
        .join('\n')
        .trim();

      // Motives
      let motive = '';
      const motiveMatch = body.match(/\[b\]Motives[^[]*\[\/b\]\s*(.*?)(?:\[hr\]|\[b\]FEATURES|\[button|$)/is);
      if (motiveMatch) motive = stripBB(motiveMatch[1]).trim();

      // Stats
      const diffMatch = body.match(/\[const\s+DIFFICULTY\s+(\d+)\]/i);
      const hpMatch = body.match(/\[const\s+HP\s+(\d+)\]/i);
      const stressMatch = body.match(/\[const\s+STRESS\s+(\d+)\]/i);
      const threshMatch = body.match(/\[const\s+THRESHOLDS\s+(\d+)\s*\/\s*(\d+)\]/i);

      const difficulty = diffMatch ? parseInt(diffMatch[1]) : 10;
      const hp_max = hpMatch ? parseInt(hpMatch[1]) : 6;
      const stress_max = stressMatch ? parseInt(stressMatch[1]) : 3;
      const hp_thresholds = threshMatch
        ? { major: parseInt(threshMatch[1]), severe: parseInt(threshMatch[2]) }
        : { major: 3, severe: 6 };

      // Experiences: [b]Experiences[/b]: Name +N, Name +N
      const experiences = [];
      const expMatch = body.match(/\[b\]Experiences\[\/b\]\s*:?\s*([^\n\[]+)/i);
      if (expMatch) {
        const expStr = expMatch[1].trim();
        const expParts = expStr.split(',').map(s => s.trim()).filter(Boolean);
        for (const part of expParts) {
          const em = part.match(/^(.+?)\s*\+(\d+)$/);
          if (em) experiences.push({ id: generateId(), name: em[1].trim(), modifier: parseInt(em[2]) });
        }
      }

      // Attacks: [button Name {d20+N}, {damage trait}] Range
      // Pattern: [button <label> {d20+N}, {dmg type}] <range>
      const buttonRe = /\[button\s+(.+?)\s+\{d20([+-]\d+)\},\s*\{([^}]+)\}\]\s*([^\n\[]*)/gi;
      const buttonMatches = [...body.matchAll(buttonRe)];

      let attack = { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' };
      const extraAttackFeatures = [];

      for (let i = 0; i < buttonMatches.length; i++) {
        const bm = buttonMatches[i];
        const atkName = bm[1].trim();
        const mod = parseInt(bm[2]);
        // damage+trait: e.g. "d8+5 phy" or "d10+4 phy"
        const dtParts = bm[3].trim().split(/\s+/);
        const damage = dtParts[0] || '';
        const rawTrait = dtParts[1] || 'phy';
        const trait = rawTrait.charAt(0).toUpperCase() + rawTrait.slice(1).toLowerCase();
        // Normalize trait to Phy/Mag/Dir
        const traitNorm = ['Mag', 'Dir'].includes(trait) ? trait : 'Phy';
        const rangeRaw = bm[4].trim();
        // Map range to RANGES list (case-insensitive prefix match)
        const rangeNorm = RANGES.find(r => r.toLowerCase() === rangeRaw.toLowerCase()) || 'Melee';

        if (i === 0) {
          attack = { name: atkName, range: rangeNorm, modifier: mod, trait: traitNorm, damage };
        } else {
          extraAttackFeatures.push({
            id: generateId(),
            name: atkName,
            type: 'action',
            description: `${mod >= 0 ? '+' : ''}${mod} ${rangeNorm} | ${damage} ${traitNorm.toLowerCase()}`
          });
        }
      }

      // Features (after [b]FEATURES[/b])
      const featuresMarkerIdx = body.search(/\[b\]FEATURES\[\/b\]/i);
      const parsedFeatures = featuresMarkerIdx >= 0
        ? parseFeatures(body.slice(featuresMarkerIdx))
        : [];

      const features = [...extraAttackFeatures, ...parsedFeatures];

      adversaries.push({
        name: advName,
        count,
        description,
        motive,
        difficulty,
        hp_max,
        stress_max,
        hp_thresholds,
        attack,
        experiences,
        features,
        tier: 1,
        role: 'bruiser'
      });
    }
  }

  return { sceneName, imageUrl, environments, adversaries };
}

// Parse features from a block starting at [b]FEATURES[/b]
function parseFeatures(block) {
  const features = [];
  // Match bold-tagged feature headers: [b]Name - Type[/b]: or [b]Name - Type: cost.[/b]
  // We look for [b]...[/b] patterns that aren't just "FEATURES"
  const featureRe = /\[b\](?!FEATURES\b)([^\]]+?)\[\/b\][:.]?\s*([\s\S]*?)(?=\[b\](?!.*\[\/b\].*\[b\])|\s*$)/gi;

  // Simpler approach: split on [b] to get each feature chunk
  const parts = block.split(/\[b\]/);
  for (const part of parts) {
    if (!part.trim() || /^FEATURES/i.test(part.trim())) continue;
    // part looks like: "Feature Name - Type[/b]: description..."
    const closeIdx = part.indexOf('[/b]');
    if (closeIdx < 0) continue;
    const header = part.slice(0, closeIdx).trim();
    const descRaw = part.slice(closeIdx + 4).trim();

    // Strip leading colon/period
    const descClean = descRaw.replace(/^[:.]?\s*/, '');

    // Infer type from header suffix
    let featureName = header;
    let featureType = 'action';

    const typeMatch = header.match(/^(.+?)\s+-\s+(Passive|Action|Reaction)(?:\s*:\s*(.+))?$/i);
    if (typeMatch) {
      featureName = typeMatch[1].trim();
      featureType = typeMatch[2].toLowerCase();
      // If there's inline cost after "- Action: Cost", prepend it to description
      const inlineCost = typeMatch[3];
      const description = inlineCost
        ? `${inlineCost.trim()} ${stripAllBB(descClean)}`.trim()
        : stripAllBB(descClean);
      if (featureName && description) {
        features.push({ id: generateId(), name: featureName, type: featureType, description });
      }
      continue;
    }

    // Check for "Spend N Fear" or "Spend a Fear" pattern for fear actions
    const isFear = /spend\s+\w+\s+fear/i.test(header) || /spend\s+\w+\s+fear/i.test(descClean);
    if (isFear) featureType = 'action';

    const description = stripAllBB(header.replace(/^(.+?)(?:\s*:\s*.+)?$/, (_, n) => '') + ' ' + descClean).trim();
    // For features without a type suffix, keep the full header as the name
    const cleanName = stripAllBB(header).trim();
    if (cleanName) {
      features.push({ id: generateId(), name: cleanName, type: featureType, description: stripAllBB(descClean) });
    }
  }

  return features.filter(f => f.name && f.name.length > 0);
}

function stripAllBB(s) {
  return s.replace(/\[\/?\w+[^\]]*\]/g, '').trim();
}

// --- Rolz Export ---

// Returns { adversaryId -> prefix } with no duplicate prefixes.
// Filler words are skipped when building initials.  If initials collide,
// characters are progressively borrowed from each word in order; a numeric
// suffix is appended as a last resort.
function generatePrefixes(advEntries) {
  const FILLER = { of:1, the:1, a:1, an:1, and:1, in:1, at:1, by:1, for:1, to:1 };

  const sigWords = (name) => {
    const words = name.trim().split(/\s+/).filter(w => !FILLER[w.toLowerCase()]);
    return words.length > 0 ? words : name.trim().split(/\s+/);
  };

  const makePrefix = (words, exp) =>
    words.map((w, i) => w.slice(0, exp[i]).toUpperCase()).join('');

  // Enumerate all possible prefixes for a name: expand chars word-by-word,
  // then fall back to numeric suffixes.
  const prefixCandidates = (words) => {
    const candidates = [];
    const exp = words.map(() => 1);
    candidates.push(makePrefix(words, exp.slice()));
    let advanced = true;
    while (advanced) {
      advanced = false;
      for (let i = 0; i < words.length; i++) {
        if (exp[i] < words[i].length) {
          exp[i]++;
          advanced = true;
          candidates.push(makePrefix(words, exp.slice()));
          break;
        }
      }
    }
    const base = makePrefix(words, exp);
    for (let n = 2; n <= 30; n++) candidates.push(base + n);
    return candidates;
  };

  // Deduplicate by ID using a plain object, then sort by name for determinism
  const seen = {};
  const unique = [];
  for (let i = 0; i < advEntries.length; i++) {
    const e = advEntries[i];
    if (!seen[e.id]) { seen[e.id] = true; unique.push(e); }
  }
  unique.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

  const used = {};
  const result = {};

  for (let i = 0; i < unique.length; i++) {
    const entry = unique[i];
    const candidates = prefixCandidates(sigWords(entry.name));
    let prefix = null;
    for (let j = 0; j < candidates.length; j++) {
      if (!used[candidates[j]]) { prefix = candidates[j]; break; }
    }
    if (!prefix) prefix = 'A' + (i + 1); // ultimate fallback
    used[prefix] = true;
    result[entry.id] = prefix;
  }

  return result;
}

// Render a single feature as a Rolz line.
// If the description matches the compact attack format produced by the parser
// ("+N Range | damage trait"), re-emit it as a clickable [button].
const ATTACK_DESC_RE = /^([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*([^\s]+)\s+(\w+)$/i;

function featureToRolzLine(f) {
  const m = f.description && ATTACK_DESC_RE.exec(f.description);
  if (m && f.type === 'action') {
    const mod = parseInt(m[1]);
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    return `[button ${f.name} {d20${modStr}}, {${m[3]} ${m[4].toLowerCase()}}] ${m[2]}`;
  }
  const typeCap = f.type ? f.type.charAt(0).toUpperCase() + f.type.slice(1) : 'Action';
  return `[b]${f.name} - ${typeCap}[/b]: ${f.description || ''}`;
}

function adversaryToRolz(adv, count, prefix) {
  count = count || 1;
  const lines = [];

  lines.push(count > 1 ? `==${adv.name} x${count}` : `==${adv.name}`);
  if (adv.description) lines.push(adv.description);
  if (adv.motive) lines.push(`[b]Motives & Tactics:[/b] ${adv.motive}`);

  lines.push('[hr]');
  lines.push(`[const DIFFICULTY ${adv.difficulty || 10}] [const THRESHOLDS ${adv.hp_thresholds?.major || 0} / ${adv.hp_thresholds?.severe || 0}]`);

  if (count === 1) {
    lines.push(`[field ${prefix}_HP] of [const HP ${adv.hp_max || 0}] [field ${prefix}_STRESS] of [const STRESS ${adv.stress_max || 0}]`);
  } else {
    lines.push(Array.from({ length: count }, (_, i) => `[field ${prefix}${i + 1}_HP]`).join('') + ` of [const HP ${adv.hp_max || 0}]`);
    lines.push(Array.from({ length: count }, (_, i) => `[field ${prefix}${i + 1}_STRESS]`).join('') + ` of [const STRESS ${adv.stress_max || 0}]`);
  }

  if (adv.attack?.name) {
    const mod = adv.attack.modifier || 0;
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    const trait = (adv.attack.trait || 'phy').toLowerCase();
    lines.push(`[button ${adv.attack.name} {d20${modStr}}, {${adv.attack.damage} ${trait}}] ${adv.attack.range || 'Melee'}`);
  }

  if (adv.experiences?.length > 0) {
    lines.push(`[b]Experiences[/b]: ${adv.experiences.map(e => `${e.name} +${e.modifier}`).join(', ')}`);
  }

  if (adv.features?.length > 0) {
    lines.push('[hr]');
    lines.push('[b]FEATURES[/b]');
    for (const f of adv.features) lines.push(featureToRolzLine(f));
  }

  return lines.join('\n');
}

function environmentToRolz(env) {
  const lines = [];
  lines.push(`==${env.name}`);
  if (env.description) lines.push(env.description);
  if (env.features?.length > 0) {
    lines.push('[b]FEATURES[/b]');
    for (const f of env.features) lines.push(featureToRolzLine(f));
  }
  return lines.join('\n');
}

function generateRolzExport(item, tab, data) {
  const sections = ['[type note]'];

  if (tab === 'adversaries') {
    const prefix = generatePrefixes([{ id: item.id, name: item.name }])[item.id];
    sections.push(adversaryToRolz(item, 1, prefix));

  } else if (tab === 'environments') {
    sections.push(environmentToRolz(item));

  } else if (tab === 'groups') {
    // Deduplicate adversary references by ID, summing counts
    const advRefObj = {};
    const advRefOrder = [];
    for (let ri = 0; ri < (item.adversaries || []).length; ri++) {
      const ref = item.adversaries[ri];
      const adv = (data.adversaries || []).filter(a => a.id === ref.adversaryId)[0];
      if (!adv) continue;
      if (advRefObj[adv.id]) { advRefObj[adv.id].count += ref.count || 1; }
      else { advRefObj[adv.id] = { adv: adv, count: ref.count || 1 }; advRefOrder.push(adv.id); }
    }
    const groupAdvEntries = advRefOrder.map(id => ({ id: id, name: advRefObj[id].adv.name }));
    const prefixes = generatePrefixes(groupAdvEntries);
    for (let ri = 0; ri < advRefOrder.length; ri++) {
      const entry = advRefObj[advRefOrder[ri]];
      sections.push(adversaryToRolz(entry.adv, entry.count, prefixes[entry.adv.id]));
    }

  } else if (tab === 'scenes') {
    sections.push('=' + item.name);
    if (item.imageUrl) sections.push('[img ' + item.imageUrl + ']');

    for (let ei = 0; ei < (item.environments || []).length; ei++) {
      const env = (data.environments || []).filter(e => e.id === item.environments[ei])[0];
      if (env) sections.push(environmentToRolz(env));
    }

    // Collect adversary refs from groups then direct, deduplicating by ID
    const advRefObj = {};
    const advRefOrder = [];
    for (let gi = 0; gi < (item.groups || []).length; gi++) {
      const group = (data.groups || []).filter(g => g.id === item.groups[gi])[0];
      if (!group) continue;
      for (let ri = 0; ri < (group.adversaries || []).length; ri++) {
        const ref = group.adversaries[ri];
        const adv = (data.adversaries || []).filter(a => a.id === ref.adversaryId)[0];
        if (!adv) continue;
        if (advRefObj[adv.id]) { advRefObj[adv.id].count += ref.count || 1; }
        else { advRefObj[adv.id] = { adv: adv, count: ref.count || 1 }; advRefOrder.push(adv.id); }
      }
    }
    for (let ri = 0; ri < (item.adversaries || []).length; ri++) {
      const ref = item.adversaries[ri];
      const adv = (data.adversaries || []).filter(a => a.id === ref.adversaryId)[0];
      if (!adv) continue;
      if (advRefObj[adv.id]) { advRefObj[adv.id].count += ref.count || 1; }
      else { advRefObj[adv.id] = { adv: adv, count: ref.count || 1 }; advRefOrder.push(adv.id); }
    }

    const sceneAdvEntries = advRefOrder.map(id => ({ id: id, name: advRefObj[id].adv.name }));
    const prefixes = generatePrefixes(sceneAdvEntries);
    for (let ri = 0; ri < advRefOrder.length; ri++) {
      const entry = advRefObj[advRefOrder[ri]];
      sections.push(adversaryToRolz(entry.adv, entry.count, prefixes[entry.adv.id]));
    }
  }

  return sections.join('\n\n');
}

// --- Main Application Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home'); // home, gm-table, library

  // Data State
  const [data, setData] = useState({
    adversaries: [],
    environments: [],
    groups: [],
    scenes: [],
    adventures: []
  });

  // GM Table State
  const [activeElements, setActiveElements] = useState([]);
  const [highlightedInstance, setHighlightedInstance] = useState(null);

  // --- Google Sign-In ---
  const handleGoogleSignIn = async () => {
    if (!auth) { console.error('Firebase auth not initialized — check .env credentials'); return; }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Sign-In Error:', err);
    }
  };

  // --- Data Loading ---
  const loadData = async (currentUser) => {
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/data', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fetched = await res.json();
      setData(fetched);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  // --- Auth ---
  useEffect(() => {
    if (!auth) { setLoading(false); return; }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadData(currentUser);
        if (view === 'home') setView('library');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Database Mutations ---
  const saveItem = async (collectionName, item) => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/data/${collectionName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
      setData(prev => {
        const existing = prev[collectionName].findIndex(i => i.id === saved.id);
        const updated = existing >= 0
          ? prev[collectionName].map(i => i.id === saved.id ? saved : i)
          : [...prev[collectionName], saved];
        return { ...prev, [collectionName]: updated };
      });
    } catch (err) {
      console.error(`saveItem(${collectionName}) failed:`, err);
    }
  };

  const deleteItem = async (collectionName, id) => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/data/${collectionName}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(prev => ({
        ...prev,
        [collectionName]: prev[collectionName].filter(i => i.id !== id),
      }));
    } catch (err) {
      console.error(`deleteItem(${collectionName}, ${id}) failed:`, err);
    }
  };

  // --- GM Table Logic ---
  const triggerHighlight = (instanceId) => {
    setHighlightedInstance(instanceId);
    setTimeout(() => setHighlightedInstance(null), 1500);
  };

  const addToTable = (element, type) => {
    const instance = {
      ...element,
      instanceId: generateId(),
      elementType: type,
      currentHp: element.hp_max || 0,
      currentStress: 0,
      conditions: ''
    };
    setActiveElements(prev => [...prev, instance]);
  };

  const startScene = (scene) => {
    const newElements = [];
    
    // Add Environments
    scene.environments?.forEach(envId => {
      const env = data.environments.find(e => e.id === envId);
      if (env) newElements.push({ ...env, instanceId: generateId(), elementType: 'environment' });
    });

    // Add Direct Adversaries
    scene.adversaries?.forEach(advRef => {
      const adv = data.adversaries.find(a => a.id === advRef.adversaryId);
      if (adv) {
        for (let i = 0; i < advRef.count; i++) {
          newElements.push({ ...adv, instanceId: generateId(), elementType: 'adversary', currentHp: adv.hp_max, currentStress: 0, conditions: '' });
        }
      }
    });

    // Add Groups
    scene.groups?.forEach(groupId => {
      const group = data.groups.find(g => g.id === groupId);
      if (group) {
        group.adversaries?.forEach(advRef => {
          const adv = data.adversaries.find(a => a.id === advRef.adversaryId);
          if (adv) {
            for (let i = 0; i < advRef.count; i++) {
              newElements.push({ ...adv, instanceId: generateId(), elementType: 'adversary', currentHp: adv.hp_max, currentStress: 0, conditions: '', groupName: group.name });
            }
          }
        });
      }
    });

    setActiveElements(newElements);
    setView('gm-table');
  };

  const updateActiveElement = (instanceId, updates) => {
    setActiveElements(prev => prev.map(el => el.instanceId === instanceId ? { ...el, ...updates } : el));
  };

  const removeActiveElement = (instanceId) => {
    setActiveElements(prev => prev.filter(el => el.instanceId !== instanceId));
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans flex flex-col">
      {/* Top Navigation */}
      {user && (
        <nav className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-red-500 tracking-wider flex items-center gap-2">
              <Swords size={24} /> DAGGERHEART GM
            </h1>
            <div className="flex gap-2">
              <NavBtn icon={<BookOpen />} label="Library" active={view === 'library'} onClick={() => setView('library')} />
              <NavBtn icon={<LayoutDashboard />} label="GM Table" active={view === 'gm-table'} onClick={() => setView('gm-table')} />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex flex-col items-end">
              <span className="text-green-500 font-medium">
                {user.displayName || user.email || 'Signed In'}
              </span>
              <span className="text-[10px] opacity-60 font-mono">
                {user.email}
              </span>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!user || view === 'home' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-900 to-slate-950">
            <Swords size={64} className="text-red-500 mb-6" />
            <h1 className="text-4xl font-bold text-white mb-2">Daggerheart GM Tool</h1>
            <p className="text-slate-400 mb-8 text-center max-w-md">Build adversaries, environments, and run your encounters seamlessly with integrated action tracking.</p>
            <button 
              onClick={handleGoogleSignIn}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-red-900/20"
            >
              <Users size={20} /> Sign In with Google
            </button>
          </div>
        ) : view === 'library' ? (
          <LibraryView data={data} saveItem={saveItem} deleteItem={deleteItem} startScene={startScene} />
        ) : (
          <GMTableView 
            activeElements={activeElements} 
            highlightedInstance={highlightedInstance}
            triggerHighlight={triggerHighlight}
            updateActiveElement={updateActiveElement}
            removeActiveElement={removeActiveElement}
            data={data}
            addToTable={addToTable}
            startScene={startScene}
          />
        )}
      </main>
    </div>
  );
}

// --- Sub-Components ---

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      }`}
    >
      {React.cloneElement(icon, { size: 18 })}
      {label}
    </button>
  );
}

// --- LIBRARY VIEW ---
function LibraryView({ data, saveItem, deleteItem, startScene }) {
  const [activeTab, setActiveTab] = useState('adversaries');
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const [showRolzImport, setShowRolzImport] = useState(false);
  const [showFCGImport, setShowFCGImport] = useState(false);
  const [pendingNav, setPendingNav] = useState(null); // { collection, id }

  // After a Rolz import, navigate to the created item once data updates
  React.useEffect(() => {
    if (!pendingNav) return;
    const item = data[pendingNav.collection]?.find(i => i.id === pendingNav.id);
    if (item) {
      setActiveTab(pendingNav.collection);
      setViewingItem(item);
      setEditingItem(null);
      setPendingNav(null);
    }
  }, [data, pendingNav]);

  const singularNames = { adversaries: 'Adversary', environments: 'Environment', groups: 'Group', scenes: 'Scene', adventures: 'Adventure' };

  const tabs = [
    { id: 'adversaries', label: 'Adversaries', icon: <ShieldAlert size={18} /> },
    { id: 'environments', label: 'Environments', icon: <Map size={18} /> },
    { id: 'groups', label: 'Groups', icon: <Users size={18} /> },
    { id: 'scenes', label: 'Scenes', icon: <Play size={18} /> },
    { id: 'adventures', label: 'Adventures', icon: <BookOpen size={18} /> },
  ];

  const handleSave = async (item) => {
    const itemToSave = { ...item };
    if (editingItem && editingItem.id && !itemToSave.id) {
      itemToSave.id = editingItem.id;
    }
    await saveItem(activeTab, itemToSave);
    setEditingItem(null);
  };

  const handleExport = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.href = url;
    downloadAnchorNode.download = "daggerheart_db.json";
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    document.body.removeChild(downloadAnchorNode);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportStatus('Importing...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        const collections = ['adversaries', 'environments', 'groups', 'scenes', 'adventures'];
        for (const colName of collections) {
          if (importedData[colName]) {
            for (const item of importedData[colName]) {
              await saveItem(colName, item);
            }
          }
        }
        setImportStatus('Done!');
        setTimeout(() => setImportStatus(''), 2000);
      } catch (err) {
        setImportStatus('Error!');
        setTimeout(() => setImportStatus(''), 2000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar Tabs */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 font-semibold text-slate-300 uppercase tracking-wider text-xs">Database</div>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setEditingItem(null); setViewingItem(null); }}
            className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
              activeTab === tab.id ? 'bg-slate-800 text-red-400 border-r-2 border-red-500' : 'text-slate-400 hover:bg-slate-800/50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Rolz Import Modal */}
      {showRolzImport && (
        <RolzImportModal
          onClose={() => setShowRolzImport(false)}
          saveItem={saveItem}
          onImportSuccess={(collection, id) => {
            setShowRolzImport(false);
            setPendingNav({ collection, id });
          }}
        />
      )}

      {/* FreshCutGrass Import Modal */}
      {showFCGImport && (
        <FCGImportModal
          onClose={() => setShowFCGImport(false)}
          saveItem={saveItem}
          onImportSuccess={(collection, id) => {
            setShowFCGImport(false);
            setPendingNav({ collection, id });
          }}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white capitalize">{activeTab}</h2>
          
          <div className="flex items-center gap-3">
            {importStatus && <span className="text-xs text-green-400 font-medium">{importStatus}</span>}
            <button onClick={handleExport} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors">
              Export JSON
            </button>
            <label className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors cursor-pointer">
              Import JSON
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={() => setShowRolzImport(true)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded transition-colors border border-slate-700 hover:border-amber-700"
            >
              Import Rolz Markdown
            </button>
            <button
              onClick={() => setShowFCGImport(true)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-green-400 hover:text-green-300 px-3 py-1.5 rounded transition-colors border border-slate-700 hover:border-green-800"
            >
              Import FreshCutGrass
            </button>

            {!editingItem && !viewingItem && (
              <button 
                onClick={() => { setEditingItem({}); setViewingItem(null); }} 
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium ml-2"
              >
                <Plus size={16} /> New {singularNames[activeTab]}
              </button>
            )}
          </div>
        </div>

        {editingItem ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-xl max-w-4xl">
            {activeTab === 'adversaries' && <AdversaryForm initial={editingItem} onSave={handleSave} onCancel={() => setEditingItem(null)} />}
            {activeTab === 'environments' && <EnvironmentForm initial={editingItem} onSave={handleSave} onCancel={() => setEditingItem(null)} />}
            {activeTab === 'groups' && <GroupForm initial={editingItem} data={data} onSave={handleSave} onCancel={() => setEditingItem(null)} />}
            {activeTab === 'scenes' && <SceneForm initial={editingItem} data={data} onSave={handleSave} onCancel={() => setEditingItem(null)} />}
            {activeTab === 'adventures' && <AdventureForm initial={editingItem} data={data} onSave={handleSave} onCancel={() => setEditingItem(null)} />}
          </div>
        ) : viewingItem ? (
          <ItemDetailView
            item={viewingItem}
            tab={activeTab}
            data={data}
            onEdit={() => { setEditingItem(viewingItem); setViewingItem(null); }}
            onClose={() => setViewingItem(null)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data[activeTab].map(item => (
              <div key={item.id} onClick={() => setViewingItem(item)} className="bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-colors flex flex-col group overflow-hidden">
                {item.imageUrl && (
                  <div className="w-full h-32 overflow-hidden bg-slate-950">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-white group-hover:text-red-400 transition-colors">{item.name}</h3>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    {activeTab === 'scenes' && (
                      <button onClick={() => startScene(item)} className="text-green-500 hover:text-green-400" title="Start Scene">
                        <Play size={16} />
                      </button>
                    )}
                    <button onClick={() => { setEditingItem(item); setViewingItem(null); }} className="text-slate-400 hover:text-blue-400"><Edit size={16} /></button>
                    <button onClick={() => deleteItem(activeTab, item.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="text-sm text-slate-400 flex-1">
                  {activeTab === 'adversaries' && `Tier ${item.tier || 0} ${item.role}`}
                  {activeTab === 'environments' && `Tier ${item.tier || 0} ${item.type}`}
                  {activeTab === 'groups' && `${item.adversaries?.length || 0} adversary types`}
                  {activeTab === 'scenes' && `${(item.environments?.length || 0) + (item.groups?.length || 0) + (item.adversaries?.length || 0)} elements`}
                  {activeTab === 'adventures' && `${item.scenes?.length || 0} scenes`}
                  
                  {/* FCG Preview Info */}
                  {item.motive && <p className="mt-2 text-xs italic text-slate-300">"{item.motive}"</p>}
                  {item.description && <p className="mt-1 text-xs opacity-80 line-clamp-2">{item.description}</p>}
                </div>
              </div>{/* end p-4 */}
              </div>
            ))}
            {data[activeTab].length === 0 && (
              <div className="col-span-full text-center p-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                No {activeTab} found. Click "New" to create one.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemDetailView({ item, tab, data, onEdit, onClose }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyRolz = async () => {
    try {
      const markdown = generateRolzExport(item, tab, data || {});
      try {
        await navigator.clipboard.writeText(markdown);
      } catch (clipErr) {
        const ta = document.createElement('textarea');
        ta.value = markdown;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Rolz export failed:', err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl max-w-3xl relative overflow-hidden">
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10"><X size={20}/></button>

      {item.imageUrl && (
        <div className="w-full h-56 overflow-hidden bg-slate-950">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover opacity-90" onError={e => { e.target.style.display = 'none'; }} />
        </div>
      )}

      <div className="p-6">
      <div className="mb-6 pr-8">
        <h2 className="text-3xl font-bold text-white mb-1">{item.name}</h2>
        <div className="text-slate-400 uppercase tracking-wider text-sm font-medium mb-2">
          {tab === 'adversaries' && `Tier ${item.tier || 0} ${item.role}`}
          {tab === 'environments' && `Tier ${item.tier || 0} ${item.type} Environment`}
          {tab === 'groups' && `Group`}
          {tab === 'scenes' && `Scene`}
          {tab === 'adventures' && `Adventure`}
        </div>
        {item.description && (
          <div className="text-slate-300 italic whitespace-pre-wrap text-sm">{item.description}</div>
        )}
      </div>

      {tab === 'adversaries' && (item.motive || (item.experiences && item.experiences.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {item.motive && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Motives & Tactics</h3>
              <p className="text-sm text-slate-300">{item.motive}</p>
            </div>
          )}
          {item.experiences && item.experiences.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Experiences</h3>
              <div className="flex flex-wrap gap-2">
                {item.experiences.map(exp => (
                  <span key={exp.id} className="text-sm bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded">
                    {exp.name} <strong className="text-red-400">+{exp.modifier}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'adversaries' && (
        <div className="grid grid-cols-4 gap-4 mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800">
          <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Difficulty</span><span className="text-xl text-white">{item.difficulty || '-'}</span></div>
          <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">HP</span><span className="text-xl text-white">{item.hp_max || '-'}</span></div>
          <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Thresholds</span><span className="text-xl text-white">{item.hp_thresholds?.major || '-'}/{item.hp_thresholds?.severe || '-'}</span></div>
          <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Stress</span><span className="text-xl text-white">{item.stress_max || '-'}</span></div>
        </div>
      )}

      {/* Attacks Display */}
      {item.attack && item.attack.name && (
        <div className="mb-6 space-y-3">
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Attack</h3>
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="font-bold text-red-400">{item.attack.name}:</span>
            <span className="text-slate-300"> {item.attack.modifier >= 0 ? '+' : ''}{item.attack.modifier} {item.attack.range} | {item.attack.damage} {item.attack.trait?.toLowerCase()}</span>
          </div>
        </div>
      )}

      {/* Features Display */}
      {item.features && item.features.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Features</h3>
          {item.features.map(f => (
            <div key={f.id} className="bg-slate-950 p-3 rounded border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-red-400">{f.name}</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase tracking-wider">{f.type}</span>
              </div>
              <p className="text-sm text-slate-300">{f.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-slate-800">
        <button
          onClick={handleCopyRolz}
          className={`px-4 py-2 rounded font-medium flex items-center gap-2 text-sm transition-colors ${copied ? 'bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
        >
          <Copy size={15} /> {copied ? 'Copied!' : 'Copy Rolz'}
        </button>
        <button onClick={onEdit} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-2">
          <Edit size={16} /> Edit {item.name}
        </button>
      </div>
      </div>{/* end p-6 */}
    </div>
  );
}

// --- GM TABLE VIEW ---
function GMTableView({ activeElements, highlightedInstance, triggerHighlight, updateActiveElement, removeActiveElement, data, addToTable, startScene }) {
  
  // Consolidate features from all active elements
  const consolidatedMenu = useMemo(() => {
    const menu = { 'Fear Actions': [], 'Reactions': [], 'Actions': [], 'Passives': [] };
    
    activeElements.forEach(element => {
      // Automatically add the element's attack as an Action on the board
      if (element.attack && element.attack.name) {
        menu['Actions'].push({
          id: `${element.instanceId}-attack`,
          name: element.attack.name,
          type: 'action',
          description: `${element.attack.modifier >= 0 ? '+' : ''}${element.attack.modifier} ${element.attack.range} | ${element.attack.damage} ${element.attack.trait?.toLowerCase()}`,
          sourceName: element.name,
          sourceInstanceId: element.instanceId
        });
      }

      element.features?.forEach(feature => {
        const category = parseFeatureCategory(feature);
        menu[category].push({
          ...feature,
          sourceName: element.name,
          sourceInstanceId: element.instanceId
        });
      });
    });
    return menu;
  }, [activeElements]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Column: Consolidated Actions */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto">
        <div className="p-4 bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
          <h2 className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Zap size={18} className="text-yellow-500" /> Actions Board
          </h2>
        </div>
        
        <div className="p-4 space-y-6">
          {Object.entries(consolidatedMenu).map(([category, features]) => {
            if (features.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">{category}</h3>
                <div className="space-y-2">
                  {features.map((feature, idx) => (
                    <button
                      key={`${feature.id}-${idx}`}
                      onClick={() => triggerHighlight(feature.sourceInstanceId)}
                      className="w-full text-left bg-slate-800/50 hover:bg-slate-800 p-3 rounded border border-slate-700 hover:border-slate-500 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-slate-200 group-hover:text-white text-sm">{feature.name}</span>
                        <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">{feature.sourceName}</span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{feature.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {activeElements.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              No active elements.<br/>Start a scene to populate actions.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: The Table */}
      <div className="flex-1 bg-slate-950 p-6 overflow-y-auto relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">The Table</h2>
          <div className="flex gap-2">
            <select 
              className="bg-slate-900 border border-slate-700 text-sm rounded px-3 py-2 text-white outline-none"
              onChange={(e) => {
                if(e.target.value) {
                  const scene = data.scenes.find(s => s.id === e.target.value);
                  if(scene) startScene(scene);
                  e.target.value = "";
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Start Scene...</option>
              {data.scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {activeElements.map(element => (
            <div 
              key={element.instanceId} 
              className={`bg-slate-900 border rounded-xl shadow-lg transition-all duration-300 relative overflow-hidden ${
                highlightedInstance === element.instanceId ? 'ring-4 ring-yellow-500 border-yellow-500 scale-[1.02] z-10' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {element.imageUrl && (
                <div className="w-full h-40 overflow-hidden bg-slate-950">
                  <img src={element.imageUrl} alt={element.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                </div>
              )}

              <div className="p-5">
              <button onClick={() => removeActiveElement(element.instanceId)} className="absolute top-4 right-4 text-slate-500 hover:text-red-500">
                <Trash2 size={16} />
              </button>

              <div className="flex items-center gap-2 mb-1 pr-8">
                <h3 className="text-xl font-bold text-white">{element.name}</h3>
                {element.groupName && <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{element.groupName}</span>}
              </div>
              
              <div className="text-sm text-slate-400 mb-2 capitalize">
                {element.elementType === 'adversary' ? `Tier ${element.tier || 0} ${element.role}` : `Tier ${element.tier || 0} ${element.type} Environment`}
              </div>

              {element.description && (
                <div className="text-sm italic text-slate-300 mb-4 whitespace-pre-wrap">{element.description}</div>
              )}

              {element.elementType === 'adversary' && (element.motive || (element.experiences && element.experiences.length > 0)) && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {element.motive && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Motives & Tactics</h4>
                      <p className="text-sm text-slate-300">{element.motive}</p>
                    </div>
                  )}
                  {element.experiences && element.experiences.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Experiences</h4>
                      <div className="flex flex-wrap gap-2">
                        {element.experiences.map(exp => (
                          <span key={exp.id} className="text-xs bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded">
                            {exp.name} <strong className="text-red-400">+{exp.modifier}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {element.elementType === 'adversary' && (
                <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {/* Combat Stats */}
                  <div className="col-span-2 flex gap-6 text-sm font-medium border-b border-slate-800 pb-3 mb-2">
                    <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Difficulty</span><span className="text-lg">{element.difficulty || '-'}</span></div>
                    <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">HP</span><span className="text-lg">{element.hp_max || '-'}</span></div>
                    <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Thresholds</span><span className="text-lg">{element.hp_thresholds?.major || '-'}/{element.hp_thresholds?.severe || '-'}</span></div>
                  </div>

                  {/* HP Tracker */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1"><Heart size={12} className="text-red-500"/> HP</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={element.currentHp} 
                        onChange={(e) => updateActiveElement(element.instanceId, { currentHp: parseInt(e.target.value) || 0 })}
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white outline-none focus:border-red-500"
                      />
                      <span className="text-slate-500 text-sm">/ {element.hp_max}</span>
                    </div>
                  </div>

                  {/* Stress Tracker */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1"><AlertCircle size={12} className="text-purple-500"/> Stress</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={element.currentStress} 
                        onChange={(e) => updateActiveElement(element.instanceId, { currentStress: parseInt(e.target.value) || 0 })}
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white outline-none focus:border-purple-500"
                      />
                      <span className="text-slate-500 text-sm">/ {element.stress_max}</span>
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="col-span-2 mt-2">
                    <input 
                      type="text" 
                      placeholder="Conditions (e.g., Vulnerable, Restrained)..." 
                      value={element.conditions || ''}
                      onChange={(e) => updateActiveElement(element.instanceId, { conditions: e.target.value })}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Element Attack listed on card */}
              {element.attack && element.attack.name && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Attack</h4>
                  <div className="text-sm">
                    <span className="font-bold text-slate-200">{element.attack.name}:</span>
                    <span className="text-slate-300"> {element.attack.modifier >= 0 ? '+' : ''}{element.attack.modifier} {element.attack.range} | {element.attack.damage} {element.attack.trait?.toLowerCase()}</span>
                  </div>
                </div>
              )}

              {/* Element Features listed on card */}
              {element.features && element.features.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Features</h4>
                  {element.features.map(feat => (
                    <div key={feat.id} className="text-sm">
                      <span className="font-bold text-slate-200 mr-2">{feat.name}</span>
                      <span className="text-slate-400">{feat.description}</span>
                    </div>
                  ))}
                </div>
              )}
              </div>{/* end p-5 */}
            </div>
          ))}
          {activeElements.length === 0 && (
            <div className="col-span-full h-64 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500">
              The table is empty. Select a scene above to start.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- FORMS ---

function FormRow({ label, children, className="" }) {
  return (
    <div className={`flex flex-col gap-1 mb-4 ${className}`}>
      <label className="text-sm font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function ExperiencesInput({ experiences, onChange }) {
  const addExperience = () => onChange([...experiences, { id: generateId(), name: '', modifier: 1 }]);
  const updateExperience = (id, key, val) => onChange(experiences.map(e => e.id === id ? { ...e, [key]: val } : e));
  const removeExperience = (id) => onChange(experiences.filter(e => e.id !== id));

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-slate-300">Experiences</h4>
        <button type="button" onClick={addExperience} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded flex items-center gap-1"><Plus size={12}/> Add</button>
      </div>
      <div className="space-y-3">
        {experiences.map(exp => (
          <div key={exp.id} className="flex items-center gap-2 relative bg-slate-950 p-2 rounded border border-slate-800 pr-8">
            <input type="text" placeholder="Experience Name" value={exp.name} onChange={e => updateExperience(exp.id, 'name', e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
            <span className="text-slate-400 text-sm font-bold">+</span>
            <input type="number" min="1" placeholder="2" value={exp.modifier} onChange={e => updateExperience(exp.id, 'modifier', parseInt(e.target.value)||1)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white text-center" />
            <button type="button" onClick={() => removeExperience(exp.id)} className="absolute right-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
          </div>
        ))}
        {experiences.length === 0 && <p className="text-xs text-slate-500 italic">No experiences added.</p>}
      </div>
    </div>
  );
}

function FeaturesInput({ features, onChange }) {
  const addFeature = () => onChange([...features, { id: generateId(), name: '', type: 'action', description: '' }]);
  const updateFeature = (id, key, val) => onChange(features.map(f => f.id === id ? { ...f, [key]: val } : f));
  const removeFeature = (id) => onChange(features.filter(f => f.id !== id));

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-slate-300">Features</h4>
        <button type="button" onClick={addFeature} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded flex items-center gap-1"><Plus size={12}/> Add</button>
      </div>
      <div className="space-y-4">
        {features.map(f => (
          <div key={f.id} className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col gap-2 relative">
            <button type="button" onClick={() => removeFeature(f.id)} className="absolute top-2 right-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
            <div className="grid grid-cols-2 gap-2 pr-6">
              <input type="text" placeholder="Feature Name" value={f.name} onChange={e => updateFeature(f.id, 'name', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
              <select value={f.type} onChange={e => updateFeature(f.id, 'type', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white">
                {FEATURE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <textarea placeholder="Description (e.g. 'Spend a Fear to...')" value={f.description} onChange={e => updateFeature(f.id, 'description', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white h-16 resize-none" />
          </div>
        ))}
        {features.length === 0 && <p className="text-xs text-slate-500 italic">No features added.</p>}
      </div>
    </div>
  );
}

function AdversaryForm({ initial, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', tier: initial?.tier || 1, role: initial?.role || 'bruiser',
    motive: initial?.motive || '', description: initial?.description || '',
    imageUrl: initial?.imageUrl || '',
    difficulty: initial?.difficulty || 10, hp_max: initial?.hp_max || 6,
    hp_thresholds: initial?.hp_thresholds || { major: 3, severe: 5 }, stress_max: initial?.stress_max || 4,
    attack: initial?.attack || initial?.attacks?.[0] || { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' },
    experiences: initial?.experiences || [], features: initial?.features || []
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Name"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Role">
          <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormRow>
      </div>
      
      <FormRow label="Motives & Tactics"><input type="text" placeholder="e.g. To add to their bone collection" value={formData.motive} onChange={e => setFormData({...formData, motive: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description (Flavor)"><textarea placeholder="Description or flavor text..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <FormRow label="Tier">
          <select value={formData.tier} onChange={e => setFormData({...formData, tier: parseInt(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full">
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormRow>
        <FormRow label="Difficulty"><input type="number" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: parseInt(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Stress"><input type="number" value={formData.stress_max} onChange={e => setFormData({...formData, stress_max: parseInt(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormRow label="HP"><input type="number" value={formData.hp_max} onChange={e => setFormData({...formData, hp_max: parseInt(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Major Threshold"><input type="number" value={formData.hp_thresholds.major} onChange={e => setFormData({...formData, hp_thresholds: {...formData.hp_thresholds, major: parseInt(e.target.value)}})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Severe Threshold"><input type="number" value={formData.hp_thresholds.severe} onChange={e => setFormData({...formData, hp_thresholds: {...formData.hp_thresholds, severe: parseInt(e.target.value)}})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
      </div>
      
      <div className="mt-6 border-t border-slate-800 pt-4">
        <h4 className="font-medium text-slate-300 mb-4">Attack</h4>
        <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col gap-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5"><input type="text" placeholder="Attack Name" value={formData.attack.name} onChange={e => setFormData({...formData, attack: {...formData.attack, name: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" /></div>
            <div className="col-span-4">
              <select value={formData.attack.range} onChange={e => setFormData({...formData, attack: {...formData.attack, range: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white">
                {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <select value={formData.attack.trait} onChange={e => setFormData({...formData, attack: {...formData.attack, trait: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white">
                {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4 flex items-center gap-2">
              <span className="text-sm text-slate-400">Mod:</span>
              <input type="number" placeholder="+0" value={formData.attack.modifier} onChange={e => setFormData({...formData, attack: {...formData.attack, modifier: parseInt(e.target.value)||0}})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
            </div>
            <div className="col-span-8 flex items-center gap-2">
              <span className="text-sm text-slate-400">Dmg:</span>
              <input type="text" placeholder="e.g. d8+2" value={formData.attack.damage} onChange={e => setFormData({...formData, attack: {...formData.attack, damage: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
            </div>
          </div>
        </div>
      </div>

      <ExperiencesInput experiences={formData.experiences} onChange={experiences => setFormData({...formData, experiences})} />
      <FeaturesInput features={formData.features} onChange={features => setFormData({...formData, features})} />

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Adversary</button>
      </div>
    </div>
  );
}

function EnvironmentForm({ initial, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', tier: initial?.tier || 1, type: initial?.type || 'exploration',
    description: initial?.description || '', imageUrl: initial?.imageUrl || '',
    features: initial?.features || []
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2"><FormRow label="Name"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow></div>
        <FormRow label="Tier">
          <select value={formData.tier} onChange={e => setFormData({...formData, tier: parseInt(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full">
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormRow>
      </div>
      <FormRow label="Type">
        <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white">
          {ENV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </FormRow>
      <FormRow label="Description">
        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-24 resize-none" />
      </FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FeaturesInput features={formData.features} onChange={features => setFormData({...formData, features})} />
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Environment</button>
      </div>
    </div>
  );
}

// Reusable component for selecting referenced elements (Adversaries, Groups, Environments)
function MultiSelectRef({ label, options, selectedIds, onChange, isCountable = false }) {
  const addOption = (id) => {
    if(!id) return;
    if (isCountable) {
      if(!selectedIds.find(item => item.id === id)) onChange([...selectedIds, { id, count: 1 }]);
    } else {
      if(!selectedIds.includes(id)) onChange([...selectedIds, id]);
    }
  };

  const removeOption = (id) => {
    if(isCountable) onChange(selectedIds.filter(item => item.id !== id));
    else onChange(selectedIds.filter(itemId => itemId !== id));
  };

  const updateCount = (id, count) => {
    onChange(selectedIds.map(item => item.id === id ? { ...item, count: parseInt(count)||1 } : item));
  };

  return (
    <div className="mb-4 p-4 border border-slate-800 rounded-lg bg-slate-900/50">
      <label className="text-sm font-medium text-slate-300 block mb-2">{label}</label>
      <div className="flex gap-2 mb-3">
        <select className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm outline-none" onChange={(e) => { addOption(e.target.value); e.target.value=""; }} defaultValue="">
          <option value="" disabled>Add {label}...</option>
          {options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {(isCountable ? selectedIds : selectedIds.map(id => ({id}))).map(item => {
          const opt = options.find(o => o.id === item.id);
          if(!opt) return null;
          return (
            <div key={item.id} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-sm text-white">{opt.name}</span>
              <div className="flex items-center gap-3">
                {isCountable && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Qty</span>
                    <input type="number" min="1" value={item.count} onChange={e => updateCount(item.id, e.target.value)} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center text-sm text-white" />
                  </div>
                )}
                <button type="button" onClick={() => removeOption(item.id)} className="text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupForm({ initial, data, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', description: initial?.description || '',
    imageUrl: initial?.imageUrl || '',
    adversaries: initial?.adversaries?.map(a => ({ id: a.adversaryId, count: a.count })) || []
  });

  return (
    <div className="space-y-4">
      <FormRow label="Group Name"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description"><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <MultiSelectRef label="Adversaries" options={data.adversaries} selectedIds={formData.adversaries} onChange={advs => setFormData({...formData, adversaries: advs})} isCountable={true} />
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave({...formData, adversaries: formData.adversaries.map(a => ({adversaryId: a.id, count: a.count}))})} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Group</button>
      </div>
    </div>
  );
}

function SceneForm({ initial, data, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', description: initial?.description || '',
    imageUrl: initial?.imageUrl || '',
    environments: initial?.environments || [], groups: initial?.groups || [],
    adversaries: initial?.adversaries?.map(a => ({ id: a.adversaryId, count: a.count })) || []
  });

  return (
    <div className="space-y-4">
      <FormRow label="Scene Name"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description"><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <div className="grid grid-cols-2 gap-4">
        <MultiSelectRef label="Environments" options={data.environments} selectedIds={formData.environments} onChange={envs => setFormData({...formData, environments: envs})} />
        <MultiSelectRef label="Groups" options={data.groups} selectedIds={formData.groups} onChange={grps => setFormData({...formData, groups: grps})} />
      </div>
      <MultiSelectRef label="Individual Adversaries" options={data.adversaries} selectedIds={formData.adversaries} onChange={advs => setFormData({...formData, adversaries: advs})} isCountable={true} />
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave({...formData, adversaries: formData.adversaries.map(a => ({adversaryId: a.id, count: a.count}))})} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Scene</button>
      </div>
    </div>
  );
}

function AdventureForm({ initial, data, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', imageUrl: initial?.imageUrl || '',
    scenes: initial?.scenes || [], groups: initial?.groups || [],
    environments: initial?.environments || [], adversaries: initial?.adversaries || []
  });

  return (
    <div className="space-y-4">
      <FormRow label="Adventure Name"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full text-lg font-bold" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <div className="grid grid-cols-2 gap-4">
        <MultiSelectRef label="Scenes" options={data.scenes} selectedIds={formData.scenes} onChange={ids => setFormData({...formData, scenes: ids})} />
        <MultiSelectRef label="Groups" options={data.groups} selectedIds={formData.groups} onChange={ids => setFormData({...formData, groups: ids})} />
        <MultiSelectRef label="Environments" options={data.environments} selectedIds={formData.environments} onChange={ids => setFormData({...formData, environments: ids})} />
        <MultiSelectRef label="Adversaries" options={data.adversaries} selectedIds={formData.adversaries} onChange={ids => setFormData({...formData, adversaries: ids})} />
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Adventure</button>
      </div>
    </div>
  );
}

// --- Rolz Import Modal ---
function RolzImportModal({ onClose, saveItem, onImportSuccess }) {
  const [step, setStep] = useState('paste'); // paste | preview | success
  const [markdown, setMarkdown] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsed, setParsed] = useState(null);

  // Editable preview state
  const [sceneName, setSceneName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [editEnvs, setEditEnvs] = useState([]);
  const [editAdvs, setEditAdvs] = useState([]);

  // Success state
  const [importedItems, setImportedItems] = useState([]);
  const [importing, setImporting] = useState(false);

  const handlePreview = () => {
    setParseError('');
    try {
      const result = parseRolzMarkdown(markdown);
      if (!result.sceneName && result.environments.length === 0 && result.adversaries.length === 0) {
        setParseError('Nothing recognizable was found. Make sure to paste a valid Rolz scene block starting with =Scene Name.');
        return;
      }
      setParsed(result);
      setSceneName(result.sceneName || 'Imported Scene');
      setGroupName(result.sceneName ? `${result.sceneName} - Adversaries` : 'Imported Group');
      setEditEnvs(result.environments.map(e => ({ ...e, id: generateId() })));
      setEditAdvs(result.adversaries.map(a => ({ ...a, id: generateId() })));
      setStep('preview');
    } catch (err) {
      setParseError(`Parse error: ${err.message}`);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const created = [];

    // 1. Save adversaries
    const savedAdvIds = [];
    for (const adv of editAdvs) {
      const { count, id, ...advData } = adv;
      const item = { id, ...advData };
      await saveItem('adversaries', item);
      savedAdvIds.push({ id, count: count || 1 });
      created.push({ collection: 'adversaries', id, name: adv.name });
    }

    // 2. Save environments
    const savedEnvIds = [];
    for (const env of editEnvs) {
      const { id, ...envData } = env;
      const item = { id, ...envData };
      await saveItem('environments', item);
      savedEnvIds.push(id);
      created.push({ collection: 'environments', id, name: env.name });
    }

    // 3. Save group (only if there are adversaries)
    let savedGroupId = null;
    if (savedAdvIds.length > 0) {
      savedGroupId = generateId();
      const group = {
        id: savedGroupId,
        name: groupName,
        description: '',
        adversaries: savedAdvIds.map(a => ({ adversaryId: a.id, count: a.count }))
      };
      await saveItem('groups', group);
      created.push({ collection: 'groups', id: savedGroupId, name: groupName });
    }

    // 4. Save scene
    const sceneId = generateId();
    const scene = {
      id: sceneId,
      name: sceneName,
      description: '',
      imageUrl: parsed?.imageUrl || '',
      environments: savedEnvIds,
      groups: savedGroupId ? [savedGroupId] : [],
      adversaries: []
    };
    await saveItem('scenes', scene);
    created.push({ collection: 'scenes', id: sceneId, name: sceneName });

    setImportedItems(created);
    setImporting(false);
    setStep('success');
  };

  const updateAdv = (idx, key, val) => {
    setEditAdvs(prev => prev.map((a, i) => i === idx ? { ...a, [key]: val } : a));
  };

  const updateEnv = (idx, key, val) => {
    setEditEnvs(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">
            {step === 'paste' && 'Import Rolz Markdown'}
            {step === 'preview' && 'Preview Import'}
            {step === 'success' && 'Import Complete'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Step 1: Paste */}
          {step === 'paste' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Paste your Rolz.org wiki scene block below. The importer will extract the Scene, Environment(s), Adversaries, and create a Group automatically.
              </p>
              <textarea
                className="w-full h-72 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 font-mono resize-none outline-none focus:border-red-500"
                placeholder="Paste Rolz markdown here..."
                value={markdown}
                onChange={e => setMarkdown(e.target.value)}
              />
              {parseError && (
                <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-3">{parseError}</div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Scene & Group names */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Scene Name</label>
                  <input
                    type="text"
                    value={sceneName}
                    onChange={e => setSceneName(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm outline-none focus:border-red-500"
                  />
                </div>
                {editAdvs.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Group Name</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm outline-none focus:border-red-500"
                    />
                  </div>
                )}
              </div>

              {/* Environments */}
              {editEnvs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">
                    Environments ({editEnvs.length})
                  </h3>
                  <div className="space-y-3">
                    {editEnvs.map((env, idx) => (
                      <div key={env.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                        <input
                          type="text"
                          value={env.name}
                          onChange={e => updateEnv(idx, 'name', e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm font-bold w-full mb-2 outline-none focus:border-red-500"
                        />
                        {env.description && (
                          <p className="text-xs text-slate-400 italic mb-2 line-clamp-3">{env.description}</p>
                        )}
                        {env.features.length > 0 && (
                          <div className="text-xs text-slate-500">{env.features.length} feature(s)</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Adversaries */}
              {editAdvs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">
                    Adversaries ({editAdvs.length})
                  </h3>
                  <div className="space-y-3">
                    {editAdvs.map((adv, idx) => (
                      <div key={adv.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="text"
                            value={adv.name}
                            onChange={e => updateAdv(idx, 'name', e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm font-bold outline-none focus:border-red-500"
                          />
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span>×</span>
                            <input
                              type="number"
                              min="1"
                              value={adv.count}
                              onChange={e => updateAdv(idx, 'count', parseInt(e.target.value) || 1)}
                              className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-white text-center text-sm outline-none"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs text-slate-400 mb-2">
                          <span>DC {adv.difficulty}</span>
                          <span>HP {adv.hp_max}</span>
                          <span>Thresholds {adv.hp_thresholds?.major}/{adv.hp_thresholds?.severe}</span>
                          <span>Stress {adv.stress_max}</span>
                        </div>
                        {adv.attack?.name && (
                          <div className="text-xs text-slate-400 mb-1">
                            ⚔ <span className="text-slate-300">{adv.attack.name}</span>: {adv.attack.modifier >= 0 ? '+' : ''}{adv.attack.modifier} {adv.attack.range} | {adv.attack.damage} {adv.attack.trait?.toLowerCase()}
                          </div>
                        )}
                        {adv.features.length > 0 && (
                          <div className="text-xs text-slate-500">{adv.features.length} feature(s) · {adv.experiences.length} experience(s)</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500 bg-slate-950 rounded-lg p-3 border border-slate-800">
                Will create: {editAdvs.length} adversar{editAdvs.length === 1 ? 'y' : 'ies'}{editAdvs.length > 0 ? ` → 1 group` : ''}{editEnvs.length > 0 ? ` · ${editEnvs.length} environment(s)` : ''} → 1 scene
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="space-y-4">
              <p className="text-green-400 font-medium">Import complete! The following items were created:</p>
              <div className="space-y-2">
                {importedItems.map(item => (
                  <button
                    key={`${item.collection}-${item.id}`}
                    onClick={() => { onImportSuccess(item.collection, item.id); onClose(); }}
                    className="w-full text-left bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-lg p-3 flex items-center justify-between group transition-colors"
                  >
                    <span className="text-white group-hover:text-red-400 font-medium text-sm">{item.name}</span>
                    <span className="text-xs text-slate-500 capitalize">{item.collection.replace(/s$/, '')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 flex justify-end gap-3">
          {step === 'paste' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
              <button
                onClick={handlePreview}
                disabled={!markdown.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm"
              >
                Preview
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('paste')} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Back</button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm flex items-center gap-2"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </>
          )}
          {step === 'success' && (
            <button onClick={onClose} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium text-sm">Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- FreshCutGrass Import Modal ---
function FCGImportModal({ onClose, saveItem, onImportSuccess }) {
  const [step, setStep] = useState('url'); // url | loading | preview | success
  const [url, setUrl] = useState('');
  const [fetchError, setFetchError] = useState('');

  // Editable preview state
  const [editEnvs, setEditEnvs] = useState([]);
  const [editAdvs, setEditAdvs] = useState([]);
  const [editEncounters, setEditEncounters] = useState([]);

  // Success state
  const [importedItems, setImportedItems] = useState([]);
  const [importing, setImporting] = useState(false);

  const handleFetch = async () => {
    setFetchError('');
    setStep('loading');
    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) throw new Error('Not signed in');
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/fetch-fcg?url=${encodeURIComponent(url)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      if (!result.adversaries.length && !result.environments.length && !result.encounters.length) {
        throw new Error('Nothing found at that URL. Check the URL is a valid FreshCutGrass homebrew page.');
      }
      setEditEnvs(result.environments.map(e => ({ ...e, id: generateId() })));
      setEditAdvs(result.adversaries.map(a => ({ ...a, id: generateId() })));
      setEditEncounters(result.encounters.map(e => ({ ...e, id: generateId() })));
      setStep('preview');
    } catch (err) {
      setFetchError(err.message);
      setStep('url');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const created = [];

    // Save adversaries, track { id, name } for scene linking
    const savedAdvs = [];
    for (const adv of editAdvs) {
      const { count, id, ...advData } = adv;
      await saveItem('adversaries', { id, ...advData });
      savedAdvs.push({ id, name: adv.name, count: count || 1 });
      created.push({ collection: 'adversaries', id, name: adv.name });
    }

    // Save environments, track { id, name } for scene linking
    const savedEnvs = [];
    for (const env of editEnvs) {
      const { id, ...envData } = env;
      await saveItem('environments', { id, ...envData });
      savedEnvs.push({ id, name: env.name });
      created.push({ collection: 'environments', id, name: env.name });
    }

    // Save each encounter as a scene; match adversaries/environments by name in rawText
    for (const enc of editEncounters) {
      const rawLower = (enc.rawText || enc.name || '').toLowerCase();

      const matchedAdvRefs = savedAdvs
        .filter(a => rawLower.includes(a.name.toLowerCase()))
        .map(a => ({ adversaryId: a.id, count: a.count }));

      const matchedEnvIds = savedEnvs
        .filter(e => rawLower.includes(e.name.toLowerCase()))
        .map(e => e.id);

      const sceneId = enc.id;
      await saveItem('scenes', {
        id: sceneId,
        name: enc.name,
        description: enc.description || '',
        imageUrl: '',
        environments: matchedEnvIds,
        groups: [],
        adversaries: matchedAdvRefs,
      });
      created.push({ collection: 'scenes', id: sceneId, name: enc.name });
    }

    setImportedItems(created);
    setImporting(false);
    setStep('success');
  };

  const updateAdv = (idx, key, val) =>
    setEditAdvs(prev => prev.map((a, i) => i === idx ? { ...a, [key]: val } : a));

  const updateEnv = (idx, key, val) =>
    setEditEnvs(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e));

  const updateEncounter = (idx, key, val) =>
    setEditEncounters(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e));

  const summaryParts = [
    editAdvs.length ? `${editAdvs.length} adversar${editAdvs.length === 1 ? 'y' : 'ies'}` : '',
    editEnvs.length ? `${editEnvs.length} environment${editEnvs.length === 1 ? '' : 's'}` : '',
    editEncounters.length ? `${editEncounters.length} scene${editEncounters.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">
            {step === 'url' && 'Import from FreshCutGrass.app'}
            {step === 'loading' && 'Fetching…'}
            {step === 'preview' && 'Preview Import'}
            {step === 'success' && 'Import Complete'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Step 1: URL entry */}
          {step === 'url' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Paste a FreshCutGrass.app homebrew sharing URL (e.g.{' '}
                <code className="text-green-400 text-xs">https://freshcutgrass.app/homebrew/username</code>).
                Adversaries, environments, and encounters will be imported; encounters become scenes.
              </p>
              <input
                type="url"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-green-600"
                placeholder="https://freshcutgrass.app/homebrew/username"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && url.trim() && handleFetch()}
              />
              {fetchError && (
                <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-3">{fetchError}</div>
              )}
              <p className="text-xs text-slate-500">
                This uses a headless browser on the server to render the page — it may take 20–40 seconds.
              </p>
            </div>
          )}

          {/* Step 2: Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Fetching from FreshCutGrass.app…</p>
              <p className="text-slate-600 text-xs">This may take 20–40 seconds</p>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">

              {/* Environments */}
              {editEnvs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">
                    Environments ({editEnvs.length})
                  </h3>
                  <div className="space-y-3">
                    {editEnvs.map((env, idx) => (
                      <div key={env.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                        <input
                          type="text"
                          value={env.name}
                          onChange={e => updateEnv(idx, 'name', e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm font-bold w-full mb-2 outline-none focus:border-green-600"
                        />
                        <div className="flex gap-3 text-xs text-slate-500 mb-1">
                          <span className="capitalize">{env.type}</span>
                          <span>Tier {env.tier}</span>
                        </div>
                        {env.description && (
                          <p className="text-xs text-slate-400 italic mb-2 line-clamp-3">{env.description}</p>
                        )}
                        {env.features?.length > 0 && (
                          <div className="text-xs text-slate-500">{env.features.length} feature(s)</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Adversaries */}
              {editAdvs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">
                    Adversaries ({editAdvs.length})
                  </h3>
                  <div className="space-y-3">
                    {editAdvs.map((adv, idx) => (
                      <div key={adv.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="text"
                            value={adv.name}
                            onChange={e => updateAdv(idx, 'name', e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm font-bold outline-none focus:border-green-600"
                          />
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span>×</span>
                            <input
                              type="number"
                              min="1"
                              value={adv.count ?? 1}
                              onChange={e => updateAdv(idx, 'count', parseInt(e.target.value) || 1)}
                              className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-white text-center text-sm outline-none"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs text-slate-400 mb-2">
                          <span>DC {adv.difficulty}</span>
                          <span>HP {adv.hp_max}</span>
                          <span>Thresholds {adv.hp_thresholds?.major}/{adv.hp_thresholds?.severe}</span>
                          <span>Stress {adv.stress_max}</span>
                        </div>
                        <div className="text-xs text-slate-500 capitalize mb-1">{adv.role} · Tier {adv.tier}</div>
                        {adv.attack?.name && (
                          <div className="text-xs text-slate-400 mb-1">
                            ⚔ <span className="text-slate-300">{adv.attack.name}</span>: {adv.attack.modifier >= 0 ? '+' : ''}{adv.attack.modifier} {adv.attack.range} | {adv.attack.damage} {adv.attack.trait?.toLowerCase()}
                          </div>
                        )}
                        {adv.features?.length > 0 && (
                          <div className="text-xs text-slate-500">{adv.features.length} feature(s)</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Encounters → Scenes */}
              {editEncounters.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">
                    Encounters → Scenes ({editEncounters.length})
                  </h3>
                  <div className="space-y-3">
                    {editEncounters.map((enc, idx) => {
                      const rawLower = (enc.rawText || enc.name || '').toLowerCase();
                      const matchedAdvNames = editAdvs.filter(a => rawLower.includes(a.name.toLowerCase())).map(a => a.name);
                      const matchedEnvNames = editEnvs.filter(e => rawLower.includes(e.name.toLowerCase())).map(e => e.name);
                      return (
                        <div key={enc.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                          <input
                            type="text"
                            value={enc.name}
                            onChange={e => updateEncounter(idx, 'name', e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm font-bold w-full mb-2 outline-none focus:border-green-600"
                          />
                          {enc.description && (
                            <p className="text-xs text-slate-400 italic mb-2 line-clamp-2">{enc.description}</p>
                          )}
                          {(matchedAdvNames.length > 0 || matchedEnvNames.length > 0) && (
                            <div className="text-xs text-slate-500 space-y-0.5">
                              {matchedAdvNames.length > 0 && (
                                <div>⚔ {matchedAdvNames.join(', ')}</div>
                              )}
                              {matchedEnvNames.length > 0 && (
                                <div>🗺 {matchedEnvNames.join(', ')}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500 bg-slate-950 rounded-lg p-3 border border-slate-800">
                Will create: {summaryParts || 'nothing'}
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="space-y-4">
              <p className="text-green-400 font-medium">Import complete! The following items were created:</p>
              <div className="space-y-2">
                {importedItems.map(item => (
                  <button
                    key={`${item.collection}-${item.id}`}
                    onClick={() => { onImportSuccess(item.collection, item.id); onClose(); }}
                    className="w-full text-left bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-lg p-3 flex items-center justify-between group transition-colors"
                  >
                    <span className="text-white group-hover:text-green-400 font-medium text-sm">{item.name}</span>
                    <span className="text-xs text-slate-500 capitalize">{item.collection.replace(/s$/, '')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 flex justify-end gap-3">
          {step === 'url' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
              <button
                onClick={handleFetch}
                disabled={!url.trim()}
                className="px-5 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm"
              >
                Fetch
              </button>
            </>
          )}
          {step === 'loading' && (
            <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('url')} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Back</button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-5 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm flex items-center gap-2"
              >
                {importing ? 'Importing…' : 'Import'}
              </button>
            </>
          )}
          {step === 'success' && (
            <button onClick={onClose} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium text-sm">Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);