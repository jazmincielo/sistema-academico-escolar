import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert } from '../components/ui.jsx';

export default function Login() {
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('otp'); // 'otp' | 'password'
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: '', password: '', code: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const sendOtp = (e) => { e.preventDefault(); run(async () => {
    const { data } = await api.post('/auth/otp/request', { email: form.email });
    setInfo(data.devCode ? `${data.message}. (Modo desarrollo) Código: ${data.devCode}` : data.message);
    setStep(2);
  }); };
  const confirmOtp = (e) => { e.preventDefault(); run(async () => { await verifyOtp(form.email, form.code); navigate('/'); }); };
  const passLogin = (e) => { e.preventDefault(); run(async () => { await login(form.email, form.password); navigate('/'); }); };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 text-2xl text-white" aria-hidden>🎓</div>
          <h1 className="text-xl font-bold">Sistema Académico Escolar</h1>
          <p className="text-sm text-slate-500">Ingrese con su correo institucional</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium" role="tablist">
          {[['otp', 'Código OTP'], ['password', 'Contraseña']].map(([m, l]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setStep(1); setError(''); }}
              className={`rounded-md py-2 ${mode === m ? 'bg-white shadow' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>

        <div className="space-y-4">
          <Alert>{error}</Alert>
          {mode === 'otp' && step === 1 && (
            <form onSubmit={sendOtp} className="space-y-4">
              <div><label className="label" htmlFor="email">Correo institucional</label>
                <input id="email" type="email" required autoComplete="email" className="input" placeholder="usuario@colegio.edu" value={form.email} onChange={set('email')} /></div>
              <button className="btn-primary w-full" disabled={busy}>{busy ? 'Enviando…' : 'Enviar código OTP'}</button>
            </form>
          )}
          {mode === 'otp' && step === 2 && (
            <form onSubmit={confirmOtp} className="space-y-4">
              <Alert type="success">{info}</Alert>
              <div><label className="label" htmlFor="code">Código de 6 dígitos</label>
                <input id="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" className="input text-center text-2xl tracking-[.5em]" value={form.code} onChange={set('code')} /></div>
              <button className="btn-primary w-full" disabled={busy || form.code.length !== 6}>{busy ? 'Verificando…' : 'Verificar e ingresar'}</button>
              <button type="button" className="btn-ghost w-full" onClick={sendOtp} disabled={busy}>Reenviar código</button>
            </form>
          )}
          {mode === 'password' && (
            <form onSubmit={passLogin} className="space-y-4">
              <div><label className="label" htmlFor="email2">Correo institucional</label>
                <input id="email2" type="email" required autoComplete="email" className="input" value={form.email} onChange={set('email')} /></div>
              <div><label className="label" htmlFor="pass">Contraseña</label>
                <input id="pass" type="password" required autoComplete="current-password" className="input" value={form.password} onChange={set('password')} /></div>
              <button className="btn-primary w-full" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">¿Sin cuenta? <Link className="font-semibold text-brand-700 underline" to="/registro">Regístrese</Link></p>
      </div>
    </div>
  );
}
