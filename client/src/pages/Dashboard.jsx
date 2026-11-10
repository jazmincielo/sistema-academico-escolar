import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, Empty, PageHeader, Spinner, StatCard, fmtDate, scoreColor } from '../components/ui.jsx';

const Metrics = ({ d }) => (
  <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Promedio general" value={d.generalAverage} hint="sobre 100" tone={scoreColor(d.generalAverage)} />
      <StatCard label="Asistencia" value={d.attendance != null ? `${d.attendance}%` : null} />
      <StatCard label="Faltas sin justificar" value={d.unjustified} tone={d.unjustified ? 'text-red-600' : 'text-emerald-700'} />
      <StatCard label="Tareas pendientes" value={d.pendingTasks} tone="text-amber-600" />
    </div>
  </>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/dashboard').then((r) => setD(r.data)).catch((e) => setError(errorMessage(e))); }, []);
  if (error) return <Alert>{error}</Alert>;
  if (!d) return <Spinner />;

  return (
    <>
      <PageHeader title={`Hola, ${user.name.replace(/^(Prof\.?|Dr\.?|Lic\.?)\s+/i, '').split(' ')[0]}`} subtitle="Resumen en tiempo real según su rol" />

      {d.role === 'administrador' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Estudiantes" value={d.users.estudiante || 0} tone="text-brand-700" />
            <StatCard label="Docentes" value={d.users.docente || 0} tone="text-emerald-700" />
            <StatCard label="Apoderados" value={d.users.apoderado || 0} tone="text-purple-700" />
            <StatCard label="Materias" value={d.subjects} tone="text-slate-700" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/justificaciones" className="card block hover:border-amber-400"><b className="text-3xl text-amber-600">{d.pendingJustifications}</b><div className="text-sm text-slate-600">Justificaciones pendientes de revisión</div></Link>
            <Link to="/usuarios" className="card block hover:border-purple-400"><b className="text-3xl text-red-600">{d.inactive}</b><div className="text-sm text-slate-600">Cuentas desactivadas</div></Link>
          </div>
        </div>
      )}

      {d.role === 'docente' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Materias a cargo" value={d.subjects.length} />
            <StatCard label="Estudiantes" value={d.totalStudents} tone="text-purple-700" />
            <StatCard label="Promedio general" value={d.generalAverage} tone={scoreColor(d.generalAverage)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card"><h2 className="mb-3 font-bold">Mis materias</h2>
              {d.subjects.length ? d.subjects.map((s) => (
                <div key={s._id} className="flex items-center justify-between border-t border-slate-100 py-2.5 first:border-0">
                  <div><b className="text-sm">{s.name}</b><div className="text-xs text-slate-500">{s.course} · {s.students} estudiantes</div></div>
                  <span className={`font-bold ${scoreColor(s.average)}`}>{s.average ?? '—'}</span>
                </div>)) : <Empty>Aún no tiene materias asignadas.</Empty>}
            </section>
            <section className="card"><h2 className="mb-3 font-bold">Próximas entregas</h2>
              {d.upcomingTasks.length ? d.upcomingTasks.map((t) => (
                <div key={t._id} className="flex items-center justify-between border-t border-slate-100 py-2.5 first:border-0">
                  <div><b className="text-sm">{t.title}</b><div className="text-xs text-slate-500">{t.subject?.name}</div></div><Badge color="amber">{fmtDate(t.dueDate)}</Badge>
                </div>)) : <Empty>Sin tareas próximas.</Empty>}
            </section>
          </div>
        </div>
      )}

      {d.role === 'estudiante' && <Metrics d={d} />}

      {d.role === 'apoderado' && (
        <div className="space-y-6">
          {d.pendingJustifications > 0 && <Alert type="warning">Tiene {d.pendingJustifications} solicitud(es) de justificación en revisión.</Alert>}
          {d.children.length ? d.children.map((c) => (
            <section key={c.student._id}>
              <h2 className="mb-3 text-lg font-bold">{c.student.name} <span className="text-sm font-normal text-slate-500">{c.student.course}</span></h2>
              <Metrics d={c} />
              {c.unjustified > 0 && <div className="mt-3"><Link className="btn-success" to="/asistencia">Justificar inasistencia</Link></div>}
            </section>)) : <Empty>No tiene estudiantes vinculados. Solicite al administrador que los asocie a su cuenta.</Empty>}
        </div>
      )}
    </>
  );
}
