export {
  ROLES,
  ENV_TYPES,
  TIERS,
  ROLE_BP_COST,
  ROLE_DESCRIPTIONS,
  DEFAULT_CHARACTER_STARTING_HOPE,
} from '../../game-constants.js';
export const FEATURE_TYPES = ['action', 'reaction', 'passive'];
export const DAMAGE_TYPES = ['Phy', 'Mag', 'Dir'];
export const RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];

export const isOwnItem = (item) => !item?._source || item._source === 'own';

export const SOURCE_BADGE = {
  own:    { label: 'Mine',   className: 'dh-badge dh-badge-mine' },
  srd:    { label: 'SRD',    className: 'dh-badge dh-badge-srd' },
  dt:     { label: 'DT',     className: 'dh-badge dh-badge-dt' },
  public: { label: 'Public', className: 'dh-badge dh-badge-public' },
  v2:     { label: 'V2',     className: 'dh-badge dh-badge-srd' },
};

export const SOURCE_ORDER = { own: 0, srd: 1, dt: 1, v2: 1, public: 2 };
