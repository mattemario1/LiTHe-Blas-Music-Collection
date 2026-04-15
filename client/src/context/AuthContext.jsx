import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'adminToken';

export function AuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);

  // On mount, silently re-validate any stored token
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: stored })
    })
      .then(res => res.json())
      .then(data => { if (data.ok) setIsAdmin(true); else localStorage.removeItem(STORAGE_KEY); })
      .catch(() => localStorage.removeItem(STORAGE_KEY));
  }, []);

  const login = async (password) => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.ok) {
      localStorage.setItem(STORAGE_KEY, password);
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
