import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  // Restaura la sesión al recargar la página (GET /auth/me)
  useEffect(() => {
    if (!tokenStore.get()) return;
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(logout).finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => {
    window.addEventListener('sae:unauthorized', logout);
    return () => window.removeEventListener('sae:unauthorized', logout);
  }, [logout]);

  const startSession = useCallback(async ({ token }) => {
    tokenStore.set(token);
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(() => ({
    user, loading, logout, startSession,
    login: async (email, password) => startSession((await api.post('/auth/login', { email, password })).data),
    register: async (payload) => startSession((await api.post('/auth/register', payload)).data),
    verifyOtp: async (email, code) => startSession((await api.post('/auth/otp/verify', { email, code })).data),
    refreshUser: async () => setUser((await api.get('/auth/me')).data.user),
  }), [user, loading, logout, startSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
