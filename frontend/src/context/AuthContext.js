import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, authApi, createApi, request } from '../api/client';
import { tokenStore } from '../api/tokenStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Restore the saved session; a rejected token (expired, account locked) just signs out quietly.
  useEffect(() => {
    (async () => {
      const saved = await tokenStore.get();
      if (saved) {
        try {
          const { user: me } = await authApi.me(saved);
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
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const login = useCallback(async (email, password) => signIn(await authApi.login(email.trim(), password)), [signIn]);

  const logout = useCallback(async () => {
    const current = token;
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
        setToken(null);
        setUser(null);
        await tokenStore.clear();
      }
      throw error;
    }
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const { user: me } = await authApi.me(token);
    setUser(me);
  }, [token]);

  const api = useMemo(() => createApi(call), [call]);
  // Registration calls authApi.register itself and passes the result to signIn once the plan screen is done,
  // because signing in switches the app to the member area.
  const value = useMemo(() => ({ ready, token, user, login, signIn, logout, refreshUser, api }),
    [ready, token, user, login, signIn, logout, refreshUser, api]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

// Where each role lands after signing in.
export const homeFor = (role) => (role === 'admin' ? '/admin' : '/home');
