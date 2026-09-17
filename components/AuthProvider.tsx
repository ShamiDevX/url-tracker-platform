'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);

  const triggerLogout = useCallback(async () => {
    try {
      sessionStorage.removeItem('dash_expires_at');
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network error on logout
    } finally {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const expiresAtStr = sessionStorage.getItem('dash_expires_at');

    if (expiresAtStr) {
      const expiresAt = Number(expiresAtStr);
      const remainingMs = expiresAt - Date.now();

      if (remainingMs <= 0) {
        // Session duration has elapsed
        triggerLogout();
        return;
      }

      setIsInitializing(false);

      // Timer to auto-logout when session duration expires
      const timer = setTimeout(() => {
        triggerLogout();
      }, remainingMs);

      return () => clearTimeout(timer);
    } else {
      setIsInitializing(false);
    }
  }, [triggerLogout]);

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ logout: triggerLogout }}>
      {children}
    </AuthContext.Provider>
  );
}
