import { useAuth } from '../context/AuthContext.jsx';
import { Badge, PageHeader, ROLE_META, fmtDate } from '../components/ui.jsx';

export default function Profile() {
  const { user } = useAuth();
  const rows = [['Nombre', user.name], ['Correo', user.email], ['Rol', ROLE_META[user.role].label], ['Curso', user.course], ['Miembro desde', fmtDate(user.createdAt)]];
  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Sesión activa verificada con JWT" />
      <div className="card max-w-xl">
        <dl className="divide-y divide-slate-100">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between py-2.5 text-sm"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          {user.children?.length > 0 && <div className="py-2.5 text-sm"><dt className="mb-1 text-slate-500">Estudiantes a cargo</dt>{user.children.map((c) => <Badge key={c._id} color="green">{c.name}</Badge>)}</div>}
        </dl>
      </div>
    </>
  );
}
