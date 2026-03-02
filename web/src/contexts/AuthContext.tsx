import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.ts';
import type { AuthUser } from '../types.ts';

interface AuthContextValue {
  isAuthenticated: boolean;
  isVotekeeper: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 60_000,
  });

  const isDev = import.meta.env.DEV;

  const login = () => {
    const redirect = encodeURIComponent('/dashboard');
    window.location.href = isDev
      ? `/.auth/login/aad?post_login_redirect_uri=${redirect}`
      : '/.auth/login/aad';
  };

  const logout = () => {
    if (isDev) localStorage.removeItem('mockAuthPrincipal');
    const redirect = encodeURIComponent('/');
    window.location.href = isDev
      ? `/.auth/logout?post_logout_redirect_uri=${redirect}`
      : '/.auth/logout';
  };

  const value: AuthContextValue = {
    isAuthenticated: data?.isAuthenticated ?? false,
    isVotekeeper: data?.isVotekeeper ?? false,
    user: data?.user ?? null,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
