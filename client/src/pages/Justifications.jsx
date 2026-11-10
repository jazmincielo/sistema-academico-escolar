import { useCallback, useEffect, useState } from 'react';
import { api, downloadFile, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, Empty, Modal, PageHeader, Spinner, fmtDate } from '../components/ui.jsx';

const COLOR = { Pendiente: 'amber', Aprobada: 'green', Rechazada: 'red' };

export default function Justifications() {
  const { user } = useAuth();
  const isAdmin = user.role === 'administrador';
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState(isAdmin ? 'Pendiente' : '');
  const [reviewing, setReviewing] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/justifications', { params: status ? { status } : {} }).then((r) => setItems(r.data.items)).catch((e) => setError(errorMessage(e)));
  }, [status]);
  useEffect(() => { setItems(null); load(); }, [load]);

  const review = async (decision) => {
    try { await api.patch(`/justifications/${reviewing._id}/review`, { status: decision, note }); setReviewing(null); setNote(''); load(); }
    catch (err) { setError(errorMessage(err)); setReviewing(null); }
  };

  return (
    <>
      <PageHeader title={isAdmin ? 'Aprobación de justificantes' : 'Mis justificaciones'} subtitle={isAdmin ? 'Regencia' : 'Para justificar una falta, vaya a Asistencia'} />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Estado">
        {['', 'Pendiente', 'Aprobada', 'Rechazada'].map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${status === s ? 'border-brand-700 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white'}`}>{s || 'Todas'}</button>))}
      </div>
      <Alert>{error}</Alert>
      {!items ? <Spinner /> : items.length === 0 ? <Empty>No hay solicitudes en este estado.</Empty> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full"><thead className="border-b bg-slate-50"><tr><th className="th">Ticket</th><th className="th">Estudiante</th><th className="th">Falta</th><th className="th">Motivo</th><th className="th">Estado</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{items.map((j) => (
              <tr key={j._id}><td className="td font-mono text-xs">{j.ticket}</td>
                <td className="td">{j.student?.name}{isAdmin && <div className="text-xs text-slate-500">Apoderado: {j.guardian?.name}</div>}</td>
                <td className="td">{j.attendance?.date && fmtDate(j.attendance.date)}<div className="text-xs text-slate-500">{j.attendance?.subject?.name}</div></td>
                <td className="td">{j.reason}{j.detail && <div className="text-xs text-slate-500">{j.detail}</div>}</td>
                <td className="td"><Badge color={COLOR[j.status]}>{j.status}</Badge>{j.reviewNote && <div className="text-xs text-slate-500">{j.reviewNote}</div>}</td>
                <td className="td space-x-3 text-right">
                  <button className="font-semibold text-brand-700 underline" onClick={() => downloadFile(`/justifications/${j._id}/file`, j.file?.originalName || 'comprobante')}>Comprobante</button>
                  {isAdmin && j.status === 'Pendiente' && <button className="btn-primary" onClick={() => setReviewing(j)}>Revisar</button>}</td></tr>))}</tbody></table>
        </div>)}

      {reviewing && (
        <Modal title={`Revisar ${reviewing.ticket}`} onClose={() => setReviewing(null)}>
          <p className="mb-3 text-sm text-slate-600">{reviewing.student?.name} — motivo: <b>{reviewing.reason}</b></p>
          <label className="label" htmlFor="rn">Nota para el apoderado (opcional)</label>
          <textarea id="rn" rows={3} maxLength={300} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-4 flex justify-end gap-2"><button className="btn-danger" onClick={() => review('Rechazada')}>Rechazar</button><button className="btn-success" onClick={() => review('Aprobada')}>Aprobar</button></div>
        </Modal>)}
    </>
  );
}
