/**
 * React hooks and components for Janua auth
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { create } from 'zustand';
import { createAuthStore, type AuthStore } from './store';
import type { JanuaAuthConfig } from './client';
import type { LoginCredentials, RegisterCredentials } from '@kairos/types';

// Create context for the auth store
const AuthContext = createContext<ReturnType<typeof create<AuthStore>> | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  config: JanuaAuthConfig;
}

/**
 * Auth provider component - wrap your app with this
 */
export function AuthProvider({ children, config }: AuthProviderProps) {
  const store = useMemo(() => create<AuthStore>(createAuthStore(config)), [config]);

  // Auto-refresh session on mount
  useEffect(() => {
    const state = store.getState();
    if (state.session && new Date() >= state.session.expiresAt) {
      state.refreshSession();
    }
  }, [store]);

  return (
    <AuthContext.Provider value={store}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access the auth store
 */
export function useAuthStore(): AuthStore {
  const store = useContext(AuthContext);
  if (!store) {
    throw new Error('useAuthStore must be used within an AuthProvider');
  }
  return store();
}

/**
 * Hook for auth state and actions
 */
export function useAuth() {
  const store = useAuthStore();

  return {
    user: store.user,
    session: store.session,
    isLoading: store.isLoading,
    isAuthenticated: store.isAuthenticated,
    error: store.error,
    login: store.login,
    register: store.register,
    logout: store.logout,
    refreshSession: store.refreshSession,
    getAccessToken: store.getAccessToken,
    clearError: store.clearError,
  };
}

/**
 * Hook for just the user
 */
export function useUser() {
  const { user, isLoading, isAuthenticated } = useAuth();
  return { user, isLoading, isAuthenticated };
}

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(role: string): boolean {
  const { user } = useAuth();
  return user?.roles.includes(role) ?? false;
}

/**
 * Hook to check subscription tier
 */
export function useSubscription() {
  const { user } = useAuth();

  // Check roles for subscription tier
  const tier = useMemo(() => {
    if (!user) return 'free';
    if (user.roles.includes('immersion') || user.roles.includes('subscriber:immersion')) {
      return 'immersion';
    }
    if (user.roles.includes('learner') || user.roles.includes('subscriber:learner')) {
      return 'learner';
    }
    return 'free';
  }, [user]);

  const hasFeature = (feature: 'ai_simplify' | 'unlimited_cards' | 'mobile') => {
    switch (feature) {
      case 'ai_simplify':
        return tier === 'learner' || tier === 'immersion';
      case 'unlimited_cards':
        return tier === 'learner' || tier === 'immersion';
      case 'mobile':
        return tier === 'immersion';
      default:
        return false;
    }
  };

  return { tier, hasFeature };
}

/**
 * Higher-order component to require authentication
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  FallbackComponent?: React.ComponentType
) {
  return function WithAuthWrapper(props: P) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return null; // Or a loading spinner
    }

    if (!isAuthenticated) {
      if (FallbackComponent) {
        return <FallbackComponent />;
      }
      return null;
    }

    return <Component {...props} />;
  };
}

// Re-export types
export type { AuthStore } from './store';
export type { JanuaAuthConfig } from './client';
