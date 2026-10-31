import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, authApi, createApi, request } from './api.js';

const TOKEN_KEY = 'fitlife.token';
const AuthContext = createContext(null);

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeToken(value) {
  try {
    if (value === null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, value);
  } catch { /* private mode: phiên chỉ sống trong tab */ }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(token));

  const clearSession = useCallback(() => {
    writeToken(null);
    setToken(null);
    setUser(null);
  }, []);

  // Mở lại trang với token cũ: hỏi backend token còn hợp lệ không.
  useEffect(() => {
    if (!token || user) return;
    let cancelled = false;
    authApi.me(token)
      .then((data) => { if (!cancelled) setUser(data.user); })
      .catch(() => { if (!cancelled) clearSession(); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [token, user, clearSession]);

  const acceptSession = useCallback((data) => {
    writeToken(data.token);
    setToken(data.token);
    setUser(data.user);
    setChecking(false);
  }, []);

  // Response nào có fit_coins thì cập nhật luôn số xu trên thanh trên cùng.
  const api = useMemo(() => createApi(async (path, options) => {
    try {
      const data = await request(path, { ...options, token });
      if (typeof data?.fit_coins === 'number') {
        setUser((u) => (u ? { ...u, profile: { ...u.profile, coins: data.fit_coins } } : u));
      }
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) clearSession();
      throw err;
    }
  }), [token, clearSession]);

  const value = useMemo(() => ({
    user,
    checking,
    api,
    async login(email, password) { acceptSession(await authApi.login(email, password)); },
    async register(payload) { acceptSession(await authApi.register(payload)); },
    // Sau khi sửa hồ sơ, mục tiêu nước/calo được backend tính lại.
    async refreshUser() { setUser((await authApi.me(token)).user); },
    async logout() {
      if (token) await authApi.logout(token).catch(() => {});
      clearSession();
    },
  }), [user, checking, api, token, acceptSession, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
