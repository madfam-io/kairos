/**
 * Janua Authentication Service Client
 * https://github.com/madfam-io/janua
 */

import * as jose from 'jose';

interface JanuaConfig {
  baseUrl: string;
  publicKey?: string;
  jwksUrl?: string;
  timeout?: number;
}

interface JanuaUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
  roles: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface JanuaTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  roles: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

interface JanuaSession {
  user: JanuaUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class JanuaClient {
  private baseUrl: string;
  private timeout: number;
  private jwks: jose.JWTVerifyGetKey | null = null;
  private publicKey: jose.KeyLike | null = null;

  constructor(config: JanuaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 10000;

    // Initialize key for JWT verification
    if (config.publicKey) {
      this.initPublicKey(config.publicKey);
    } else {
      this.initJWKS(config.jwksUrl ?? `${this.baseUrl}/.well-known/jwks.json`);
    }
  }

  private async initPublicKey(pem: string): Promise<void> {
    this.publicKey = await jose.importSPKI(pem, 'RS256');
  }

  private initJWKS(jwksUrl: string): void {
    this.jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
  }

  /**
   * Verify and decode a JWT access token
   */
  async verifyToken(token: string): Promise<JanuaTokenPayload> {
    const keyOrJWKS = this.publicKey ?? this.jwks;
    if (!keyOrJWKS) {
      throw new Error('Janua client not properly initialized');
    }

    try {
      const { payload } = await jose.jwtVerify(token, keyOrJWKS, {
        algorithms: ['RS256'],
      });

      return payload as unknown as JanuaTokenPayload;
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        throw new AuthError('TOKEN_EXPIRED', 'Access token has expired');
      }
      if (error instanceof jose.errors.JWTInvalid) {
        throw new AuthError('TOKEN_INVALID', 'Invalid access token');
      }
      throw new AuthError('TOKEN_VERIFICATION_FAILED', 'Failed to verify token');
    }
  }

  /**
   * Get user from token payload
   */
  tokenToUser(payload: JanuaTokenPayload): JanuaUser {
    return {
      id: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name,
      avatarUrl: payload.picture,
      roles: payload.roles ?? [],
      createdAt: new Date(payload.iat * 1000).toISOString(),
      updatedAt: new Date(payload.iat * 1000).toISOString(),
    };
  }

  /**
   * Fetch user profile from Janua API
   */
  async getUser(accessToken: string): Promise<JanuaUser> {
    const response = await this.fetch('/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await this.fetch('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    return response.data;
  }

  /**
   * Revoke a session (logout)
   */
  async revokeSession(accessToken: string): Promise<void> {
    await this.fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  /**
   * Check if user has a specific role
   */
  hasRole(user: JanuaUser, role: string): boolean {
    return user.roles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(user: JanuaUser, roles: string[]): boolean {
    return roles.some((role) => user.roles.includes(role));
  }

  private async fetch(path: string, options: RequestInit = {}): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new AuthError(
          error.code ?? 'API_ERROR',
          error.message ?? `Request failed with status ${response.status}`
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Authentication error
 */
export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

// Global client instance
let januaClient: JanuaClient | null = null;

export function getJanuaClient(): JanuaClient {
  if (!januaClient) {
    const baseUrl = process.env.JANUA_URL ?? 'http://localhost:4000';
    const publicKey = process.env.JANUA_PUBLIC_KEY;

    januaClient = new JanuaClient({
      baseUrl,
      publicKey,
    });
  }
  return januaClient;
}

export function createJanuaClient(config: JanuaConfig): JanuaClient {
  return new JanuaClient(config);
}

export type { JanuaUser, JanuaTokenPayload, JanuaSession, JanuaConfig };
