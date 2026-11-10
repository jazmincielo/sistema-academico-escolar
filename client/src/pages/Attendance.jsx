import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import StudentPicker, { useStudents } from '../components/StudentPicker.jsx';
import { Alert, Badge, Empty, Modal, PageHeader, Spinner, fmtDate } from '../components/ui.jsx';

const STATUS = { presente: ['green', 'Presente'], ausente: ['red', 'Ausente'], tardanza: ['amber', 'Tardanza'], justificada: ['blue', 'Justificada'] };
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- Docente: toma de asistencia (RF-005) ---------- */
function TakeAttendance() {
  const [subjects, setSubjects] = useState(null);
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(today());
  const [sheet, setSheet] = useState(null);
  const [status, setStatus] = useState({});
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => { api.get('/subjects').then((r) => { setSubjects(r.data.items); if (r.data.items[0]) setSubject(r.data.items[0]._id); }); }, []);
  useEffect(() => {
    if (!subject || !date) return;
    setSheet(null); setMsg({ type: '', text: '' });
    api.get('/attendance/sheet', { params: { subject, date } })
      .then((r) => { setSheet(r.data); setStatus(Object.fromEntries(r.data.rows.map((x) => [x.student._id, x.status]))); })
      .catch((e) => setMsg({ type: 'error', text: errorMessage(e) }));
  }, [subject, date]);

  const save = async () => {
    try {
      const records = Object.entries(status).filter(([, s]) => s !== 'justificada').map(([student, s]) => ({ student, status: s }));
      const { data } = await api.post('/attendance/bulk', { subject, date, records });
      setMsg({ type: 'success', text: `${data.message} (${data.saved} registros).` });
    } catch (e) { setMsg({ type: 'error', text: errorMessage(e) }); }
  };
  const markAll = (s) => setStatus(Object.fromEntries(Object.keys(status).map((k) => [k, status[k] === 'justificada' ? 'justificada' : s])));

  if (!subjects) return <Spinner />;
  if (!subjects.length) return <Empty>No tiene materias asignadas.</Empty>;
  return (
    <>
      <PageHeader title="Toma de asistencia" subtitle="Registro diario por asignatura" />
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input max-w-xs" aria-label="Materia" value={subject} onChange={(e) => setSubject(e.target.value)}>{subjects.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.course}</option>)}</select>
        <input type="date" className="input max-w-[11rem]" aria-label="Fecha" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        <button className="btn-ghost" onClick={() => markAll('presente')}>Todos presentes</button>
      </div>
      <div className="mb-3"><Alert type={msg.type || 'error'}>{msg.text}</Alert></div>
      {!sheet ? <Spinner /> : (
        <div className="card p-0">
          <ul className="divide-y divide-slate-100">{sheet.rows.map((r) => (
            <li key={r.student._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="text-sm font-medium">{r.student.name}</span>
              {status[r.student._id] === 'justificada' ? <Badge color="blue">Justificada</Badge> : (
                <div className="flex gap-1" role="group" aria-label={`Asistencia de ${r.student.name}`}>
                  {['presente', 'tardanza', 'ausente'].map((s) => (
                    <button key={s} aria-pressed={status[r.student._id] === s} onClick={() => setStatus({ ...status, [r.student._id]: s })}
                      className={`rounded-md border px-3 py-1 text-xs font-semibold ${status[r.student._id] === s ? (s === 'presente' ? 'border-emerald-700 bg-emerald-700 text-white' : s === 'ausente' ? 'border-red-600 bg-red-600 text-white' : 'border-amber-500 bg-amber-500 text-white') : 'border-slate-300 bg-white text-slate-600'}`}>
                      {STATUS[s][1]}</button>))}
                </div>)}
            </li>))}</ul>
          <div className="flex justify-end border-t p-4"><button className="btn-primary" onClick={save}>Guardar asistencia</button></div>
        </div>)}
    </>
  );
}

