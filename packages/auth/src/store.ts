/**
 * Auth state management (framework-agnostic)
 */

import type { AuthUser, AuthSession, AuthState, LoginCredentials, RegisterCredentials } from '@kairos/types';
import { JanuaAuthClient, type JanuaAuthConfig } from './client';

export interface AuthStore extends AuthState {
  client: JanuaAuthClient;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  clearError: () => void;
}

type SetState = (partial: Partial<AuthState>) => void;
type GetState = () => AuthStore;

export function createAuthStore(config: JanuaAuthConfig) {
  return (set: SetState, get: GetState): AuthStore => {
    const client = new JanuaAuthClient({
      ...config,
      onSessionChange: (session) => {
        set({
          session,
          user: session?.user ?? null,
          isAuthenticated: session !== null,
        });
      },
    });

    // Load initial state
    const session = client.getSession();

    return {
      // Initial state
      client,
      user: session?.user ?? null,
      session,
      isLoading: false,
      isAuthenticated: session !== null,
      error: null,

      // Actions
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const session = await client.login(credentials);
          set({
            user: session.user,
            session,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const session = await client.register(credentials);
          set({
            user: session.user,
            session,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Registration failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await client.logout();
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } catch (err) {
          // Still clear local state even if logout request fails
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      refreshSession: async () => {
        try {
          const session = await client.refreshSession();
          set({
            user: session.user,
            session,
            isAuthenticated: true,
          });
        } catch {
          // Session refresh failed, clear state
          set({
            user: null,
            session: null,
            isAuthenticated: false,
          });
        }
      },

      getAccessToken: async () => {
        return client.getAccessToken();
      },

      clearError: () => {
        set({ error: null });
      },
    };
  };
}
