import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authStorage, fetchProfile, loginRequest, type UserProfile } from "./auth";
import { setCurrentRoleSnapshot } from "./api-error";
import { clearSelectedOrg } from "./org-context";

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    authStorage.clear();
    clearSelectedOrg();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    const stored = authStorage.getToken();
    if (!stored) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    fetchProfile(stored)
      .then((p) => {
        if (!active) return;
        setUser(p);
        authStorage.setUser(p);
        setToken(stored);
      })
      .catch(() => {
        if (!active) return;
        // Sem perfil não há como validar permissões. Limpa qualquer sessão
        // antiga/inválida para evitar o admin preso em "Verificando permissões…".
        clearSession();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clearSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const login = await loginRequest(email, password);

    let profile: UserProfile;
    try {
      profile = await fetchProfile(login.token);
    } catch (error) {
      if (login.user && login.user.email && login.user.role && login.user.organizationId) {
        profile = login.user;
        if (import.meta.env.DEV) console.warn("[auth] profile fetch failed, using login.user");
      } else {
        clearSession();
        throw error;
      }
    }

    authStorage.setUser(profile);
    setUser(profile);
    authStorage.setToken(login.token);
    setToken(login.token);
    if (import.meta.env.DEV) console.info("[auth] setUser completed", { role: profile.role });
  }, [clearSession]);

  const signOut = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const p = await fetchProfile(token);
    setUser(p);
    authStorage.setUser(p);
  }, [token]);

  useEffect(() => {
    setCurrentRoleSnapshot(user?.role ?? null);
  }, [user]);





  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