/* ---------- Estudiante / Apoderado: récord + justificación (UC-08) ---------- */
function MyAttendance() {
  const { user } = useAuth();
  const students = useStudents();
  const [sid, setSid] = useState(students[0]?._id);
  const [items, setItems] = useState(null);
  const [summary, setSummary] = useState(null);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ reason: 'Salud', detail: '', file: null });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = () => {
    if (!sid) return;
    api.get('/attendance', { params: { student: sid } }).then((r) => setItems(r.data.items)).catch((e) => setError(errorMessage(e)));
    api.get(`/attendance/summary/${sid}`).then((r) => setSummary(r.data));
  };
  useEffect(() => { setItems(null); load(); /* eslint-disable-next-line */ }, [sid]);

  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (!form.file) return setError('Adjunte un comprobante en formato PDF o JPG (máx. 5MB)');
    const fd = new FormData();
    fd.append('attendance', target._id); fd.append('reason', form.reason); fd.append('detail', form.detail); fd.append('file', form.file);
    try {
      const { data } = await api.post('/justifications', fd);
      setTarget(null); setForm({ reason: 'Salud', detail: '', file: null });
      setOk(`Solicitud enviada. Ticket de seguimiento: ${data.justification.ticket}`); load();
    } catch (err) { setError(errorMessage(err)); }
  };

  if (!students.length) return <Empty>No tiene estudiantes vinculados.</Empty>;
  return (
    <>
      <PageHeader title="Asistencia" subtitle={students.find((s) => s._id === sid)?.name} />
      <StudentPicker students={students} value={sid} onChange={setSid} />
      <div className="space-y-2"><Alert>{!target && error}</Alert><Alert type="success">{ok}</Alert></div>
      {summary && <div className="my-4 flex flex-wrap gap-3">
        <div className="card"><b className="text-2xl text-brand-700">{summary.percentage ?? '—'}{summary.percentage != null && '%'}</b><div className="text-xs text-slate-500">Asistencia</div></div>
        <div className="card"><b className="text-2xl text-red-600">{summary.ausente}</b><div className="text-xs text-slate-500">Sin justificar</div></div>
        <div className="card"><b className="text-2xl text-blue-700">{summary.justificada}</b><div className="text-xs text-slate-500">Justificadas</div></div>
      </div>}
      {!items ? <Spinner /> : items.length === 0 ? <Empty>Sin registros de asistencia.</Empty> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full"><thead className="border-b bg-slate-50"><tr><th className="th">Fecha</th><th className="th">Materia</th><th className="th">Estado</th>{user.role === 'apoderado' && <th className="th" />}</tr></thead>
            <tbody className="divide-y divide-slate-100">{items.map((a) => (
              <tr key={a._id}><td className="td">{fmtDate(a.date)}</td><td className="td">{a.subject?.name}</td>
                <td className="td"><Badge color={STATUS[a.status][0]}>{STATUS[a.status][1]}</Badge>{a.justification && <span className="ml-2 text-xs text-slate-500">{a.justification.status} · {a.justification.ticket}</span>}</td>
                {user.role === 'apoderado' && <td className="td text-right">{a.status === 'ausente' && (!a.justification || a.justification.status === 'Rechazada') && <button className="btn-success" onClick={() => { setError(''); setTarget(a); }}>Justificar</button>}</td>}</tr>))}</tbody></table>
        </div>)}

      {target && (
        <Modal title="Justificar inasistencia" onClose={() => setTarget(null)}>
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-slate-600">Falta del {fmtDate(target.date)} en {target.subject?.name}.</p>
            <Alert>{error}</Alert>
            <div><label className="label" htmlFor="jr">Motivo</label><select id="jr" className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>{['Salud', 'Familiar', 'Fuerza Mayor'].map((m) => <option key={m}>{m}</option>)}</select></div>
            <div><label className="label" htmlFor="jd">Detalle (opcional)</label><textarea id="jd" rows={3} maxLength={500} className="input" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></div>
            <div><label className="label" htmlFor="jf">Comprobante (PDF o JPG, máx. 5MB)</label><input id="jf" type="file" accept="application/pdf,image/jpeg" className="input" onChange={(e) => setForm({ ...form, file: e.target.files[0] })} /></div>
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setTarget(null)}>Cancelar</button><button className="btn-success">Enviar solicitud</button></div>
          </form>
        </Modal>)}
    </>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  return user.role === 'docente' || user.role === 'administrador' ? <TakeAttendance /> : <MyAttendance />;
}
