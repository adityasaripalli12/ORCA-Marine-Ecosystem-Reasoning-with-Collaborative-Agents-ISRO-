import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiFetch, getApiUrl } from '../utils/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string, role?: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: UserRole, organization?: string) => Promise<void>;
  adminLogin: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('floatchat_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from real backend /auth/me on initial app load
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem('floatchat_token');
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiFetch('/auth/me');
        if (response.ok) {
          const profile = await response.json();
          const restoredUser: User = {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role as UserRole,
            status: profile.is_active ? 'Active' : 'Disabled',
            lastLogin: profile.last_login || new Date().toISOString().replace('T', ' ').slice(0, 16),
          };
          setUser(restoredUser);
          setToken(savedToken);
          localStorage.setItem('floatchat_user', JSON.stringify(restoredUser));
        } else {
          localStorage.removeItem('floatchat_token');
          localStorage.removeItem('floatchat_user');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Session restoration failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (email: string, password = 'Password@123', role?: string): Promise<void> => {
    const baseUrl = getApiUrl();
    try {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: role || undefined }),
      });

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error('ORCA server encountered an internal error. Please try again.');
        }
        const errorData = await response.json().catch(() => ({ detail: 'Invalid email or password.' }));
        throw new Error(errorData.detail || 'Invalid email or password.');
      }

      const data = await response.json();

      const newUser: User = {
        id: data.user_id,
        name: data.name,
        email: data.email,
        role: data.role as UserRole,
        status: 'Active',
        lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 16),
      };

      setToken(data.access_token);
      setUser(newUser);
      localStorage.setItem('floatchat_token', data.access_token);
      localStorage.setItem('floatchat_user', JSON.stringify(newUser));
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('fetch')) {
        throw new Error('ORCA server is unavailable. Please ensure the backend service is running.');
      }
      throw err;
    }
  };

  const register = async (name: string, email: string, password: string, role: UserRole = 'Researcher', organization?: string) => {
    const baseUrl = getApiUrl();
    try {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, organization }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Registration failed' }));
        throw new Error(err.detail || 'Could not register account');
      }

      const data = await response.json();
      const newUser: User = {
        id: data.user_id,
        name: data.name,
        email: data.email,
        role: data.role as UserRole,
        status: 'Active',
        lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 16),
      };

      setToken(data.access_token);
      setUser(newUser);
      localStorage.setItem('floatchat_token', data.access_token);
      localStorage.setItem('floatchat_user', JSON.stringify(newUser));
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('fetch')) {
        throw new Error('Unable to connect to the ORCA server. Please check that the backend service is running.');
      }
      throw err;
    }
  };

  const adminLogin = async (email: string, password = 'Admin@123'): Promise<boolean> => {
    try {
      await login(email, password, 'Admin');
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout notification error:', e);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('floatchat_token');
      localStorage.removeItem('floatchat_user');
    }
  };

  const setRole = (role: UserRole) => {
    if (user) {
      const updated = { ...user, role };
      setUser(updated);
      localStorage.setItem('floatchat_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        token,
        isLoading,
        login,
        register,
        adminLogin,
        logout,
        setRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
