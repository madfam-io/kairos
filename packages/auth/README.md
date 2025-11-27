# @kairos/auth

Authentication utilities for Kairos applications using Janua SSO.

## Overview

This package provides:
- Janua Auth client for authentication
- React hooks and context for authentication state
- Token management with automatic refresh
- Type-safe authentication utilities

## Installation

This package is internal to the Kairos monorepo. It's automatically available to workspace packages.

```json
{
  "dependencies": {
    "@kairos/auth": "workspace:*"
  }
}
```

## Usage

### Client Setup

```typescript
import { JanuaAuthClient } from '@kairos/auth';

const auth = new JanuaAuthClient({
  baseUrl: process.env.API_URL || 'https://api.kairos.dev',
  storage: 'localStorage', // or 'sessionStorage' or 'memory'
  onSessionChange: (session) => {
    console.log('Session changed:', session);
  },
});

// Login
const session = await auth.login({
  email: 'user@example.com',
  password: 'secure-password',
});

// Register
const session = await auth.register({
  email: 'user@example.com',
  password: 'secure-password',
});

// Logout
await auth.logout();

// Get current user
const user = auth.getUser();

// Check if authenticated
const isAuthenticated = auth.isAuthenticated();

// Get access token (auto-refreshes if expired)
const token = await auth.getAccessToken();
```

### React Integration

```typescript
import { AuthProvider, useAuth } from '@kairos/auth/react';

// Wrap your app
function App() {
  return (
    <AuthProvider baseUrl="https://api.kairos.dev">
      <YourApp />
    </AuthProvider>
  );
}

// Use in components
function Profile() {
  const { user, isAuthenticated, login, logout, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <LoginButton onClick={() => login(email, password)} />;
  }

  return (
    <div>
      <p>Welcome, {user.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## API Reference

### JanuaAuthClient

Creates a new auth client instance.

```typescript
interface JanuaAuthConfig {
  baseUrl: string;
  clientId?: string;
  storage?: 'localStorage' | 'sessionStorage' | 'memory';
  onSessionChange?: (session: AuthSession | null) => void;
}

const client = new JanuaAuthClient(config);
```

### Methods

| Method | Description |
|--------|-------------|
| `login(credentials)` | Login with email/password |
| `register(credentials)` | Register new account |
| `logout()` | Logout and clear session |
| `getSession()` | Get current session |
| `getUser()` | Get current user |
| `isAuthenticated()` | Check if authenticated |
| `getAccessToken()` | Get access token (auto-refresh) |
| `refreshSession()` | Manually refresh session |
| `forgotPassword(email)` | Request password reset |
| `resetPassword(token, password)` | Reset password with token |
| `getOAuthUrl(provider)` | Get OAuth login URL |
| `handleOAuthCallback(code)` | Handle OAuth callback |

### AuthProvider

React context provider for authentication state.

```typescript
interface AuthProviderProps {
  children: React.ReactNode;
  baseUrl: string;
  clientId?: string;
}

<AuthProvider baseUrl="https://api.kairos.dev">
  {children}
</AuthProvider>
```

### useAuth()

React hook for accessing auth state and methods.

```typescript
interface UseAuthReturn {
  // State
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: AuthError | null;

  // Methods
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;

  // OAuth
  getOAuthUrl: (provider: 'google' | 'github' | 'microsoft') => string;
  handleOAuthCallback: (code: string, state?: string) => Promise<void>;
}
```

## Token Management

The package handles token lifecycle automatically:

- **Access tokens**: 15-minute lifetime, auto-refreshed 5 minutes before expiry
- **Refresh tokens**: 7-day lifetime, stored securely
- **Session persistence**: Configurable storage (localStorage, sessionStorage, or memory)

```typescript
// Manual token access (if needed)
const token = await auth.getAccessToken();

// Manual refresh
await auth.refreshSession();
```

## Zustand Store

For advanced use cases, access the underlying Zustand store:

```typescript
import { useAuthStore } from '@kairos/auth/react';

const setUser = useAuthStore((state) => state.setUser);
const clearSession = useAuthStore((state) => state.clearSession);
```

## Security

### Best Practices

1. **Validate tokens server-side** - Don't trust client claims
2. **Use HTTPS** - Required for secure token transmission
3. **Secure storage** - Use `memory` storage for sensitive applications
4. **Handle token expiry** - The client handles this automatically

### Server-Side Verification

For server-side JWT verification, use the Janua SDK in your API:

```typescript
// apps/api/src/middleware/auth.ts
import { getJanuaClient } from '../services/janua';

async function authMiddleware(c, next) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Unauthorized');
  }

  const janua = getJanuaClient();
  const payload = await janua.verifyToken(token);
  const user = janua.tokenToUser(payload);

  c.set('user', user);
  await next();
}
```

## Project Structure

```
packages/auth/
├── src/
│   ├── index.ts          # Main exports
│   ├── react.ts          # React exports
│   ├── client.ts         # JanuaAuthClient
│   └── store.ts          # Zustand store
├── package.json
└── tsconfig.json
```

## Exports

```typescript
// Default export
import { JanuaAuthClient, AuthError } from '@kairos/auth';

// React exports
import {
  AuthProvider,
  useAuth,
  useAuthStore,
} from '@kairos/auth/react';

// Types (from @kairos/types)
import type {
  AuthUser,
  AuthSession,
  LoginCredentials,
  RegisterCredentials,
} from '@kairos/types';
```

## Related Documentation

- [Architecture](../../docs/ARCHITECTURE.md) - System design
- [API Reference](../../docs/API.md) - Auth endpoints
- [apps/api](../../apps/api/README.md) - Backend API
