'use client';
import React, { useEffect, type ReactNode } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import App from './App';
import { authClient } from './services/authClient';
import { useAuthStore } from './store/authStore';

export default function Application({ children }: { children: ReactNode }) {
  const { data, isPending } = (authClient as any).useSession();
  useEffect(() => {
    localStorage.removeItem('auth-storage');
    if (isPending) return;
    if (data) useAuthStore.getState().initializeAuth();
    else useAuthStore.setState({ user: null, isAuthenticated: false, initialized: true });
  }, [data, isPending]);

  return (
    <ThemeProvider>
      <App>{children}</App>
    </ThemeProvider>
  );
}
