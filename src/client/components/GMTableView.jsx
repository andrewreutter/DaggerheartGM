import { useMemo, useState, useEffect, useRef } from 'react';
import { Zap, Trash2, Pencil, LayoutDashboard, Monitor, Dices, ChevronDown, ChevronRight } from 'lucide-react';
import { RolzRoomLog } from './RolzRoomLog.jsx';
import { parseFeatureCategory, parseCountdownValue } from '../lib/helpers.js';
import { FeatureDescription } from './FeatureDescription.jsx';
import { EnvironmentCardContent, AdversaryCardContent } from './DetailCardContent.jsx';
import { EditChoiceDialog } from './modals/EditChoiceDialog.jsx';
import { EditFormModal } from './modals/EditFormModal.jsx';
import { postRolzRoll } from '../lib/api.js';

const ATTACK_DESC_RE = /^([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*([^\s]+)\s+(\w+)$/i;
const DICE_PATTERN_RE = /\d+d\d+(?:[+-]\d+)?/gi;

function buildAttackRollText(name, modifier, range, damage, trait, sourceName) {
  const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  return `${sourceName} ${name} [d20${modStr}] damage [${damage} ${(trait || 'phy').toLowerCase()}] ${range}`;
}

function extractIframeSrc(embedCode) {
  try {
    const match = embedCode.match(/\bsrc=["']([^"']+)["']/i);
    if (match && match[1].startsWith('https://')) return match[1];
  } catch (_) {}
  return null;
}

function ConfigSummary({ iframeSrc, rolzRoomName, rolzUsername }) {
  const parts = [];
  if (iframeSrc) parts.push('Zoom');
  if (rolzRoomName) parts.push(rolzUsername ? `Rolz: ${rolzRoomName} (${rolzUsername})` : `Rolz: ${rolzRoomName}`);
  return parts.length > 0
    ? <span className="text-slate-500 text-xs ml-2">{parts.join(' · ')}</span>
    : <span className="text-slate-600 text-xs ml-2 italic">Not configured</span>;
}

function WhiteboardTab({ whiteboardEmbed, setWhiteboardEmbed, rolzRoomName, setRolzRoomName, rolzUsername, setRolzUsername, rolzPassword, setRolzPassword, hidden, nudge }) {
  const [embedDraft, setEmbedDraft] = useState(whiteboardEmbed);
  const [roomNameDraft, setRoomNameDraft] = useState(rolzRoomName);
  const [usernameDraft, setUsernameDraft] = useState(rolzUsername);
  const [passwordDraft, setPasswordDraft] = useState(rolzPassword);
  const [configOpen, setConfigOpen] = useState(!whiteboardEmbed && !rolzRoomName);
  const [nudgeHint, setNudgeHint] = useState(false);

  useEffect(() => {
    if (!nudge) return;
    setConfigOpen(true);
    setNudgeHint(true);
    const t = setTimeout(() => setNudgeHint(false), 6000);
    return () => clearTimeout(t);
  }, [nudge]);

  const iframeSrc = extractIframeSrc(whiteboardEmbed);

  const handleSaveAll = () => {
    setWhiteboardEmbed(embedDraft.trim());
    setRolzRoomName(roomNameDraft.trim());
    setRolzUsername(usernameDraft.trim());
    setRolzPassword(passwordDraft);
    if (embedDraft.trim() || roomNameDraft.trim()) setConfigOpen(false);
  };

  return (
    <div className={`flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-950${hidden ? ' hidden' : ''}`}>
      {/* Collapsible config panel */}
      <div className="shrink-0 border-b border-slate-800">
        <button
          onClick={() => setConfigOpen(o => !o)}
          className="w-full flex items-center gap-2 px-5 py-2.5 text-left hover:bg-slate-900/50 transition-colors"
        >
          {configOpen
            ? <ChevronDown size={14} className="text-slate-500" />
            : <ChevronRight size={14} className="text-slate-500" />
          }
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Configure Embeds</span>
          {!configOpen && <ConfigSummary iframeSrc={iframeSrc} rolzRoomName={rolzRoomName} rolzUsername={rolzUsername} />}
        </button>

        {configOpen && (
          <div className="px-5 pb-4 pt-1 grid grid-cols-[1fr,auto] gap-x-6 gap-y-3">
            {/* Zoom Whiteboard config */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Monitor size={12} /> Zoom Whiteboard
              </label>
              <textarea
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-blue-500 resize-none h-16"
                placeholder='Paste your <iframe ...> embed code here'
                value={embedDraft}
                onChange={(e) => setEmbedDraft(e.target.value)}
                spellCheck={false}
              />
            </div>

            {/* Rolz config */}
            <div className="flex flex-col gap-1.5 min-w-[20rem]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Dices size={12} className="text-red-400" /> Rolz Dice Room
              </label>
              <input
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                placeholder="Room name"
                value={roomNameDraft}
                onChange={(e) => setRoomNameDraft(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  placeholder="Rolz username"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  autoComplete="username"
                />
                <input
                  type="password"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  placeholder="Rolz password"
                  value={passwordDraft}
                  onChange={(e) => setPasswordDraft(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                Enter your <a href="https://rolz.org/table/login" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Rolz.org</a> credentials. In your dice room, type <code className="text-slate-400 bg-slate-800 px-1 rounded">/room api=on</code> to enable posting.
              </p>
            </div>

            {/* Nudge hint */}
            {nudgeHint && (
              <div className="col-span-2 flex items-start gap-2 bg-amber-900/30 border border-amber-600/50 rounded-lg px-3 py-2 text-amber-300 text-xs">
                <Dices size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <span>Enter your <strong>Rolz username and password</strong> and click <strong>Save</strong> to enable dice rolling from the Actions Board. Make sure to type <code className="bg-amber-900/50 px-1 rounded">/room api=on</code> in your Rolz room first.</span>
              </div>
            )}

            {/* Save button spanning full width */}
            <div className="col-span-2 flex justify-end">
              <button
                onClick={handleSaveAll}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Whiteboard embed — full width */}
      <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col">
        {iframeSrc ? (
          <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
            <iframe
              src={iframeSrc}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              allowFullScreen
              title="Zoom Whiteboard"
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2">
            <Monitor size={32} className="opacity-40" />
            <p className="text-sm">Configure a Zoom whiteboard embed above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Strip runtime tracking fields to get the base item data for form editing.
function getItemData(element) {
  const { instanceId, elementType, currentHp, currentStress, conditions, groupName, ...rest } = element;
  return rest;
}

export function GMTableView({ activeElements, updateActiveElement, removeActiveElement, updateActiveElementsBaseData, data, saveItem, addToTable, startScene, whiteboardEmbed, setWhiteboardEmbed, rolzRoomName, setRolzRoomName, rolzUsername, setRolzUsername, rolzPassword, setRolzPassword, gmTab, navigate, featureCountdowns = {}, updateCountdown }) {
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [rolledKey, setRolledKey] = useState(null);
  const [configNudge, setConfigNudge] = useState(0);
  const overlayScrollRef = useRef(null);
  // editState: null | { step: 'choice', baseElement, instances, collection }
  //                  | { step: 'form', item, collection, mode, baseElement, instances }
  const [editState, setEditState] = useState(null);

  const handleEditClick = (instances, baseElement, collection) => {
    const canEditOriginal = !baseElement._source || baseElement._source === 'own';
    if (!canEditOriginal) {
      setEditState({ step: 'form', item: getItemData(baseElement), collection, mode: 'copy', instances, baseElement });
    } else {
      setEditState({ step: 'choice', instances, baseElement, collection });
    }
  };

  const handleChoiceEditCopy = () => {
    const { instances, baseElement, collection } = editState;
    setEditState({ step: 'form', item: getItemData(baseElement), collection, mode: 'copy', instances, baseElement });
  };

  const handleChoiceEditOriginal = () => {
    const { baseElement, collection } = editState;
    const libraryItem = data[collection]?.find(i => i.id === baseElement.id) || getItemData(baseElement);
    setEditState({ ...editState, step: 'form', item: libraryItem, mode: 'original' });
  };

  const handleEditFormSave = async (editedData) => {
    const { mode, collection, baseElement } = editState;
    setEditState(null);
    const itemWithId = { ...editedData, id: baseElement.id };
    if (mode === 'copy') {
      updateActiveElementsBaseData(
        el => el.id === baseElement.id && (el.groupName || '') === (baseElement.groupName || ''),
        itemWithId
      );
    } else {
      await saveItem(collection, itemWithId);
      updateActiveElementsBaseData(el => el.id === itemWithId.id, itemWithId);
    }
  };

  const [lastRollTime, setLastRollTime] = useState(null);

  const rolzConfigured = !!(rolzRoomName && rolzUsername && rolzPassword);

  const handleRoll = async (feature) => {
    if (!feature._rollData && !feature._diceRoll) return;
    if (!rolzConfigured) {
      navigate('/gm-table/whiteboard');
      setConfigNudge(n => n + 1);
      return;
    }
    let rollText;
    if (feature._rollData) {
      const { modifier, range, damage, trait } = feature._rollData;
      rollText = buildAttackRollText(feature.name, modifier, range, damage, trait, feature.sourceName);
    } else {
      const { patterns, includeAttack, attackModifier, attackDamage, attackTrait, attackRange } = feature._diceRoll;
      const parts = [`${feature.sourceName} ${feature.name}`];
      if (includeAttack) {
        const modStr = attackModifier >= 0 ? `+${attackModifier}` : `${attackModifier}`;
        parts.push(`Attack [1d20${modStr}]`);
      }
      if (attackDamage) {
        parts.push(`damage [${attackDamage} ${(attackTrait || '').toLowerCase()}]`);
        if (attackRange) parts.push(attackRange);
      }
      patterns.forEach(p => parts.push(`[${p}]`));
      rollText = parts.join(' ');
    }
    const key = `${feature.cardKey}|${feature.featureKey}`;
    try {
      await postRolzRoll(rolzRoomName, rollText, rolzUsername, rolzPassword);
      setRolledKey(key);
      setLastRollTime(Date.now());
      setTimeout(() => setRolledKey(prev => prev === key ? null : prev), 1500);
    } catch (err) {
      console.error('Rolz roll failed:', err);
    }
  };

  const handleCardRoll = async (attackData, sourceName) => {
    if (!rolzConfigured) return;
    const { name, modifier, range, damage, trait } = attackData;
    const rollText = buildAttackRollText(name, modifier, range, damage, trait, sourceName);
    try {
      await postRolzRoll(rolzRoomName, rollText, rolzUsername, rolzPassword);
      setLastRollTime(Date.now());
    } catch (err) {
      console.error('Rolz roll failed:', err);
    }
  };

  // Group adversaries of the same type (same id + groupName) into consolidated entries.
  // Environments remain as individual entries.
  const consolidatedElements = useMemo(() => {
    const result = [];
    const seenAdvKeys = {}; // key -> index in result

    activeElements.forEach(el => {
      if (el.elementType !== 'adversary') {
        result.push({ kind: 'environment', element: el });
      } else {
        const key = `${el.id}|${el.groupName || ''}`;
        if (seenAdvKeys[key] === undefined) {
          seenAdvKeys[key] = result.length;
          result.push({ kind: 'adversary-group', baseElement: el, instances: [el] });
        } else {
          result[seenAdvKeys[key]].instances.push(el);
        }
      }
    });

    return result;
  }, [activeElements]);

  // Find the consolidated element whose cardKey matches the hovered feature (for overlay).
  const hoveredElement = useMemo(() => {
    if (!hoveredFeature) return null;
    for (const item of consolidatedElements) {
      if (item.kind === 'adversary-group') {
        const key = `${item.baseElement.id}|${item.baseElement.groupName || ''}`;
        if (key === hoveredFeature.cardKey) return item;
      } else {
        if (item.element.instanceId === hoveredFeature.cardKey) return item;
      }
    }
    return null;
  }, [hoveredFeature, consolidatedElements]);

  useEffect(() => {
    if (!hoveredFeature || !overlayScrollRef.current) return;
    const el = overlayScrollRef.current.querySelector(`[data-feature-key="${hoveredFeature.featureKey}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [hoveredFeature]);

  // Deduplicate actions by adversary id — same type only appears once in the board.
  const consolidatedMenu = useMemo(() => {
    const menu = { 'Passives': [], 'Reactions': [], 'Fear Actions': [], 'Actions': [] };
    const seenAdvIds = new Set();

    activeElements.forEach(element => {
      if (element.elementType === 'adversary') {
        if (seenAdvIds.has(element.id)) return;
        seenAdvIds.add(element.id);
      }

      const cardKey = element.elementType === 'adversary'
        ? `${element.id}|${element.groupName || ''}`
        : element.instanceId;

      if (element.attack && element.attack.name) {
        menu['Actions'].push({
          id: `${element.instanceId}-attack`,
          name: element.attack.name,
          type: 'action',
          description: `${element.attack.modifier >= 0 ? '+' : ''}${element.attack.modifier} ${element.attack.range} | ${element.attack.damage} ${element.attack.trait?.toLowerCase()}`,
          sourceName: element.name,
          cardKey,
          featureKey: 'attack',
          _rollData: {
            modifier: element.attack.modifier || 0,
            range: element.attack.range || 'Melee',
            damage: element.attack.damage || 'd6',
            trait: element.attack.trait || 'phy',
          },
        });
      }

      element.features?.forEach((feature, featureIdx) => {
        const category = parseFeatureCategory(feature);
        const m = feature.type === 'action' && feature.description ? ATTACK_DESC_RE.exec(feature.description) : null;
        const dicePatterns = feature.description
          ? [...feature.description.matchAll(DICE_PATTERN_RE)].map(dm => dm[0])
          : [];
        const includeAttack = /\bmakes?\b.*?\battack\b/i.test(feature.description || '');
        menu[category].push({
          ...feature,
          sourceName: element.name,
          cardKey,
          featureKey: `feat-${featureIdx}`,
          _rollData: m ? {
            modifier: parseInt(m[1]),
            range: m[2],
            damage: m[3],
            trait: m[4],
          } : null,
          _diceRoll: !m && (dicePatterns.length > 0 || includeAttack) ? {
            patterns: dicePatterns,
            includeAttack,
            attackModifier: includeAttack ? (element.attack?.modifier ?? 0) : null,
            attackDamage: includeAttack && dicePatterns.length === 0 ? (element.attack?.damage || null) : null,
            attackTrait: includeAttack && dicePatterns.length === 0 ? (element.attack?.trait || null) : null,
            attackRange: includeAttack && dicePatterns.length === 0 ? (element.attack?.range || 'Melee') : null,
          } : null,
        });
      });
    });
    return menu;
  }, [activeElements]);

  const removeGroup = (instances) => {
    instances.forEach(inst => removeActiveElement(inst.instanceId));
  };

  const tabBase = 'flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors';
  const tabActive = 'border-red-500 text-white';
  const tabInactive = 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600';

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Column: Consolidated Actions (always visible) */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto shrink-0">
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
                  {features.map((feature, idx) => {
                    const countdownInit = parseCountdownValue(feature.description);
                    const cdKey = `${feature.cardKey}|${feature.featureKey}`;
                    const countdownVal = featureCountdowns[cdKey] ?? countdownInit;
                    const canRoll = !!(feature._rollData || feature._diceRoll);
                    const justRolled = rolledKey === cdKey;
                    return (
                      <div
                        key={`${feature.id}-${idx}`}
                        onMouseEnter={() => setHoveredFeature({ cardKey: feature.cardKey, featureKey: feature.featureKey })}
                        onMouseLeave={() => setHoveredFeature(null)}
                        onClick={canRoll ? () => handleRoll(feature) : undefined}
                        className={`w-full text-left bg-slate-800/50 hover:bg-slate-800 p-3 rounded border transition-all group ${canRoll ? 'cursor-pointer' : 'cursor-default'} ${justRolled ? 'border-green-600 bg-green-900/20' : 'border-slate-700 hover:border-r-yellow-500'}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-slate-200 group-hover:text-white text-sm flex items-center gap-1.5">
                            {feature.name}
                            {canRoll && (
                              <Dices size={12} className={justRolled ? 'text-green-400' : rolzConfigured ? 'text-slate-500 group-hover:text-red-400 transition-colors' : 'text-slate-600 group-hover:text-amber-400 transition-colors'} />
                            )}
                          </span>
                          <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">{feature.sourceName}</span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2"><FeatureDescription description={feature.description} /></p>
                        {countdownInit !== null && (
                          <div className="mt-2 pt-2 border-t border-slate-700 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <span className="text-xs text-slate-400">Countdown</span>
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => updateCountdown(feature.cardKey, feature.featureKey, Math.max(0, countdownVal - 1))}
                                className="w-5 h-5 rounded bg-slate-700 hover:bg-red-800 text-slate-200 flex items-center justify-center text-xs font-bold transition-colors leading-none"
                              >−</button>
                              <span className="min-w-[1.5rem] text-center font-bold text-yellow-400 text-sm tabular-nums">{countdownVal}</span>
                              <button
                                onClick={() => updateCountdown(feature.cardKey, feature.featureKey, countdownVal + 1)}
                                className="w-5 h-5 rounded bg-slate-700 hover:bg-green-800 text-slate-200 flex items-center justify-center text-xs font-bold transition-colors leading-none"
                              >+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {activeElements.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              No active elements.<br />Start a scene to populate actions.
            </div>
          )}
        </div>
      </div>

      {/* Center Column: Tab bar + content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="bg-slate-950 border-b border-slate-800 flex items-center px-4 shrink-0">
          <button
            className={`${tabBase} ${gmTab === 'table' ? tabActive : tabInactive}`}
            onClick={() => navigate('/gm-table/table')}
          >
            <Monitor size={16} /> Behind the Screen
          </button>
          <button
            className={`${tabBase} ${gmTab === 'whiteboard' ? tabActive : tabInactive}`}
            onClick={() => navigate('/gm-table/whiteboard')}
          >
            <LayoutDashboard size={16} /> Game Table
          </button>
        </div>
        <WhiteboardTab
          whiteboardEmbed={whiteboardEmbed}
          setWhiteboardEmbed={setWhiteboardEmbed}
          rolzRoomName={rolzRoomName}
          setRolzRoomName={setRolzRoomName}
          rolzUsername={rolzUsername}
          setRolzUsername={setRolzUsername}
          rolzPassword={rolzPassword}
          setRolzPassword={setRolzPassword}
          hidden={gmTab !== 'whiteboard'}
          nudge={configNudge}
        />
        <div className={`flex-1 bg-slate-950 p-6 overflow-y-auto relative${gmTab === 'whiteboard' ? ' hidden' : ''}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">The Table</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="bg-slate-900 border border-slate-700 text-sm rounded px-3 py-2 text-white outline-none"
              onChange={(e) => {
                if (e.target.value) {
                  const adv = data.adversaries.find(a => a.id === e.target.value);
                  if (adv) addToTable(adv, 'adversaries');
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Add Adversary...</option>
              {data.adversaries.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select
              className="bg-slate-900 border border-slate-700 text-sm rounded px-3 py-2 text-white outline-none"
              onChange={(e) => {
                if (e.target.value) {
                  const env = data.environments.find(e2 => e2.id === e.target.value);
                  if (env) addToTable(env, 'environments');
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Add Environment...</option>
              {data.environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select
              className="bg-slate-900 border border-slate-700 text-sm rounded px-3 py-2 text-white outline-none"
              onChange={(e) => {
                if (e.target.value) {
                  const group = data.groups.find(g => g.id === e.target.value);
                  if (group) addToTable(group, 'groups');
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Add Group...</option>
              {data.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select
              className="bg-slate-900 border border-slate-700 text-sm rounded px-3 py-2 text-white outline-none"
              onChange={(e) => {
                if (e.target.value) {
                  const scene = data.scenes.find(s => s.id === e.target.value);
                  if (scene) startScene(scene);
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Start Scene...</option>
              {data.scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="columns-1 xl:columns-2 2xl:columns-3 gap-4 space-y-4">
          {consolidatedElements.map((item) => {
            if (item.kind === 'environment') {
              const element = item.element;
              const envCardKey = element.instanceId;
              return (
                <div
                  key={element.instanceId}
                  className="break-inside-avoid bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl shadow-lg transition-all duration-300 relative overflow-hidden"
                >
                  {element.imageUrl && (
                    <div className="w-full h-40 overflow-hidden bg-slate-950">
                      <img src={element.imageUrl} alt={element.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="absolute top-4 right-4 flex items-center gap-1.5">
                      <button
                        onClick={() => handleEditClick([element], element, 'environments')}
                        className="text-slate-500 hover:text-blue-400"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => removeActiveElement(element.instanceId)} className="text-slate-500 hover:text-red-500" title="Remove">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-1 pr-14">
                      <h3 className="text-xl font-bold text-white">{element.name}</h3>
                    </div>

                    <EnvironmentCardContent
                      element={element}
                      hoveredFeature={hoveredFeature}
                      cardKey={envCardKey}
                      featureCountdowns={featureCountdowns}
                      updateCountdown={updateCountdown}
                    />
                  </div>
                </div>
              );
            }

            // adversary-group
            const { baseElement: el, instances } = item;
            const count = instances.length;
            const advCardKey = `${el.id}|${el.groupName || ''}`;

            return (
              <div
                key={advCardKey}
                className="break-inside-avoid bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl shadow-lg transition-all duration-300 relative overflow-hidden"
              >
                {el.imageUrl && (
                  <div className="w-full h-40 overflow-hidden bg-slate-950">
                    <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                  </div>
                )}

                <div className="p-5">
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditClick(instances, el, 'adversaries')}
                      className="text-slate-500 hover:text-blue-400"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => removeGroup(instances)} className="text-slate-500 hover:text-red-500" title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-1 pr-14">
                    <h3 className="text-xl font-bold text-white">
                      {el.name}
                      {count > 1 && <span className="text-slate-400 font-normal ml-1.5">×{count}</span>}
                    </h3>
                    {el.groupName && <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{el.groupName}</span>}
                  </div>

                  <AdversaryCardContent
                    element={el}
                    hoveredFeature={hoveredFeature}
                    cardKey={advCardKey}
                    count={count}
                    instances={instances}
                    updateFn={updateActiveElement}
                    showInstanceRemove={true}
                    removeInstanceFn={removeActiveElement}
                    featureCountdowns={featureCountdowns}
                    updateCountdown={updateCountdown}
                    onRollAttack={rolzConfigured ? (attackData) => handleCardRoll(attackData, el.name) : null}
                  />
                </div>
              </div>
            );
          })}

          {activeElements.length === 0 && (
            <div className="w-full h-64 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500">
              The table is empty. Select a scene above to start.
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Persistent Dice Room Log — always visible when configured */}
      {rolzRoomName && (
        <div className="w-80 border-l border-slate-800 flex flex-col overflow-hidden shrink-0">
          <RolzRoomLog roomName={rolzRoomName} lastRollTime={lastRollTime} />
        </div>
      )}

    {editState?.step === 'choice' && (
      <EditChoiceDialog
        itemName={editState.baseElement.name}
        contextLabel="Table"
        canEditOriginal={!editState.baseElement._source || editState.baseElement._source === 'own'}
        onEditCopy={handleChoiceEditCopy}
        onEditOriginal={handleChoiceEditOriginal}
        onClose={() => setEditState(null)}
      />
    )}
    {editState?.step === 'form' && (
      <EditFormModal
        item={editState.item}
        collection={editState.collection}
        data={data}
        onSave={handleEditFormSave}
        onClose={() => setEditState(null)}
      />
    )}

    {/* Hover overlay: shown when Behind the Screen is hidden and an Actions Board item is hovered */}
    {gmTab !== 'table' && hoveredElement && (
      <div
        className="fixed z-50 pointer-events-none"
        style={{ left: 'calc(20rem + 12px)', top: '50%', transform: 'translateY(-50%)', width: '26rem', maxHeight: '80vh' }}
      >
        <div ref={overlayScrollRef} className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl overflow-y-auto max-h-[80vh]">
          {hoveredElement.kind === 'environment' ? (
            <div className="p-5">
              {hoveredElement.element.imageUrl && (
                <div className="w-full h-32 overflow-hidden bg-slate-950 rounded-lg mb-4">
                  <img src={hoveredElement.element.imageUrl} alt={hoveredElement.element.name} className="w-full h-full object-cover opacity-80" />
                </div>
              )}
              <h3 className="text-xl font-bold text-white mb-1">{hoveredElement.element.name}</h3>
              <EnvironmentCardContent
                element={hoveredElement.element}
                hoveredFeature={hoveredFeature}
                cardKey={hoveredElement.element.instanceId}
                featureCountdowns={featureCountdowns}
                updateCountdown={null}
              />
            </div>
          ) : (
            <div className="p-5">
              {hoveredElement.baseElement.imageUrl && (
                <div className="w-full h-32 overflow-hidden bg-slate-950 rounded-lg mb-4">
                  <img src={hoveredElement.baseElement.imageUrl} alt={hoveredElement.baseElement.name} className="w-full h-full object-cover opacity-80" />
                </div>
              )}
              <h3 className="text-xl font-bold text-white mb-1">
                {hoveredElement.baseElement.name}
                {hoveredElement.instances.length > 1 && (
                  <span className="text-slate-400 font-normal ml-1.5">×{hoveredElement.instances.length}</span>
                )}
                {hoveredElement.baseElement.groupName && (
                  <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full ml-2">{hoveredElement.baseElement.groupName}</span>
                )}
              </h3>
              <AdversaryCardContent
                element={hoveredElement.baseElement}
                hoveredFeature={hoveredFeature}
                cardKey={`${hoveredElement.baseElement.id}|${hoveredElement.baseElement.groupName || ''}`}
                count={hoveredElement.instances.length}
                instances={hoveredElement.instances}
                updateFn={() => {}}
                showInstanceRemove={false}
                featureCountdowns={featureCountdowns}
                updateCountdown={null}
                onRollAttack={null}
              />
            </div>
          )}
        </div>
      </div>
    )}
    </div>
  );
}
