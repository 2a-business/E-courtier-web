import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, api, refreshAccessToken, setAccessToken, setSessionExpiredHandler } from "../lib/api";
import type { Role, User } from "../lib/types";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  hasRole: (...roles: Role[]) => boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: "CUSTOMER" | "OWNER";
}

const AuthContext = createContext<AuthValue | null>(null);

// Simple indicateur (aucune donnée sensible) pour éviter un appel de rafraîchissement inutile en anonyme.
const SESSION_HINT = "ec-has-session";
const hint = {
  get: () => {
    try {
      return localStorage.getItem(SESSION_HINT) === "1";
    } catch {
      return true;
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(SESSION_HINT, "1");
      else localStorage.removeItem(SESSION_HINT);
    } catch {
      /* stockage indisponible : on tentera simplement le rafraîchissement */
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const queryClient = useQueryClient();

  const applySession = useCallback((data: { access: string; user: User }) => {
    setAccessToken(data.access);
    hint.set(true);
    setUserState(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      hint.set(false);
      setUserState(null);
      setStatus("anonymous");
    });
    let cancelled = false;
    if (!hint.get()) {
      setStatus("anonymous");
      return;
    }
    // Restaure la session à partir du cookie HttpOnly, s'il existe.
    refreshAccessToken()
      .then(async (token) => {
        if (!token) throw new Error("no session");
        const me = await api<User>("/auth/me/");
        if (!cancelled) {
          setUserState(me);
          setStatus("authenticated");
        }
      })
      .catch((error) => {
        // On n'efface l'indicateur que si la session est vraiment invalide (pas sur 429 / réseau).
        if (!(error instanceof ApiError)) hint.set(false);
        if (!cancelled) setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      status,
      login: async (email, password) =>
        applySession(await api<{ access: string; user: User }>("/auth/login/", { body: { email, password } })),
      register: async (data) =>
        applySession(await api<{ access: string; user: User }>("/auth/register/", { body: data })),
      logout: async () => {
        try {
          await api("/auth/logout/", { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest" } });
        } finally {
          hint.set(false);
          setAccessToken(null);
          setUserState(null);
          setStatus("anonymous");
          queryClient.clear();
        }
      },
      setUser: setUserState,
      hasRole: (...roles) => !!user && roles.includes(user.role),
    }),
    [user, status, applySession, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
