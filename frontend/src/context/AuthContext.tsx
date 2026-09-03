import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, refreshAccessToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      // 1. Try fetching profile with in-memory token
      const currentUser = await api.me();
      setUser(currentUser);
    } catch (_) {
      // 2. Access token missing or expired: try silent refresh using HTTP-only cookie
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          const refreshedUser = await api.me();
          setUser(refreshedUser);
        } else {
          setUser(null);
        }
      } catch (refreshErr) {
        setUser(null);
      }
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

  const logout = async () => {
    setLoading(true);
    try {
      await api.logout();
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
