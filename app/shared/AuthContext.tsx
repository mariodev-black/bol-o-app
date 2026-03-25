"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthContextValue = {
  ready: boolean;
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
};

const AUTH_KEY = "bolao_logged_in_v1";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // useEffect(() => {
  //   try {
  //     const v = localStorage.getItem(AUTH_KEY);
  //     setIsLoggedIn(v === "1");
  //   } catch {
  //     setIsLoggedIn(false);
  //   } finally {
  //     setReady(true);
  //   }
  // }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      ready,
      isLoggedIn,
      login: () => {
        try {
          localStorage.setItem(AUTH_KEY, "1");
        } catch {
          // ignore
        }
        setIsLoggedIn(true);
      },
      logout: () => {
        try {
          localStorage.removeItem(AUTH_KEY);
        } catch {
          // ignore
        }
        setIsLoggedIn(false);
      },
    };
  }, [isLoggedIn, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider />");
  return ctx;
}

