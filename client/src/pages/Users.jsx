import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client.js';
import { Alert, Badge, Empty, Modal, PageHeader, ROLE_META, Spinner } from '../components/ui.jsx';

const EMPTY = { name: '', email: '', password: '', role: 'estudiante', course: '', children: [] };

export default function Users() {
  const [data, setData] = useState(null);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState({ role: '', q: '' });
  const [editing, setEditing] = useState(null); // null | objeto (con _id = edición)
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    api.get('/users', { params: { ...filter, limit: 100 } }).then((r) => setData(r.data)).catch((e) => setError(errorMessage(e)));
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/users', { params: { role: 'estudiante', limit: 100 } }).then((r) => setStudents(r.data.items)); }, []);

  const save = async (e) => {
    e.preventDefault(); setFormError('');
    const { _id, ...body } = editing;
    if (!body.password) delete body.password;
    if (body.role !== 'apoderado') delete body.children;
    if (body.role !== 'estudiante') delete body.course;
    try {
      _id ? await api.put(`/users/${_id}`, body) : await api.post('/users', body);
      setEditing(null); load();
    } catch (err) { setFormError(errorMessage(err)); }
  };
  const toggle = async (u) => {
    try { u.active ? await api.delete(`/users/${u._id}`) : await api.put(`/users/${u._id}`, { active: true }); load(); }
    catch (err) { setError(errorMessage(err)); }
  };
  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Gestión de usuarios" subtitle={data ? `${data.total} cuentas` : ''} actions={<button className="btn-primary" onClick={() => setEditing({ ...EMPTY })}>+ Crear usuario</button>} />
      <Alert>{error}</Alert>
      <div className="my-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Buscar por nombre o correo…" aria-label="Buscar" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <select className="input max-w-[12rem]" aria-label="Filtrar por rol" value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })}>
          <option value="">Todos los roles</option>{Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {!data ? <Spinner /> : data.items.length === 0 ? <Empty>Sin resultados.</Empty> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50"><tr><th className="th">Usuario</th><th className="th">Rol</th><th className="th">Estado</th><th className="th text-right">Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((u) => (
                <tr key={u._id}>
                  <td className="td"><b>{u.name}</b><div className="text-xs text-slate-500">{u.email}{u.course ? ` · ${u.course}` : ''}</div></td>
                  <td className="td"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${ROLE_META[u.role].chip}`}>{ROLE_META[u.role].label}</span></td>
                  <td className="td"><Badge color={u.active ? 'green' : 'slate'}>{u.active ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="td space-x-3 text-right">
                    <button className="font-semibold text-purple-700 underline" onClick={() => setEditing({ ...u, password: '', children: (u.children || []).map((c) => c._id) })}>Editar</button>
                    <button className={`font-semibold underline ${u.active ? 'text-red-600' : 'text-emerald-700'}`} onClick={() => toggle(u)}>{u.active ? 'Desactivar' : 'Activar'}</button>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>)}

      {editing && (
        <Modal title={editing._id ? 'Editar usuario' : 'Crear usuario'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <Alert>{formError}</Alert>
            <div><label className="label" htmlFor="un">Nombre</label><input id="un" required className="input" value={editing.name} onChange={set('name')} /></div>
            <div><label className="label" htmlFor="ue">Correo</label><input id="ue" type="email" required className="input" value={editing.email} onChange={set('email')} /></div>
            <div><label className="label" htmlFor="up">Contraseña {editing._id && <span className="font-normal text-slate-400">(vacío = no cambiar)</span>}</label>
              <input id="up" type="password" minLength={8} required={!editing._id} className="input" value={editing.password || ''} onChange={set('password')} /></div>
            <div><label className="label" htmlFor="ur">Rol</label>
              <select id="ur" className="input" value={editing.role} onChange={set('role')}>{Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            {editing.role === 'estudiante' && <div><label className="label" htmlFor="uc">Curso</label><input id="uc" className="input" placeholder="1ro A" value={editing.course || ''} onChange={set('course')} /></div>}
            {editing.role === 'apoderado' && (
              <div><label className="label" htmlFor="uh">Estudiantes a cargo (Ctrl/⌘ para varios)</label>
                <select id="uh" multiple className="input h-32" value={editing.children} onChange={(e) => setEditing({ ...editing, children: [...e.target.selectedOptions].map((o) => o.value) })}>
                  {students.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.course})</option>)}</select></div>)}
            <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary">Guardar</button></div>
          </form>
        </Modal>)}
    </>
  );
}
