# @kairos/auth

Authentication utilities for Kairos applications.

## Overview

This package provides:
- Supabase Auth client wrapper
- React hooks and context for authentication
- Token management with Zustand
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

### Node.js / Backend

```typescript
import { createAuthClient } from '@kairos/auth';

const auth = createAuthClient({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

// Verify JWT token
const { user, error } = await auth.verifyToken(token);

// Admin operations
const { user } = await auth.admin.createUser({
  email: 'user@example.com',
  password: 'secure-password',
});
```

### React

```typescript
import { AuthProvider, useAuth } from '@kairos/auth/react';

// Wrap your app
function App() {
  return (
    <AuthProvider>
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

### createAuthClient(config)

Creates a new auth client instance.

```typescript
interface AuthClientConfig {
  supabaseUrl: string;
  supabaseKey: string;
  options?: {
    autoRefreshToken?: boolean;
    persistSession?: boolean;
  };
}

const client = createAuthClient(config);
```

### AuthProvider

React context provider for authentication state.

```typescript
interface AuthProviderProps {
  children: React.ReactNode;
  supabaseUrl?: string;
  supabaseKey?: string;
}

<AuthProvider supabaseUrl="..." supabaseKey="...">
  {children}
</AuthProvider>
```

### useAuth()

React hook for accessing auth state and methods.

```typescript
interface UseAuthReturn {
  // State
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: Error | null;

  // Methods
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;

  // OAuth
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
}
```

## Token Management

The package handles token lifecycle automatically:

- **Access tokens**: 15-minute lifetime, auto-refreshed
- **Refresh tokens**: 7-day lifetime, stored securely
- **Session persistence**: Optional, uses secure storage

```typescript
// Manual token access (if needed)
const { session } = useAuth();
const accessToken = session?.access_token;
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

1. **Never expose service role key** - Use only on the backend
2. **Validate tokens server-side** - Don't trust client claims
3. **Use HTTPS** - Required for secure cookies
4. **Enable RLS** - Row-level security in Supabase

### Token Verification

```typescript
// In API middleware
import { createAuthClient } from '@kairos/auth';

const auth = createAuthClient({ ... });

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { user, error } = await auth.verifyToken(token);

  if (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  next();
}
```

## Project Structure

```
packages/auth/
├── src/
│   ├── index.ts          # Main exports (Node.js)
│   ├── react.ts          # React exports
│   ├── client.ts         # Supabase client wrapper
│   ├── types.ts          # Type definitions
│   └── store.ts          # Zustand store
├── package.json
└── tsconfig.json
```

## Exports

```typescript
// Default export (Node.js)
import { createAuthClient } from '@kairos/auth';

// React exports
import {
  AuthProvider,
  useAuth,
  useAuthStore,
} from '@kairos/auth/react';

// Types
import type {
  User,
  Session,
  AuthError,
} from '@kairos/auth';
```

## Related Documentation

- [Architecture](../../docs/ARCHITECTURE.md) - System design
- [API Reference](../../docs/API.md) - Auth endpoints
- [apps/api](../../apps/api/README.md) - Backend API
