import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client.js';
import { Alert, Empty, Modal, PageHeader, Spinner } from '../components/ui.jsx';

const EMPTY = { name: '', course: '', schedule: '', teacher: '', students: [] };

export default function Subjects() {
  const [items, setItems] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(() => api.get('/subjects').then((r) => setItems(r.data.items)).catch((e) => setError(errorMessage(e))), []);
  useEffect(() => {
    load();
    api.get('/users', { params: { role: 'docente', active: true, limit: 100 } }).then((r) => setTeachers(r.data.items));
    api.get('/users', { params: { role: 'estudiante', active: true, limit: 100 } }).then((r) => setStudents(r.data.items));
  }, [load]);

  const save = async (e) => {
    e.preventDefault(); setFormError('');
    const { _id, ...body } = editing;
    try { _id ? await api.put(`/subjects/${_id}`, body) : await api.post('/subjects', body); setEditing(null); load(); }
    catch (err) { setFormError(errorMessage(err)); }
  };
  const remove = async (s) => {
    if (!window.confirm(`¿Eliminar la materia "${s.name}"?`)) return;
    try { await api.delete(`/subjects/${s._id}`); load(); } catch (err) { setError(errorMessage(err)); }
  };
  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Materias" subtitle="Asignación de docentes y matrícula de estudiantes" actions={<button className="btn-primary" onClick={() => setEditing({ ...EMPTY })}>+ Nueva materia</button>} />
      <Alert>{error}</Alert>
      {!items ? <Spinner /> : items.length === 0 ? <Empty>No hay materias registradas.</Empty> : (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="w-full"><thead className="border-b bg-slate-50"><tr><th className="th">Materia</th><th className="th">Curso</th><th className="th">Docente</th><th className="th">Estudiantes</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{items.map((s) => (
              <tr key={s._id}><td className="td font-semibold">{s.name}<div className="text-xs font-normal text-slate-500">{s.schedule}</div></td><td className="td">{s.course}</td><td className="td">{s.teacher?.name}</td><td className="td">{s.studentCount}</td>
                <td className="td space-x-3 text-right">
                  <button className="font-semibold text-purple-700 underline" onClick={() => setEditing({ ...s, teacher: s.teacher?._id, students: s.students || [] })}>Editar</button>
                  <button className="font-semibold text-red-600 underline" onClick={() => remove(s)}>Eliminar</button></td></tr>))}</tbody></table>
        </div>)}

      {editing && (
        <Modal title={editing._id ? 'Editar materia' : 'Nueva materia'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <Alert>{formError}</Alert>
            <div><label className="label" htmlFor="sn">Nombre</label><input id="sn" required className="input" value={editing.name} onChange={set('name')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="sc">Curso</label><input id="sc" required className="input" placeholder="1ro A" value={editing.course} onChange={set('course')} /></div>
              <div><label className="label" htmlFor="ss">Horario</label><input id="ss" className="input" value={editing.schedule || ''} onChange={set('schedule')} /></div>
            </div>
            <div><label className="label" htmlFor="st">Docente</label>
              <select id="st" required className="input" value={editing.teacher} onChange={set('teacher')}><option value="">Seleccione…</option>{teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
            <div><label className="label" htmlFor="sm">Estudiantes matriculados (Ctrl/⌘ para varios)</label>
              <select id="sm" multiple className="input h-36" value={editing.students} onChange={(e) => setEditing({ ...editing, students: [...e.target.selectedOptions].map((o) => o.value) })}>
                {students.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.course})</option>)}</select></div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary">Guardar</button></div>
          </form>
        </Modal>)}
    </>
  );
}
