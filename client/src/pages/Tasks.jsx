import { useCallback, useEffect, useState } from 'react';
import { api, downloadFile, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import StudentPicker, { useStudents } from '../components/StudentPicker.jsx';
import { Alert, Badge, Empty, Modal, PageHeader, Spinner, fmtDate, fmtDateTime } from '../components/ui.jsx';

export default function Tasks() {
  const { user } = useAuth();
  const isTeacher = user.role === 'docente' || user.role === 'administrador';
  const students = useStudents();
  const [sid, setSid] = useState(students[0]?._id);
  const [items, setItems] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [creating, setCreating] = useState(null);   // formulario de tarea (docente)
  const [submitting, setSubmitting] = useState(null); // tarea a entregar (estudiante)
  const [viewing, setViewing] = useState(null);     // { task, items } entregas (docente)
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    api.get('/tasks', { params: user.role === 'apoderado' ? { student: sid } : {} }).then((r) => setItems(r.data.items)).catch((e) => setError(errorMessage(e)));
  }, [sid, user.role]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isTeacher) api.get('/subjects').then((r) => setSubjects(r.data.items)); }, [isTeacher]);

  const createTask = async (e) => {
    e.preventDefault(); setFormError('');
    const { _id, ...body } = creating;
    body.dueDate = new Date(`${body.dueDate}T23:59:00`).toISOString();
    try { _id ? await api.put(`/tasks/${_id}`, body) : await api.post('/tasks', body); setCreating(null); load(); }
    catch (err) { setFormError(errorMessage(err)); }
  };
  const remove = async (t) => {
    if (!window.confirm(`¿Eliminar la tarea "${t.title}" y sus entregas?`)) return;
    try { await api.delete(`/tasks/${t._id}`); load(); } catch (err) { setError(errorMessage(err)); }
  };
  const submitWork = async (e) => {
    e.preventDefault(); setFormError('');
    const fd = new FormData();
    if (file) fd.append('file', file);
    fd.append('comment', comment);
    try {
      await api.post(`/tasks/${submitting._id}/submissions`, fd);
      setSubmitting(null); setFile(null); setComment(''); setOk('Tarea entregada correctamente'); load();
    } catch (err) { setFormError(errorMessage(err)); }
  };
  const openSubs = async (t) => {
    try { const { data } = await api.get(`/tasks/${t._id}/submissions`); setViewing({ task: t, items: data.items }); }
    catch (err) { setError(errorMessage(err)); }
  };

  const status = (t) => t.submission ? <Badge color={t.submission.late ? 'amber' : 'green'}>{t.submission.late ? 'Entregada con retraso' : 'Entregada'}</Badge> : t.overdue ? <Badge color="red">Vencida</Badge> : <Badge color="blue">Pendiente</Badge>;

  return (
    <>
      <PageHeader title={isTeacher ? 'Tareas y evaluaciones' : 'Tareas'} subtitle={isTeacher ? 'Cree y asigne tareas a sus cursos' : 'Entregas y fechas límite'}
        actions={isTeacher && <button className="btn-primary" disabled={!subjects.length} onClick={() => setCreating({ subject: subjects[0]?._id, title: '', description: '', dueDate: '' })}>+ Nueva tarea</button>} />
      {user.role === 'apoderado' && <StudentPicker students={students} value={sid} onChange={setSid} />}
      <div className="mb-3 space-y-2"><Alert>{error}</Alert><Alert type="success">{ok}</Alert></div>

      {!items ? <Spinner /> : items.length === 0 ? <Empty>No hay tareas registradas.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((t) => (
            <article key={t._id} className="card flex flex-col">
              <div className="mb-1 flex items-start justify-between gap-2"><h2 className="font-bold">{t.title}</h2>{!isTeacher && status(t)}</div>
              <p className="text-xs text-slate-500">{t.subject?.name} · {t.subject?.course}</p>
              <p className="mt-2 flex-1 text-sm text-slate-600">{t.description || 'Sin instrucciones adicionales.'}</p>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">Entrega: <b>{fmtDate(t.dueDate)}</b></span>
                <div className="flex gap-2">
                  {isTeacher && <><button className="btn-ghost" onClick={() => openSubs(t)}>Entregas</button>
                    <button className="btn-ghost" onClick={() => setCreating({ _id: t._id, title: t.title, description: t.description, dueDate: t.dueDate.slice(0, 10) })}>Editar</button>
                    <button className="btn-danger" onClick={() => remove(t)}>Eliminar</button></>}
                  {user.role === 'estudiante' && <button className="btn-primary" onClick={() => { setFormError(''); setSubmitting(t); }}>{t.submission ? 'Reenviar' : 'Entregar'}</button>}
                </div>
              </div>
            </article>))}
        </div>)}

      {creating && (
        <Modal title={creating._id ? 'Editar tarea' : 'Nueva tarea'} onClose={() => setCreating(null)}>
          <form onSubmit={createTask} className="space-y-3">
            <Alert>{formError}</Alert>
            {!creating._id && <div><label className="label" htmlFor="ts">Materia</label><select id="ts" className="input" value={creating.subject} onChange={(e) => setCreating({ ...creating, subject: e.target.value })}>{subjects.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.course}</option>)}</select></div>}
            <div><label className="label" htmlFor="tt">Título</label><input id="tt" required minLength={3} className="input" value={creating.title} onChange={(e) => setCreating({ ...creating, title: e.target.value })} /></div>
            <div><label className="label" htmlFor="td">Instrucciones</label><textarea id="td" rows={4} className="input" value={creating.description} onChange={(e) => setCreating({ ...creating, description: e.target.value })} /></div>
            <div><label className="label" htmlFor="tf">Fecha límite</label><input id="tf" type="date" required className="input" value={creating.dueDate} onChange={(e) => setCreating({ ...creating, dueDate: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setCreating(null)}>Cancelar</button><button className="btn-primary">Guardar</button></div>
          </form>
        </Modal>)}

      {submitting && (
        <Modal title={`Entregar: ${submitting.title}`} onClose={() => setSubmitting(null)}>
          <form onSubmit={submitWork} className="space-y-3">
            <Alert>{formError}</Alert>
            <div><label className="label" htmlFor="sf">Archivo (PDF, JPG, PNG, DOCX, ZIP o TXT — máx. 5MB)</label><input id="sf" type="file" className="input" onChange={(e) => setFile(e.target.files[0])} /></div>
            <div><label className="label" htmlFor="sc">Comentario</label><textarea id="sc" rows={3} className="input" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setSubmitting(null)}>Cancelar</button><button className="btn-primary">Enviar tarea</button></div>
          </form>
        </Modal>)}

      {viewing && (
        <Modal wide title={`Entregas: ${viewing.task.title}`} onClose={() => setViewing(null)}>
          {viewing.items.length === 0 ? <Empty>Aún no hay entregas.</Empty> : (
            <table className="w-full"><thead className="border-b"><tr><th className="th">Estudiante</th><th className="th">Entregada</th><th className="th">Archivo</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{viewing.items.map((s) => (
                <tr key={s._id}><td className="td">{s.student?.name}{s.comment && <div className="text-xs text-slate-500">{s.comment}</div>}</td>
                  <td className="td">{fmtDateTime(s.updatedAt)} {s.late && <Badge color="amber">Tarde</Badge>}</td>
                  <td className="td">{s.file?.originalName ? <button className="font-semibold text-brand-700 underline" onClick={() => downloadFile(`/tasks/submissions/${s._id}/file`, s.file.originalName)}>{s.file.originalName}</button> : '—'}</td></tr>))}</tbody></table>)}
        </Modal>)}
    </>
  );
}
