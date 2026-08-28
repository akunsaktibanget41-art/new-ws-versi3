import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authMe, authLogin, authLogout, authRegister, meScope } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = checking, false = not authenticated, object = user
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const me = await authMe();
      let scope = {};
      try { scope = await meScope(); } catch {}
      setUser({ ...me, ...scope });
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const r = await authLogin({ email, password });
    if (r.user) {
      let scope = {};
      try { scope = await meScope(); } catch {}
      setUser({ ...r.user, ...scope });
    }
    return r;
  };

  const register = async (name, email, password) => {
    return await authRegister({ name, email, password });
  };

  const logout = async () => {
    try { await authLogout(); } catch {}
    setUser(false);
    window.location.href = "/login";
  };

  const refreshUser = checkAuth;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export function formatApiErr(err) {
  const detail = err?.response?.data?.detail;
  if (detail == null) return err?.message || "Terjadi kesalahan";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(", ");
  return String(detail);
}
