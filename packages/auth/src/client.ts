/**
 * Janua Authentication Client
 */

import type {
  AuthUser,
  AuthSession,
  AuthTokens,
  LoginCredentials,
  RegisterCredentials,
} from '@kairos/types';

export interface JanuaAuthConfig {
  baseUrl: string;
  clientId?: string;
  storage?: 'localStorage' | 'sessionStorage' | 'memory';
  onSessionChange?: (session: AuthSession | null) => void;
}

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = 'kairos_auth_session';

export class JanuaAuthClient {
  private config: JanuaAuthConfig;
  private storage: StorageAdapter;
  private session: AuthSession | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(config: JanuaAuthConfig) {
    this.config = config;
    this.storage = this.createStorage(config.storage ?? 'localStorage');
    this.loadSession();
  }

  private createStorage(type: string): StorageAdapter {
    if (type === 'memory' || typeof window === 'undefined') {
      const store = new Map<string, string>();
      return {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => store.set(key, value),
        removeItem: (key) => store.delete(key),
      };
    }
    return type === 'sessionStorage' ? sessionStorage : localStorage;
  }

  private loadSession(): void {
    try {
      const stored = this.storage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.session = {
          ...parsed,
          expiresAt: new Date(parsed.expiresAt),
          user: {
            ...parsed.user,
            createdAt: new Date(parsed.user.createdAt),
            updatedAt: new Date(parsed.user.updatedAt),
          },
        };
      }
    } catch {
      this.session = null;
    }
  }

  private saveSession(session: AuthSession | null): void {
    this.session = session;
    if (session) {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      this.storage.removeItem(STORAGE_KEY);
    }
    this.config.onSessionChange?.(session);
  }

  /**
   * Get current session
   */
  getSession(): AuthSession | null {
    return this.session;
  }

  /**
   * Get current user
   */
  getUser(): AuthUser | null {
    return this.session?.user ?? null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.session !== null && new Date() < this.session.expiresAt;
  }

  /**
   * Get access token, refreshing if needed
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.session) return null;

    // Check if token is expired or about to expire (5 min buffer)
    const expiresIn = this.session.expiresAt.getTime() - Date.now();
    if (expiresIn < 5 * 60 * 1000) {
      try {
        await this.refreshSession();
      } catch {
        return null;
      }
    }

    return this.session?.accessToken ?? null;
  }

  /**
   * Login with email/password
   */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const response = await this.fetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    const session = this.parseSessionResponse(response);
    this.saveSession(session);
    return session;
  }

  /**
   * Register new user
   */
  async register(credentials: RegisterCredentials): Promise<AuthSession> {
    const response = await this.fetch('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    const session = this.parseSessionResponse(response);
    this.saveSession(session);
    return session;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    if (this.session) {
      try {
        await this.fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.session.accessToken}`,
          },
        });
      } catch {
        // Ignore logout errors
      }
    }
    this.saveSession(null);
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<AuthSession> {
    if (!this.session?.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Prevent concurrent refresh requests
    if (this.refreshPromise) {
      await this.refreshPromise;
      return this.session!;
    }

    this.refreshPromise = this.doRefresh(this.session.refreshToken);

    try {
      const tokens = await this.refreshPromise;
      const user = await this.fetchUser(tokens.accessToken);

      const session: AuthSession = {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      };

      this.saveSession(session);
      return session;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(refreshToken: string): Promise<AuthTokens> {
    const response = await this.fetch('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    return response.data;
  }

  /**
   * Fetch user profile
   */
  async fetchUser(accessToken?: string): Promise<AuthUser> {
    const token = accessToken ?? this.session?.accessToken;
    if (!token) {
      throw new Error('No access token');
    }

    const response = await this.fetch('/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return this.parseUserResponse(response.data);
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    await this.fetch('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<void> {
    await this.fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  /**
   * Get OAuth login URL
   */
  getOAuthUrl(provider: 'google' | 'github' | 'microsoft'): string {
    const params = new URLSearchParams({
      provider,
      redirect_uri: this.config.clientId ? `${window.location.origin}/auth/callback` : '',
    });
    return `${this.config.baseUrl}/api/v1/auth/oauth?${params}`;
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(code: string, state?: string): Promise<AuthSession> {
    const response = await this.fetch('/api/v1/auth/oauth/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    });

    const session = this.parseSessionResponse(response);
    this.saveSession(session);
    return session;
  }

  private parseSessionResponse(response: any): AuthSession {
    const { user, accessToken, refreshToken, expiresIn } = response.data;
    return {
      user: this.parseUserResponse(user),
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  private parseUserResponse(data: any): AuthUser {
    return {
      id: data.id,
      email: data.email,
      emailVerified: data.emailVerified ?? data.email_verified ?? false,
      name: data.name,
      avatarUrl: data.avatarUrl ?? data.avatar_url,
      roles: data.roles ?? [],
      createdAt: new Date(data.createdAt ?? data.created_at),
      updatedAt: new Date(data.updatedAt ?? data.updated_at),
    };
  }

  private async fetch(path: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new AuthError(error.code ?? 'AUTH_ERROR', error.message);
    }

    return response.json();
  }
}

export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
