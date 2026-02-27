export function FormRow({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 mb-4 ${className}`}>
      <label className="text-sm font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}
