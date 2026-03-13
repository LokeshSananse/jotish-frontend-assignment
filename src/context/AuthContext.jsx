import { createContext, useContext, useState, useCallback } from "react";

// ─────────────────────────────────────────────
// Auth Context – persists session in localStorage
// ─────────────────────────────────────────────
const AuthContext = createContext(null);

const VALID_USER = "testuser";
const VALID_PASS = "Test123";
const STORAGE_KEY = "eid_auth_user";

export function AuthProvider({ children }) {
  // Rehydrate from localStorage on first render
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((username, password) => {
    if (username === VALID_USER && password === VALID_PASS) {
      const profile = { username, loggedInAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      setUser(profile);
      return { ok: true };
    }
    return { ok: false, message: "Invalid credentials. Please try again." };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
