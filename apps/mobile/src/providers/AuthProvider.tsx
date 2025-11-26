import { useEffect, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '~/hooks/useAuth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isAuthenticated, isLoading, session, refreshSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Handle token refresh
  useEffect(() => {
    if (!session?.expiresAt) return;

    const checkTokenExpiry = () => {
      const now = Date.now();
      const expiresAt = session.expiresAt;
      const refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiry

      if (expiresAt - now < refreshThreshold) {
        refreshSession().catch(() => {
          // Token refresh failed, will redirect to login
        });
      }
    };

    // Check immediately
    checkTokenExpiry();

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60 * 1000);

    return () => clearInterval(interval);
  }, [session?.expiresAt, refreshSession]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if already authenticated
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return <>{children}</>;
}
