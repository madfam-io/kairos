# Kairos Codebase Audit Report

**Date:** November 26, 2025
**Auditor:** Claude Code
**Version:** 0.1.0
**Branch:** `claude/audit-codebase-01EppavTxaPbvCETuG2X5LFF`
**Status:** ✅ **REMEDIATION COMPLETE**

---

## Executive Summary

Kairos is a well-architected monorepo for a Chinese language learning platform with multiple client applications (desktop, mobile, browser extension) and a Bun/Hono-based API backend. The codebase demonstrates good architectural decisions and modern tooling.

### Risk Rating (Post-Remediation)

| Category | Original Rating | Current Rating | Status |
|----------|-----------------|----------------|--------|
| Security | **Medium** | **Low** | ✅ Fixed |
| Code Completeness | **High Risk** | **Low** | ✅ Implemented |
| Testing | **Medium** | **Medium** | ⚠️ Needs coverage |
| Configuration | **Low** | **Low** | ✅ Good |
| Dependencies | **Low** | **Low** | ✅ Good |

---

## Remediation Summary

The following critical issues have been addressed in commit `471bd9e`:

| Issue | Severity | Status | Fix Applied |
|-------|----------|--------|-------------|
| LTI JWT not verified | **High** | ✅ Fixed | Added `jose` JWT verification with JWKS |
| Billing IDOR | **Medium-High** | ✅ Fixed | Added ownership verification |
| Auth routes no rate limiting | **Medium** | ✅ Fixed | Added `strictRateLimiter()` |
| JWKS placeholder keys | **High** | ✅ Fixed | Added RSA key generation service |
| vocabulary.ts TODOs | **Critical** | ✅ Fixed | Full DB implementation with SM-2 SRS |
| sync.ts TODOs | **Critical** | ✅ Fixed | Full CRDT sync implementation |
| user.ts TODOs | **Critical** | ✅ Fixed | Full profile/settings/export impl |
| No DB pool config | **Low** | ✅ Fixed | Added connection pool settings |
| AppError usage | **Low** | ✅ Fixed | Corrected constructor signatures |

---

## Original Findings (Archived)

---

## Critical Findings

### 1. Incomplete Implementation (Critical)

**Severity:** Critical
**Files Affected:** Multiple route files

The codebase contains **38+ TODO comments** indicating unimplemented functionality. Critical routes return mock/placeholder data instead of actual database operations:

| File | Line | Issue |
|------|------|-------|
| `routes/vocabulary.ts` | 50, 73, 89, 109, 124, 138, 156 | All CRUD operations return mock data |
| `routes/sync.ts` | 46, 61, 117, 172, 196 | Sync operations not implemented |
| `routes/user.ts` | 31, 61, 82, 98, 116, 133 | User profile operations return placeholders |
| `routes/nlp.ts` | 140-149 | Simplification returns input unchanged |
| `routes/analytics.ts` | 97 | Analytics not persisted |

**Impact:** Users would receive empty or mock responses. Core functionality is non-operational.

**Recommendation:** Implement all TODO items before any production deployment.

---

### 2. LTI Security Vulnerability (High)

**Severity:** High
**File:** `routes/lti.ts:403-415`

```typescript
// In production: Verify JWT signature using platform's public key
// For now, decode the JWT payload (base64)
const [, payloadBase64] = idToken.split('.');
let payload: any;
try {
  payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
}
```

**Issue:** The LTI launch endpoint does NOT verify JWT signatures. It merely base64-decodes the payload, allowing any attacker to forge LTI tokens and impersonate users.

**Impact:** Complete authentication bypass for LTI integrations. Attackers could create accounts, access user data, or impersonate instructors.

**Recommendation:** Implement proper JWT signature verification using `jose` library before enabling LTI in production:
```typescript
const { payload } = await jose.jwtVerify(idToken, jwks, { algorithms: ['RS256'] });
```

---

### 3. IDOR Vulnerability in Billing (Medium-High)

**Severity:** Medium-High
**File:** `routes/billing.ts:160-174`

```typescript
billing.post('/cancel', zValidator('json', cancelSchema), async (c) => {
  const body = c.req.valid('json');
  // No validation that user owns this subscription!
  const subscription = await cancelSubscription(
    body.subscriptionId,
    body.provider,
    !body.immediately
  );
```

**Issue:** The cancel subscription endpoint accepts any `subscriptionId` without verifying the authenticated user owns it.

**Impact:** Authenticated users could cancel other users' subscriptions.

**Recommendation:** Add ownership verification:
```typescript
const user = c.get('user');
const subscription = await getSubscription(user.id);
if (subscription?.id !== body.subscriptionId) {
  throw new AppError('FORBIDDEN', 'Not your subscription', 403);
}
```

---

### 4. JWKS Placeholder Keys (High)

