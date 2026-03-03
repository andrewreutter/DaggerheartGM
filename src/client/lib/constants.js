export const ROLES = ['bruiser', 'horde', 'leader', 'minion', 'ranged', 'skulk', 'social', 'solo', 'standard', 'support'];
export const ENV_TYPES = ['traversal', 'exploration', 'social', 'event'];
export const FEATURE_TYPES = ['action', 'reaction', 'passive'];
export const TIERS = [1, 2, 3, 4];
export const DAMAGE_TYPES = ['Phy', 'Mag', 'Dir'];
export const RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];

export const isOwnItem = (item) => !item?._source || item._source === 'own';

export const SOURCE_BADGE = {
  own:    { label: 'Mine',   className: 'bg-slate-700/60 text-slate-300 border border-slate-600' },
  srd:    { label: 'SRD',    className: 'bg-violet-900/60 text-violet-300 border border-violet-700' },
  public: { label: 'Public', className: 'bg-blue-900/60 text-blue-300 border border-blue-700' },
  hod:    { label: 'HoD',    className: 'bg-rose-900/60 text-rose-300 border border-rose-700' },
  fcg:    { label: 'FCG',    className: 'bg-green-900/60 text-green-300 border border-green-700' },
  reddit: { label: 'Reddit', className: 'bg-orange-900/60 text-orange-300 border border-orange-700' },
};

export const SOURCE_ORDER = { own: 0, srd: 1, public: 2, hod: 3, fcg: 4, reddit: 5 };

export const needsHodEnrich = (item) =>
  item?._source === 'hod' && (
    (item.features || []).length === 0 ||
    (item.attack && typeof item.attack.damage !== 'string')
  );

/** Returns true when a Reddit stub needs LLM parsing to get full game data. */
export const needsRedditParse = (item) =>
  item?._source === 'reddit' && (item.features || []).length === 0;
