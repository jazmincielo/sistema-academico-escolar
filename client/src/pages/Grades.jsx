import { useEffect, useState } from 'react';
import { api, downloadFile, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import StudentPicker, { useStudents } from '../components/StudentPicker.jsx';
import { Alert, Empty, PageHeader, Spinner, scoreColor } from '../components/ui.jsx';

/* ---------- Docente: planilla de notas (UC-03) ---------- */
function TeacherSheet() {
  const [subjects, setSubjects] = useState(null);
  const [subject, setSubject] = useState('');
  const [period, setPeriod] = useState('T1');
  const [sheet, setSheet] = useState(null);
  const [scores, setScores] = useState({});
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/subjects').then((r) => { setSubjects(r.data.items); if (r.data.items[0]) setSubject(r.data.items[0]._id); }); }, []);
  useEffect(() => {
    if (!subject) return;
    setSheet(null); setMsg({ type: '', text: '' });
    api.get('/grades/sheet', { params: { subject, period } })
      .then((r) => { setSheet(r.data); setScores(Object.fromEntries(r.data.rows.map((x) => [x.student._id, x.score ?? '']))); })
      .catch((e) => setMsg({ type: 'error', text: errorMessage(e) }));
  }, [subject, period]);

  const invalid = (v) => v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100);
  const hasInvalid = Object.values(scores).some(invalid);

  const save = async () => {
    setBusy(true); setMsg({ type: '', text: '' });
    const grades = Object.entries(scores).filter(([, v]) => v !== '').map(([student, v]) => ({ student, score: Number(v) }));
    try {
      const { data } = await api.put('/grades/bulk', { subject, period, grades });
      setMsg({ type: 'success', text: `${data.message}. Se notificó a estudiantes y apoderados.` });
    } catch (e) { setMsg({ type: 'error', text: errorMessage(e) }); } finally { setBusy(false); }
  };

  if (!subjects) return <Spinner />;
  if (!subjects.length) return <Empty>No tiene materias asignadas.</Empty>;
  return (
    <>
      <PageHeader title="Carga y publicación de calificaciones" subtitle="Escala 0–100" />
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input max-w-xs" aria-label="Materia" value={subject} onChange={(e) => setSubject(e.target.value)}>{subjects.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.course}</option>)}</select>
        <select className="input max-w-[10rem]" aria-label="Periodo" value={period} onChange={(e) => setPeriod(e.target.value)}>{['T1', 'T2', 'T3'].map((p) => <option key={p} value={p}>Trimestre {p.slice(1)}</option>)}</select>
      </div>
      <div className="mb-3 space-y-2"><Alert type={msg.type || 'error'}>{msg.text}</Alert>{hasInvalid && <Alert>Nota fuera de rango (0-100). Corrija las celdas en rojo para guardar.</Alert>}</div>
      {!sheet ? <Spinner /> : (
        <div className="card p-0">
          <table className="w-full"><thead className="border-b bg-slate-50"><tr><th className="th">Estudiante</th><th className="th w-40">Nota (0-100)</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{sheet.rows.map((r) => (
              <tr key={r.student._id}><td className="td">{r.student.name}</td>
                <td className="td"><input type="number" min="0" max="100" step="0.1" aria-label={`Nota de ${r.student.name}`} aria-invalid={invalid(scores[r.student._id])}
                  className={`input w-28 ${invalid(scores[r.student._id]) ? 'border-red-500 bg-red-50' : ''}`} value={scores[r.student._id] ?? ''} onChange={(e) => setScores({ ...scores, [r.student._id]: e.target.value })} /></td></tr>))}</tbody></table>
          <div className="flex justify-end border-t p-4"><button className="btn-primary" disabled={busy || hasInvalid} onClick={save}>{busy ? 'Guardando…' : 'Guardar y Publicar'}</button></div>
        </div>)}
    </>
  );
}

/* ---------- Estudiante / Apoderado: boletín ---------- */
function Bulletin() {
  const students = useStudents();
  const [sid, setSid] = useState(students[0]?._id);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sid) return;
    setData(null);
    api.get(`/grades/bulletin/${sid}`).then((r) => setData(r.data)).catch((e) => setError(errorMessage(e)));
  }, [sid]);

  if (!students.length) return <Empty>No tiene estudiantes vinculados.</Empty>;
  const name = students.find((s) => s._id === sid)?.name;
  const pdf = () => downloadFile(`/reports/bulletin/${sid}`, `boletin-${name}.pdf`).catch((e) => setError(errorMessage(e)));

  return (
    <>
      <PageHeader title="Boletín de calificaciones" subtitle={name} actions={<button className="btn-primary" onClick={pdf} disabled={!data}>Descargar PDF</button>} />
      <StudentPicker students={students} value={sid} onChange={setSid} />
      <Alert>{error}</Alert>
      {!data ? <Spinner /> : data.rows.length === 0 ? <Empty>Aún no hay materias ni calificaciones.</Empty> : (
        <>
          <div className="card mb-4 inline-block"><span className="text-sm text-slate-500">Promedio general </span><b className={`text-2xl ${scoreColor(data.generalAverage)}`}>{data.generalAverage ?? '—'}</b></div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full"><thead className="border-b bg-slate-50"><tr><th className="th">Asignatura</th><th className="th">Docente</th><th className="th">T1</th><th className="th">T2</th><th className="th">T3</th><th className="th">Promedio</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{data.rows.map((r) => (
                <tr key={r.subject._id}><td className="td font-medium">{r.subject.name}</td><td className="td text-slate-500">{r.subject.teacher}</td>
                  {['T1', 'T2', 'T3'].map((p) => <td key={p} className={`td ${scoreColor(r[p])}`}>{r[p] ?? '—'}</td>)}
                  <td className={`td font-bold ${scoreColor(r.average)}`}>{r.average ?? '—'}</td></tr>))}</tbody></table>
          </div>
        </>)}
    </>
  );
}

export default function Grades() {
  const { user } = useAuth();
  return user.role === 'docente' || user.role === 'administrador' ? <TeacherSheet /> : <Bulletin />;
}
