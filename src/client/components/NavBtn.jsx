import React from 'react';

export function NavBtn({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
        active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      }`}
    >
      {React.cloneElement(icon, { size: 18 })}
      {label}
      {badge != null && (
        <span className="text-xs font-mono text-slate-500">
          {badge}
        </span>
      )}
    </button>
  );
}
