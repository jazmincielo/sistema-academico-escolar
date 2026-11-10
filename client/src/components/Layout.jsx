import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { ROLE_META } from './ui.jsx';

const NAV = {
  administrador: [['/', 'Dashboard'], ['/usuarios', 'Gestión de usuarios'], ['/materias', 'Materias'], ['/justificaciones', 'Justificaciones'], ['/notificaciones', 'Notificaciones']],
  docente: [['/', 'Dashboard'], ['/calificaciones', 'Carga de notas'], ['/asistencia', 'Toma de asistencia'], ['/tareas', 'Tareas'], ['/notificaciones', 'Notificaciones']],
  estudiante: [['/', 'Dashboard'], ['/calificaciones', 'Mis calificaciones'], ['/asistencia', 'Asistencia'], ['/tareas', 'Mis tareas'], ['/notificaciones', 'Notificaciones']],
  apoderado: [['/', 'Dashboard'], ['/calificaciones', 'Calificaciones'], ['/asistencia', 'Asistencia'], ['/tareas', 'Tareas'], ['/justificaciones', 'Mis justificaciones'], ['/notificaciones', 'Notificaciones']],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const meta = ROLE_META[user.role];

  useEffect(() => {
    const load = () => api.get('/notifications').then((r) => setUnread(r.data.unread)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    window.addEventListener('sae:notifications', load);
    return () => { clearInterval(t); window.removeEventListener('sae:notifications', load); };
  }, []);

  const docsUrl = `${import.meta.env.VITE_API_ORIGIN || ''}/api-docs`;

  return (
    <div className="min-h-screen lg:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Saltar al contenido</a>

      <aside className={`${meta.side} fixed inset-y-0 left-0 z-40 w-64 transform text-white transition lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-white/20 p-5">
          <div className="text-lg font-bold leading-tight">Sistema Académico Escolar</div>
          <div className="mt-1 text-xs text-white/80">{meta.label}</div>
        </div>
        <nav aria-label="Principal" className="space-y-1 p-3">
          {NAV[user.role].map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`}>
              {label}
              {to === '/notificaciones' && unread > 0 && <span className="rounded-full bg-red-500 px-2 text-xs">{unread}</span>}
            </NavLink>
          ))}
          <a href={docsUrl} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10">Documentación API ↗</a>
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
          <button className="btn-ghost lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">☰</button>
          <span className="hidden text-sm text-slate-500 lg:block">Año escolar {new Date().getFullYear()}</span>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/perfil')} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${meta.side}`}>
                {user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </span>
              <span className="hidden text-left text-sm sm:block"><b className="block leading-tight">{user.name}</b><span className="text-xs text-slate-500">{meta.label}</span></span>
            </button>
            <button className="btn-ghost" onClick={() => { logout(); navigate('/login'); }}>Salir</button>
          </div>
        </header>
        <main id="contenido" className="flex-1 p-4 sm:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
