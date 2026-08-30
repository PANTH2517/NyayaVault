import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleName } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  switchDemoRole: (role: RoleName) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_CREDENTIALS: Record<RoleName, { email: string; pass: string }> = {
  ADMIN: { email: 'admin@nyayavault.gov.in', pass: 'Admin@Nyaya2026' },
  INVESTIGATING_OFFICER: { email: 'io.sharma@nyayavault.gov.in', pass: 'Officer@Nyaya2026' },
  SUPERVISOR: { email: 'super.verma@nyayavault.gov.in', pass: 'Super@Nyaya2026' },
  PROSECUTOR: { email: 'prosecutor.mehta@nyayavault.gov.in', pass: 'Prosecutor@Nyaya2026' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('nyaya_access_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const currentUser = await api.me();
      setUser(currentUser);
    } catch (err) {
      console.warn('Failed to load user profile, clearing token:', err);
      api.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const result = await api.login(email, pass);
      setUser(result.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  // Authentic JWT Demo Role Switcher
  const switchDemoRole = async (role: RoleName) => {
    setLoading(true);
    try {
      const creds = DEMO_CREDENTIALS[role];
      const result = await api.login(creds.email, creds.pass);
      setUser(result.user);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, switchDemoRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
