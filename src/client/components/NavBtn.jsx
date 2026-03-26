import React from 'react';

export function NavBtn({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
        active ? 'bg-dh-raised text-dh' : 'text-dh-muted hover:text-dh hover:bg-dh-raised/50'
      }`}
    >
      {React.cloneElement(icon, { size: 18 })}
      {label}
      {badge != null && (
        <span className="text-xs font-mono text-dh-muted">
          {badge}
        </span>
      )}
    </button>
  );
}
