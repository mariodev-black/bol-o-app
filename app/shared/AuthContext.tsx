"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { clampAvatarIndex } from "@/lib/auth/avatar-index";
import { isStoredAvatarUploadFilename } from "@/lib/user/avatar-filename";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  /** Preset 0–4 (`app/assets/avatares/{n}.png`), persistido em `users.avatar_index`. */
  avatarIndex: number;
  /** Basename em `public/avataruploads/`; quando definido, substitui o preset na UI. */
  avatarUploadFilename: string | null;
  /** Código de indicação deste usuário (para compartilhar). */
  referralCode: string;
};

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  isLoggedIn: boolean;
  /** Invalida leituras antigas de `/api/auth/me` (corrige corrida com login/cadastro em rede lenta). */
  beginNewAuthEpoch: () => void;
  /** Atualiza o estado a partir do `user` já devolvido pelo login/registro (cookie já veio na mesma resposta). */
  applySessionUser: (u: AuthUser) => void;
  refresh: () => Promise<void>;
  loginWithPassword: (identifier: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeSessionUser(u: AuthUser): AuthUser {
  const raw = typeof u.avatarUploadFilename === "string" ? u.avatarUploadFilename.trim() : "";
  return {
    ...u,
    referralCode: u.referralCode ?? "",
    avatarIndex: clampAvatarIndex(Number(u.avatarIndex)),
    avatarUploadFilename: raw && isStoredAvatarUploadFilename(raw) ? raw : null,
  };
}

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
  /** Qualquer `refresh` iniciado com geração menor que a atual é descartado ao concluir. */
  const authEpochRef = useRef(0);

  const beginNewAuthEpoch = useCallback(() => {
    authEpochRef.current += 1;
  }, []);

  const applySessionUser = useCallback(
    (u: AuthUser) => {
      beginNewAuthEpoch();
      setUser(normalizeSessionUser(u));
      /** Header/NavBottom só renderizam com `ready`; não dependem do 1º `/me` terminar depois do login/registro. */
      setReady(true);
    },
    [beginNewAuthEpoch]
  );

  const refresh = useCallback(async () => {
    const epochAtStart = authEpochRef.current;
    try {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      const data = await parseJsonSafe(r);
      if (epochAtStart !== authEpochRef.current) return;
      const u = data.user;
      setUser(
        u ? normalizeSessionUser(u) : null
      );
    } catch {
      if (epochAtStart !== authEpochRef.current) return;
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) setReady(true);
      }
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
        applySessionUser(data.user);
      } else {
        setReady(true);
        await refresh();
      }
      return { ok: true as const };
    },
    [applySessionUser]
  );

  const logout = useCallback(async () => {
    beginNewAuthEpoch();
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    setUser(null);
  }, [beginNewAuthEpoch]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      isLoggedIn: Boolean(user),
      beginNewAuthEpoch,
      applySessionUser,
      refresh,
      loginWithPassword,
      logout,
    }),
    [ready, user, beginNewAuthEpoch, applySessionUser, refresh, loginWithPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider />");
  return ctx;
}
