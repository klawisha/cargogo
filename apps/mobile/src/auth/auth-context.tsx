import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { apiFetch } from '@/api/client';
import type { User } from '@/api/types';
import { clearSession, loadSession } from '@/auth/session-store';

type AuthContextValue = {
  booting: boolean;
  user: User | null;
  setAuthenticatedUser: (user: User) => void;
  reloadUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const reloadUser = useCallback(async () => {
    const session = await loadSession();
    if (!session) { setUser(null); return; }
    const response = await apiFetch('/auth/me');
    if (!response.ok) {
      await clearSession();
      setUser(null);
      return;
    }
    const data = await response.json() as { user: User };
    setUser(data.user);
  }, []);

  useEffect(() => {
    reloadUser().catch(() => undefined).finally(() => setBooting(false));
  }, [reloadUser]);

  const logout = useCallback(async () => {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch { /* local revoke still happens */ }
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    booting,
    user,
    setAuthenticatedUser: setUser,
    reloadUser,
    logout,
  }), [booting, user, reloadUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
