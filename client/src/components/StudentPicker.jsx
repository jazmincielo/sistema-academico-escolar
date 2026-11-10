import { useAuth } from '../context/AuthContext.jsx';

/** Para apoderados: selector del estudiante a cargo. Para el estudiante devuelve su propio id. */
export function useStudents() {
  const { user } = useAuth();
  if (user.role === 'estudiante') return [{ _id: user._id, name: user.name, course: user.course }];
  if (user.role === 'apoderado') return user.children || [];
  return [];
}

export default function StudentPicker({ students, value, onChange }) {
  if (students.length <= 1) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Estudiante">
      {students.map((s) => (
        <button key={s._id} role="tab" aria-selected={value === s._id} onClick={() => onChange(s._id)}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${value === s._id ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white'}`}>
          {s.name} <span className="text-xs text-slate-500">{s.course}</span>
        </button>
      ))}
    </div>
  );
}
