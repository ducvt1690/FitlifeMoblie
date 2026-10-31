import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from './api.js';
import { DEMO_USER } from './mockData.js';

const TOKEN_KEY = 'fitlife.token';
const DEMO_KEY = 'fitlife.demo';
const AuthContext = createContext(null);

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* private mode: phiên chỉ sống trong tab */ }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStorage(TOKEN_KEY));
  const [user, setUser] = useState(() => (readStorage(DEMO_KEY) ? DEMO_USER : null));
  const [checking, setChecking] = useState(Boolean(token));

  // Có token cũ thì hỏi backend còn hợp lệ không.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi.me(token)
      .then((data) => { if (!cancelled) setUser(data.user); })
      .catch(() => { if (!cancelled) { writeStorage(TOKEN_KEY, null); setToken(null); setUser(null); } })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [token]);

  const acceptSession = useCallback((data) => {
    writeStorage(DEMO_KEY, null);
    writeStorage(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const value = useMemo(() => ({
    user,
    checking,
    isDemo: user?.isDemo === true,
    async login(email, password) { acceptSession(await authApi.login(email, password)); },
    async register(payload) { acceptSession(await authApi.register(payload)); },
    enterDemo() { writeStorage(DEMO_KEY, '1'); setUser(DEMO_USER); },
    async logout() {
      if (token) await authApi.logout(token).catch(() => {});
      writeStorage(TOKEN_KEY, null);
      writeStorage(DEMO_KEY, null);
      setToken(null);
      setUser(null);
    },
  }), [user, checking, token, acceptSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