**Severity:** High
**File:** `routes/lti.ts:71-84`

```typescript
ltiRoutes.get('/jwks', async (c) => {
  return c.json({
    keys: [{
      n: 'REPLACE_WITH_ACTUAL_PUBLIC_KEY_MODULUS', // Placeholder!
      e: 'AQAB',
    }],
  });
});
```

**Issue:** JWKS endpoint returns placeholder values instead of real RSA keys.

**Impact:** LTI deep linking and grade passback will fail. LMS platforms cannot verify Kairos signatures.

**Recommendation:** Generate and serve actual RSA key pairs, storing private keys securely.

---

## Security Audit

### Authentication & Authorization

| Aspect | Status | Notes |
|--------|--------|-------|
| JWT Verification | **Good** | Using `jose` library with RS256 |
| Token Expiration | **Good** | Handled correctly |
| Role-Based Access | **Good** | `requireRole`, `requireAdmin` middleware |
| Subscription Checks | **Good** | `requireSubscription` middleware |
| Rate Limiting | **Good** | Redis-backed with memory fallback |

### Input Validation

| Aspect | Status | Notes |
|--------|--------|-------|
| Schema Validation | **Good** | Zod schemas on all routes |
| XSS Prevention | **Good** | HTML entity escaping in sanitize.ts |
| SQL Injection | **Good** | Drizzle ORM with parameterized queries |
| Prototype Pollution | **Good** | Explicit filtering of `__proto__`, `constructor` |
| Path Traversal | **Good** | `sanitizeFilename` validator |

### Issues Found

1. **Sanitize Middleware Not Applied to Request Bodies** (`middleware/sanitize.ts:117-134`)
   - The middleware only validates query params
   - `sanitizeBody()` exists but must be called manually in handlers
   - **Risk:** Low - Zod validation catches most issues

2. **Auth Routes Missing Rate Limiting** (`routes/auth.ts`)
   - Login/register endpoints don't use `strictRateLimiter()`
   - **Risk:** Medium - Brute force attacks possible
   - **Fix:** Add `strictRateLimiter()` middleware

3. **Supabase Client Initialization** (`routes/auth.ts:31`)
   ```typescript
   const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
   ```
   - `c.env` values not typed in `AppEnv`
   - Will fail at runtime if env vars missing
   - **Fix:** Use `getEnv()` from `lib/env.ts`

---

## Code Quality Audit

### Strengths

1. **Type Safety:** Strict TypeScript with comprehensive types in `@kairos/types`
2. **Error Handling:** Consistent `AppError` class with structured responses
3. **Logging:** Structured Pino logging with request IDs
4. **Observability:** Sentry integration, Prometheus metrics
5. **Architecture:** Clean separation of routes, services, middleware

### Issues

1. **Console.log/error Usage** (billing.ts, sync.ts)
   - Using `console.error` instead of structured logger
   - **Fix:** Replace with `log.error()`

2. **Inconsistent Environment Access**
   - Some files use `process.env` directly (`janua.ts:213`)
   - Others use validated `getEnv()`
   - **Fix:** Standardize on `getEnv()`

3. **Large Schema File** (`db/schema.ts`: 1463 lines)
   - Single file with all table definitions
   - **Recommendation:** Split by domain (users, vocabulary, enterprise, etc.)

4. **Missing Error Handler for Enterprise Routes** (`enterprise.ts:62, 86`)
   ```typescript
   throw new AppError('Not a member of this organization', 403);
   ```
   - Using message as first arg, but AppError expects code first
   - **Fix:** `throw new AppError('FORBIDDEN', 'Not a member...', 403)`

---

## Database & Performance Audit

### Strengths

1. **Proper Indexing:** Schema includes composite and partial indexes
2. **Cascade Deletes:** Foreign keys properly configured
3. **Connection Management:** Uses postgres.js with connection pooling

### Issues

1. **No Explicit Pool Size** (`db/index.ts:15`)
   ```typescript
   const queryClient = postgres(connectionString);
   ```
   - Default pool settings used
   - **Recommendation:** Configure `max` connections based on infrastructure

2. **Potential N+1 Queries** (`routes/enterprise.ts:156-163`)
   - `getUserOrganizations` may not eagerly load related data
   - **Recommendation:** Use Drizzle relations with `with` clause

3. **Missing Database Transactions**
   - Multi-step operations (e.g., `bulkProvisionUsers`) don't use transactions
   - **Risk:** Partial failures leave inconsistent state
   - **Fix:** Wrap in `db.transaction()`

4. **No Query Caching**
   - Redis is available but not used for caching frequent queries
   - **Recommendation:** Cache vocabulary lookups, HSK levels

---

## Testing Audit

### Coverage Analysis

