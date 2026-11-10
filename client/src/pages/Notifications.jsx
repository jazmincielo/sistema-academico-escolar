import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client.js';
import { Alert, Badge, Empty, PageHeader, Spinner, fmtDateTime } from '../components/ui.jsx';

const COLORS = { calificacion: 'blue', asistencia: 'amber', tarea: 'green', justificacion: 'red', sistema: 'slate' };

export default function Notifications() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.get('/notifications').then((r) => setData(r.data)).catch((e) => setError(errorMessage(e))), []);
  useEffect(() => { load(); }, [load]);
  const refresh = () => { load(); window.dispatchEvent(new Event('sae:notifications')); };
  const markAll = async () => { await api.patch('/notifications/read-all'); refresh(); };
  const markOne = async (id) => { await api.patch(`/notifications/${id}/read`); refresh(); };

  if (!data) return error ? <Alert>{error}</Alert> : <Spinner />;
  return (
    <>
      <PageHeader title="Centro de notificaciones" subtitle={`${data.unread} sin leer`} actions={<button className="btn-ghost" onClick={markAll} disabled={!data.unread}>Marcar todas como leídas</button>} />
      {data.items.length ? (
        <ul className="space-y-2">
          {data.items.map((n) => (
            <li key={n._id} className={`card flex items-start justify-between gap-4 ${n.read ? 'opacity-70' : 'border-l-4 border-l-brand-600'}`}>
              <div><div className="mb-1 flex items-center gap-2"><Badge color={COLORS[n.type]}>{n.type}</Badge><b className="text-sm">{n.title}</b></div>
                <p className="text-sm text-slate-600">{n.message}</p><p className="mt-1 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p></div>
              {!n.read && <button className="btn-ghost shrink-0" onClick={() => markOne(n._id)}>Leída</button>}
            </li>))}
        </ul>
      ) : <Empty>No tiene notificaciones.</Empty>}
    </>
  );
}
