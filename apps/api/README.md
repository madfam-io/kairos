# @kairos/api

Backend REST API for Kairos, built with Bun and Hono.

## Overview

The API provides endpoints for:
- User authentication and management
- Vocabulary and flashcard CRUD
- NLP processing (segmentation, dictionary lookup)
- AI content simplification
- Pitch analysis for shadowing
- Cross-device synchronization
- Subscription billing

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Bun](https://bun.sh) | JavaScript runtime |
| [Hono](https://hono.dev) | Web framework |
| [Drizzle ORM](https://orm.drizzle.team) | Database ORM |
| [PostgreSQL](https://postgresql.org) | Database |
| [Zod](https://zod.dev) | Schema validation |

## Quick Start

### Development

```bash
# From repository root
pnpm --filter @kairos/api dev

# Or from this directory
cd apps/api
pnpm dev
```

The API runs at `http://localhost:3000`.

### Environment Variables

Create `.env.local` in the repository root:

```bash
# Required
DATABASE_URL=postgres://kairos:kairos@localhost:5432/kairos

# Janua Authentication
JANUA_API_URL=http://localhost:4000
JANUA_PUBLISHABLE_KEY=pk_your_publishable_key
JANUA_JWT_SECRET=your_jwt_secret_key

# Optional
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
NLP_SERVICE_URL=http://localhost:8000
```

## Project Structure

```
apps/api/
├── src/
│   ├── index.ts              # Application entry point
│   ├── types.ts              # API-specific types
│   ├── db/
│   │   ├── index.ts          # Database client
│   │   └── schema.ts         # Drizzle schema definitions
│   ├── routes/
│   │   ├── auth.ts           # Authentication endpoints
│   │   ├── user.ts           # User profile endpoints
│   │   ├── vocabulary.ts     # Vocabulary CRUD
│   │   ├── cards.ts          # Flashcard CRUD
│   │   ├── nlp.ts            # NLP processing
│   │   ├── content.ts        # AI simplification
│   │   ├── pitch.ts          # Pitch analysis
│   │   ├── speech.ts         # TTS synthesis
│   │   ├── sync.ts           # CRDT synchronization
│   │   ├── analytics.ts      # Event tracking
│   │   └── billing.ts        # Stripe integration
│   ├── services/
│   │   ├── nlp-client.ts     # NLP service client
│   │   ├── pitch-client.ts   # Pitch service client
│   │   ├── simplify-client.ts# Simplification client
│   │   ├── speech-client.ts  # Speech service client
│   │   ├── anki.ts           # Anki export
│   │   ├── analytics.ts      # Analytics aggregation
│   │   └── billing.ts        # Stripe billing
│   └── middleware/
│       ├── auth.ts           # JWT authentication
│       ├── error-handler.ts  # Error handling
│       └── rate-limiter.ts   # Rate limiting
│   └── __tests__/
│       ├── auth.test.ts
│       ├── vocabulary.test.ts
│       ├── middleware.test.ts
│       ├── helpers/
│       └── services/
├── drizzle.config.ts         # Drizzle configuration
├── package.json
└── tsconfig.json
```

## Database

### Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          users                                   │
│  id, email, subscriptionTier, settings, stripeCustomerId        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ 1:N
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  vocabulary   │   │    cards      │   │ analyticsEvents│
└───────────────┘   └───────────────┘   └───────────────┘

┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│simplification │   │    show       │   │  syncChanges  │
│    Cache      │   │Simplifications│   │               │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Commands

```bash
# Generate migrations
pnpm db:generate

# Push schema to database
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

## API Routes

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Authenticate |
| POST | `/api/v1/auth/refresh` | Refresh token |
| POST | `/api/v1/auth/logout` | Revoke tokens |

### User

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/user` | Get profile |
| PATCH | `/api/v1/user/settings` | Update settings |
| GET | `/api/v1/user/stats` | Get statistics |

### Vocabulary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/vocabulary` | List words |
| POST | `/api/v1/vocabulary/batch` | Add words |
| PATCH | `/api/v1/vocabulary/:id` | Update word |
| DELETE | `/api/v1/vocabulary/:id` | Delete word |
| POST | `/api/v1/vocabulary/:id/review` | Submit review |
| GET | `/api/v1/vocabulary/due` | Get due reviews |
| GET | `/api/v1/vocabulary/stats` | Get statistics |

### Cards

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/cards` | List cards |
| POST | `/api/v1/cards` | Create card |
| DELETE | `/api/v1/cards/:id` | Delete card |
| POST | `/api/v1/cards/export` | Export cards |

### NLP

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/nlp/segment` | Segment text |
| POST | `/api/v1/nlp/analyze` | Full analysis |

### Content

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/content/simplify` | Simplify sentence |
| POST | `/api/v1/content/simplify/batch` | Batch simplify |

### Pitch

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/pitch/extract` | Extract pitch |
| POST | `/api/v1/pitch/analyze` | Analyze tone |
| POST | `/api/v1/pitch/compare` | Compare pitch |

For complete API documentation, see [API Reference](../../docs/API.md).

## Middleware

### Authentication

JWT verification via Janua:

```typescript
// Protected route
app.get('/api/v1/user', authMiddleware, (c) => {
  const user = c.get('user');
  // ...
});
```

### Rate Limiting

Per-user rate limits using Upstash Redis:

```typescript
// Limit: 100 requests per minute
app.use('/api/*', rateLimiter({
  requests: 100,
  window: '1m',
}));
```

### Error Handling

Standardized error responses:

```typescript
throw new ApiError('VALIDATION_ERROR', 'Invalid email format', 400);

// Response:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format"
  }
}
```

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test src/routes/vocabulary.test.ts

# Watch mode
pnpm test:watch
```

## Deployment

### Fly.io

```bash
fly launch
fly secrets set DATABASE_URL="..." JANUA_API_URL="..."
fly deploy
```

### Docker

```bash
docker build -t kairos-api .
docker run -p 3000:3000 -e DATABASE_URL="..." kairos-api
```

See [Deployment Guide](../../docs/DEPLOYMENT.md) for detailed instructions.

## Related Documentation

- [API Reference](../../docs/API.md) - Complete endpoint documentation
- [Architecture](../../docs/ARCHITECTURE.md) - System design
- [Development Guide](../../docs/DEVELOPMENT.md) - Local setup
- [Database Schema](src/db/schema.ts) - Drizzle schema
