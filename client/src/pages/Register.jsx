import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../api/client.js';
import { Alert } from '../components/ui.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'apoderado' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await register(form); navigate('/'); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-8">
        <h1 className="text-xl font-bold">Crear cuenta</h1>
        <p className="text-sm text-slate-500">Los docentes y administradores son dados de alta por el colegio.</p>
        <Alert>{error}</Alert>
        <div><label className="label" htmlFor="n">Nombre completo</label><input id="n" required minLength={3} className="input" value={form.name} onChange={set('name')} /></div>
        <div><label className="label" htmlFor="e">Correo electrónico</label><input id="e" type="email" required className="input" value={form.email} onChange={set('email')} /></div>
        <div><label className="label" htmlFor="p">Contraseña (mín. 8 caracteres)</label><input id="p" type="password" required minLength={8} className="input" value={form.password} onChange={set('password')} /></div>
        <div><label className="label" htmlFor="r">Soy</label>
          <select id="r" className="input" value={form.role} onChange={set('role')}><option value="apoderado">Apoderado / Tutor</option><option value="estudiante">Estudiante</option></select></div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creando…' : 'Registrarme'}</button>
        <p className="text-center text-sm text-slate-500">¿Ya tiene cuenta? <Link className="font-semibold text-brand-700 underline" to="/login">Ingresar</Link></p>
      </form>
    </div>
  );
}
