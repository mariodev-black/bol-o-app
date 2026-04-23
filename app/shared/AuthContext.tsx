"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  /** Código de indicação deste usuário (para compartilhar). */
  referralCode: string;
};

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  isLoggedIn: boolean;
  refresh: () => Promise<void>;
  loginWithPassword: (identifier: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function parseJsonSafe(r: Response): Promise<{ error?: string; user?: AuthUser | null }> {
  try {
    return (await r.json()) as { error?: string; user?: AuthUser | null };
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      const data = await parseJsonSafe(r);
      const u = data.user;
      setUser(
        u
          ? { ...u, referralCode: u.referralCode ?? "" }
          : null
      );
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const loginWithPassword = useCallback(
    async (identifier: string, password: string) => {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await parseJsonSafe(r);
      if (!r.ok) {
        return { ok: false as const, error: data.error ?? "Não foi possível entrar" };
      }
      if (data.user) {
        setUser({ ...data.user, referralCode: data.user.referralCode ?? "" });
      }
      return { ok: true as const };
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      isLoggedIn: Boolean(user),
      refresh,
      loginWithPassword,
      logout,
    }),
    [ready, user, refresh, loginWithPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider />");
  return ctx;
}
