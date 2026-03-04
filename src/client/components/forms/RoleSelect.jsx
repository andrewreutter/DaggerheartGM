import { CustomSelect } from './CustomSelect.jsx';
import { ROLES, ROLE_DESCRIPTIONS } from '../../lib/constants.js';

/** Role dropdown: role name when closed, role + description when expanded. */
export function RoleSelect({ value, onChange, className = '' }) {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={ROLES}
      getOptionLabel={(r) => r.charAt(0).toUpperCase() + r.slice(1)}
      getOptionDescription={(r) => ROLE_DESCRIPTIONS[r]}
      className={className}
    />
  );
}
