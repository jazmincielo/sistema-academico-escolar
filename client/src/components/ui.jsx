import { useEffect } from 'react';

export const ROLE_META = {
  administrador: { label: 'Administrador', side: 'bg-purple-700', accent: 'text-purple-700', chip: 'bg-purple-100 text-purple-800' },
  docente: { label: 'Docente', side: 'bg-brand-700', accent: 'text-brand-700', chip: 'bg-blue-100 text-blue-800' },
  estudiante: { label: 'Estudiante', side: 'bg-brand-600', accent: 'text-brand-600', chip: 'bg-sky-100 text-sky-800' },
  apoderado: { label: 'Apoderado', side: 'bg-emerald-700', accent: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-800' },
};

export const Spinner = ({ label = 'Cargando…' }) => (
  <div role="status" className="flex items-center gap-3 p-6 text-slate-500">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
    {label}
  </div>
);

export const Alert = ({ type = 'error', children }) =>
  children ? (
    <div role={type === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${
      type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
      {children}
    </div>
  ) : null;

const BADGES = {
  green: 'bg-emerald-100 text-emerald-800', red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800', slate: 'bg-slate-100 text-slate-700',
};
export const Badge = ({ color = 'slate', children }) => (
  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGES[color]}`}>{children}</span>
);

export const StatCard = ({ label, value, hint, tone = 'text-brand-700' }) => (
  <div className="card">
    <div className={`text-3xl font-bold ${tone}`}>{value ?? '—'}</div>
    <div className="mt-1 text-sm text-slate-600">{label}</div>
    {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
  </div>
);

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </div>
    <div className="flex gap-2">{actions}</div>
  </div>
);

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Empty = ({ children }) => <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;

export const fmtDate = (d) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const fmtDateTime = (d) => new Date(d).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const scoreColor = (s) => (s == null ? 'text-slate-400' : s >= 51 ? 'text-emerald-700' : 'text-red-600');
