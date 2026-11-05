import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request, tokenStore } from './api';
const normalizeUser = user => user ? { ...user, full_name: user.full_name || user.name || '' } : null;
const AuthContext = createContext(null);
const ToastContext = createContext(null);
export function Providers({ children }) {
  const [token, setToken] = useState(tokenStore.get);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(null);
  const notify = useCallback((message, kind = 'success') => setNotice({ message, kind, id: Date.now() }), []);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 6500); return () => clearTimeout(t); }, [notice]);
  const clear = useCallback(() => { tokenStore.set(null); setToken(null); setUser(null); }, []);
  const call = useCallback(async (path, options = {}) => {
    try { return await request(path, { ...options, token }); }
    catch (error) {
      if (error.status === 401) { clear(); notify('Phiên đăng nhập đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.', 'error'); }
      if (error.status === 403 && token) {
        // A forbidden business action preserves the session. A locked account ends it.
        try { const current = await request('/api/auth/me', { token }); setUser(normalizeUser(current.user)); }
        catch (sessionError) { if ([401, 403].includes(sessionError.status)) { clear(); notify(sessionError.message, 'error'); } }
      }
      throw error;
    }
  }, [token, clear, notify]);
  const refresh = useCallback(async () => {
    if (!token) return;
    try { const r = await call('/api/auth/me'); setUser(normalizeUser(r.user)); }
    catch (e) { if (e.status === 403) { clear(); notify(e.message, 'error'); } throw e; }
  }, [token, call, clear, notify]);
  useEffect(() => {
    let active = true;
    if (!token) { setReady(true); return; }
    request('/api/auth/me', { token }).then(r => { if (active) setUser(normalizeUser(r.user)); })
      .catch(e => { if (active) { if (e.status === 401 || e.status === 403) clear(); notify(e.message, 'error'); } })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [token, clear, notify]);
  useEffect(() => {
    if (!token) return;
    const onFocus = () => refresh().catch(() => {});
    window.addEventListener('focus', onFocus);
    const t = setInterval(onFocus, 60000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(t); };
  }, [token, refresh]);
  const signIn = useCallback(result => { tokenStore.set(result.token); setToken(result.token); setUser(normalizeUser(result.user)); setReady(true); }, []);
  const logout = useCallback(async () => { const current = token; clear(); if (current) await request('/api/auth/logout', { token: current, method: 'POST' }).catch(() => {}); }, [token, clear]);
  const auth = useMemo(() => ({ user, ready, call, signIn, logout, refresh }), [user, ready, call, signIn, logout, refresh]);
  return <AuthContext.Provider value={auth}><ToastContext.Provider value={notify}>{children}{notice && <div key={notice.id} className={`toast ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.message}<button aria-label="Đóng thông báo" onClick={() => setNotice(null)}>×</button></div>}</ToastContext.Provider></AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
export const useNotify = () => useContext(ToastContext);
