import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());
  const [sessionMessage, setSessionMessage] = useState("");

  const clear = useCallback((message = "") => {
    tokenStore.clear();
    setUser(null);
    setSessionMessage(message);
  }, []);

  // Restore the session on page load
  useEffect(() => {
    setUnauthorizedHandler((msg) => clear(msg || "Your session has ended. Please log in again."));
    if (!tokenStore.get()) return;
    api.get("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [clear]);

  const login = async (email, password) => {
    const d = await api.post("/api/auth/login", { email, password });
    tokenStore.set(d.access_token);
    setSessionMessage("");
    setUser(d.user);
    return d.user;
  };

  const register = async (values) => {
    const d = await api.post("/api/auth/register", values);
    tokenStore.set(d.access_token);
    setUser(d.user);
    return d.user;
  };

  const logout = async () => {
    try { await api.post("/api/auth/logout"); } catch { /* token may already be invalid */ }
    clear();
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, sessionMessage }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const isRequester = (user) => ["student", "staff"].includes(user?.role);
