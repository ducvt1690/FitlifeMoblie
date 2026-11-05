import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, authApi, createApi, request } from '../api/client';
import { tokenStore } from '../api/tokenStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [sessionMessage, setSessionMessage] = useState('');
  const currentToken = useRef(null);
  const expire = useCallback(async (rejectedToken) => {
    if (currentToken.current !== rejectedToken) return;
    currentToken.current = null;
    setToken(null);
    setUser(null);
    setSessionMessage('Phiên đăng nhập đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.');
    await tokenStore.clear();
  }, []);

  // Restore the saved session; a rejected token (expired, account locked) just signs out quietly.
  useEffect(() => {
    (async () => {
      const saved = await tokenStore.get();
      if (saved) {
        try {
          const { user: me } = await authApi.me(saved);
          currentToken.current = saved;
          setToken(saved);
          setUser(me);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) await tokenStore.clear();
        }
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (result) => {
    await tokenStore.set(result.token);
    currentToken.current = result.token;
    setSessionMessage('');
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const login = useCallback(async (email, password) => signIn(await authApi.login(email.trim(), password)), [signIn]);

  const logout = useCallback(async () => {
    const current = token;
    currentToken.current = null;
    setToken(null);
    setUser(null);
    await tokenStore.clear();
    if (current) authApi.logout(current).catch(() => {});
  }, [token]);

  // Signed-in request: a 401 means the session ended on the server, so drop it here too.
  const call = useCallback(async (path, options = {}) => {
    try {
      return await request(path, { ...options, token });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await expire(token);
      }
      throw error;
    }
  }, [token, expire]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const { user: me } = await call('/api/auth/me');
    if (currentToken.current !== token) return;
    setUser(me);
  }, [token, call]);

  useEffect(() => {
    if (!token) return;
    const check = () => { if (AppState.currentState === 'active') refreshUser().catch(() => {}); };
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') check(); });
    const timer = setInterval(check, 60000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [token, refreshUser]);

  const api = useMemo(() => createApi(call), [call]);
  // Registration calls authApi.register itself and passes the result to signIn once the plan screen is done,
  // because signing in switches the app to the member area.
  const value = useMemo(() => ({ ready, token, user, login, signIn, logout, refreshUser, api, call, sessionMessage }),
    [ready, token, user, login, signIn, logout, refreshUser, api, call, sessionMessage]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

// Where each role lands after signing in.
export const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'trainer' ? '/trainer' : '/home');