| Area | Test Files | Coverage |
|------|------------|----------|
| Health | health.test.ts | Basic |
| Billing | billing.test.ts | Public endpoints only |
| Middleware | middleware.test.ts | Comprehensive |
| NLP | nlp.test.ts | Unknown |
| Cards | cards.test.ts | Unknown |
| Observability | observability.test.ts | Unknown |

**Total Test Files:** 6

### Issues

1. **Low Test Coverage**
   - No tests for: auth, user, vocabulary, sync, enterprise, developer, LTI
   - **Risk:** High - Core functionality untested

2. **Missing Integration Tests**
   - No database integration tests
   - No end-to-end authentication flow tests

3. **No Mocking for External Services**
   - Tests may fail without Janua/NLP/Speech services running

**Recommendation:** Add tests for:
- Authentication flows (register, login, refresh, logout)
- Authorization middleware
- Vocabulary CRUD operations
- Sync push/pull
- Enterprise membership management

---

## Configuration & Secrets Audit

### Environment Variables

| Category | Status | Notes |
|----------|--------|-------|
| Validation | **Good** | Zod schema in `lib/env.ts` |
| Required Fields | **Good** | Only `DATABASE_URL` required |
| Defaults | **Good** | Sensible defaults for dev |
| Secret Length | **Acceptable** | JWT_SECRET min 32 chars |

### Issues

1. **Weak Development Credentials** (`.env.example`)
   ```
   POSTGRES_USER=kairos
   POSTGRES_PASSWORD=kairos
   ```
   - Default password same as username
   - **Risk:** Low in dev, ensure not used in production

2. **Missing Secrets in Env Schema** (`lib/env.ts`)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` not in schema
   - But used in `routes/auth.ts`
   - **Fix:** Add to env schema or remove Supabase usage

3. **Hardcoded URLs** (`routes/auth.ts:160`, `routes/lti.ts:498`)
   ```typescript
   redirectTo: 'https://app.kairos.dev/reset-password',
   ```
   - Should use `APP_URL` env variable
   - **Fix:** `redirectTo: \`\${env.APP_URL}/reset-password\``

---

## Dependency Audit

### Package Analysis (apps/api)

| Package | Version | Status |
|---------|---------|--------|
| hono | 4.6.12 | Current |
| drizzle-orm | 0.36.3 | Current |
| zod | 3.23.8 | Current |
| jose | 5.9.6 | Current |
| pino | 9.5.0 | Current |
| @sentry/bun | 8.40.0 | Current |

### Observations

1. **Modern Stack:** All dependencies are recent versions
2. **Small Dependency Tree:** API has minimal dependencies (good for security)
3. **No Known Vulnerabilities:** Based on package versions

### Recommendations

1. Run `pnpm audit` regularly
2. Enable Dependabot/Renovate for automated updates
3. Pin exact versions in production

---

## Docker & Deployment Audit

### Strengths

1. **Health Checks:** All services have proper health checks
2. **Network Isolation:** Services on dedicated bridge network
3. **Volume Persistence:** Data and model volumes configured
4. **Resource Limits:** GPU reservations for ML services

### Issues

1. **Exposed Ports** (`docker-compose.yml`)
   - PostgreSQL (5432), Redis (6379) exposed to host
   - **Risk:** Medium in production
   - **Fix:** Remove port mappings in production, use internal network

2. **No Memory Limits**
   - API service has no memory constraints
   - **Risk:** OOM in containerized environments
   - **Fix:** Add `deploy.resources.limits`

3. **No Secrets Management**
   - Secrets passed as environment variables
   - **Recommendation:** Use Docker secrets or external vault

---

## Recommendations Summary

### Immediate (Before Production)

1. **Implement all TODO items** - Core functionality non-operational
2. **Fix LTI JWT verification** - Critical security vulnerability
3. **Fix billing IDOR** - Users can cancel others' subscriptions
4. **Add auth rate limiting** - Brute force protection
5. **Generate real JWKS keys** - LTI integration broken

### Short-term (1-2 Weeks)

1. Add comprehensive test coverage (target 80%+)
2. Implement database transactions for multi-step operations
3. Standardize environment variable access
4. Add query caching with Redis
5. Configure connection pool sizes

### Medium-term (1 Month)

1. Split schema.ts into domain-specific files
2. Add integration and E2E tests
3. Implement proper secrets management
4. Set up CI/CD security scanning
5. Performance testing and optimization

---

## Files Changed/Created

- `AUDIT_REPORT.md` - This audit report

---

## Conclusion

Kairos has a solid architectural foundation with modern tooling and good security practices in place. However, **the codebase is not production-ready** due to extensive unimplemented functionality and critical security issues in the LTI integration. Addressing the "Immediate" recommendations is essential before any production deployment.

The development team has made excellent choices in technology stack (Bun, Hono, Drizzle, Zod) and has implemented proper authentication, rate limiting, and input validation patterns. Once the TODO items are completed and security issues fixed, this will be a robust platform.
