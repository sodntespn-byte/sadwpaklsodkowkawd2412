'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore, type User } from '@/store/auth';
import { api } from '@/lib/api';

export function useAuth() {
  const { user, accessToken, refreshToken, setAuth, clearAuth, setTokens } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!accessToken || !user) return;
    // Optional: validate token on mount / refresh if expired
  }, [accessToken, user]);

  const login = async (email: string, password: string) => {
    const res = await api<{ user: User; tokens: { accessToken: string; refreshToken: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    );
    if (res.error || !res.data) return { error: res.error || 'Login failed' };
    const { user: u, tokens } = res.data;
    setAuth(u, tokens.accessToken, tokens.refreshToken);
    return {};
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api<{ user: User; tokens: { accessToken: string; refreshToken: string } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ name, email, password }) }
    );
    if (res.error || !res.data) return { error: res.error || 'Register failed' };
    const { user: u, tokens } = res.data;
    setAuth(u, tokens.accessToken, tokens.refreshToken);
    return {};
  };

  const logout = async () => {
    if (accessToken) {
      await api('/auth/logout', { method: 'POST', token: accessToken });
    }
    clearAuth();
    router.push('/login');
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    if (!refreshToken) return null;
    const res = await api<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.data) return null;
    setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.accessToken;
  };

  return { user, accessToken, login, register, logout, refreshAccessToken, isAuthenticated: !!user };
}
