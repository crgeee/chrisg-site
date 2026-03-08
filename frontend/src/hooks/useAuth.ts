import { useState, useEffect } from "react";
import { isAuthenticated, getMe, login as apiLogin, logout as apiLogout } from "../services/api";
import type { User } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      getMe().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username: string, password: string) {
    await apiLogin(username, password);
    const me = await getMe();
    setUser(me);
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return { user, loading, login, logout };
}
