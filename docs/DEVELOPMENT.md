# Development Guide

This guide covers local development setup, workflows, and best practices for contributing to Kairos.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Development Workflow](#development-workflow)
- [Running Applications](#running-applications)
- [Testing](#testing)
- [Code Style](#code-style)
- [Database](#database)
- [AI Services](#ai-services)
- [Debugging](#debugging)
- [Common Issues](#common-issues)

## Prerequisites

### Required

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| pnpm | 9+ | Package manager |
| Git | 2.30+ | Version control |

### Optional (for specific apps)

| Tool | Version | Purpose |
|------|---------|---------|
| Rust | 1.70+ | Desktop app (Tauri) |
| Python | 3.10+ | AI services |
| Docker | 24+ | Local services |
| Android Studio | Latest | Mobile development |
| Xcode | 15+ | iOS development |

### Installation

```bash
# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# pnpm
npm install -g pnpm

# Rust (for desktop app)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Python (via pyenv)
curl https://pyenv.run | bash
pyenv install 3.11
pyenv global 3.11
```

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/kairos-app/kairos.git
cd kairos
```

### 2. Install Dependencies

```bash
pnpm install
```

This installs all workspace dependencies including:
- Root dev dependencies (TypeScript, Prettier, Husky)
- All app dependencies
- All package dependencies

### 3. Environment Configuration

```bash
# Copy example env file
cp .env.example .env.local

# Edit with your values
code .env.local
```

**Required environment variables:**

```bash
# Supabase (required for auth/database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (for local development with Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kairos
```

**Optional environment variables:**

```bash
# Stripe (for billing)
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Modal (for AI services - uses hosted endpoints by default)
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=

# Redis (uses in-memory by default)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Analytics
SENTRY_DSN=
POSTHOG_KEY=
```

### 4. Database Setup

**Option A: Use Supabase (recommended)**

1. Create a project at [supabase.com](https://supabase.com)
2. Copy the URL and keys to `.env.local`
3. Run migrations:

```bash
pnpm --filter @kairos/api db:push
```

**Option B: Local PostgreSQL**

```bash
# Start PostgreSQL with Docker
docker run -d \
  --name kairos-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kairos \
  -p 5432:5432 \
  postgres:15

# Run migrations
pnpm --filter @kairos/api db:push
```

### 5. Verify Setup

```bash
# Type check all packages
pnpm typecheck

# Start development servers
pnpm dev
```

## Development Workflow

### Branch Naming

```
feature/  - New features (feature/add-grammar-explainer)
fix/      - Bug fixes (fix/segmentation-proper-nouns)
docs/     - Documentation (docs/api-reference)
refactor/ - Code refactoring (refactor/sync-engine)
test/     - Test additions (test/api-integration)
```

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(mining): add batch export to Anki
fix(nlp): handle proper nouns correctly
docs(api): update authentication section
refactor(sync): extract conflict resolution
test(api): add vocabulary endpoint tests
chore(deps): update dependencies
```

### Pre-commit Hooks

Husky runs automatically on commit:

```bash
# Runs on staged files
- ESLint (fix)
- Prettier (format)
```

To skip hooks (not recommended):

```bash
git commit --no-verify -m "message"
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with atomic commits
3. Ensure all checks pass locally:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
4. Push and create PR
5. Request review
6. Squash merge when approved

## Running Applications

### All Applications

```bash
# Start all apps in development mode
pnpm dev
```

### Individual Applications

```bash
# API (http://localhost:3000)
pnpm --filter @kairos/api dev

# Mobile (Expo DevTools)
pnpm --filter @kairos/mobile dev

# Desktop (Tauri window)
pnpm --filter @kairos/desktop dev

# Extension (Chrome: chrome://extensions)
pnpm --filter @kairos/extension dev
```

### Packages

Packages are built automatically when apps need them. To build manually:

```bash
# Build all packages
pnpm --filter "./packages/*" build

# Build specific package
pnpm --filter @kairos/types build
```

### AI Services (Optional)

For local AI development:

```bash
cd services/nlp
pip install -e ".[dev]"
python -m src.main

cd services/simplify
pip install -e ".[dev]"
python -m src.main
```

For production, services use Modal endpoints.

## Testing

### Run All Tests

```bash
pnpm test
```

### Run Specific Tests

```bash
# API tests
pnpm --filter @kairos/api test

# Watch mode
pnpm --filter @kairos/api test:watch

# Coverage
pnpm --filter @kairos/api test:coverage
```

### E2E Tests

```bash
# Run E2E tests
pnpm test:e2e

# Run with UI
pnpm --filter @kairos/api test:e2e --ui
```

### Test Structure

```
apps/api/
├── src/
│   └── routes/
│       └── vocabulary.ts
└── tests/
    ├── unit/
    │   └── vocabulary.test.ts
    ├── integration/
    │   └── vocabulary.integration.test.ts
    └── e2e/
        └── vocabulary.e2e.test.ts
```

## Code Style

### TypeScript

- Strict mode enabled
- No implicit any
- Explicit return types on exported functions

```typescript
// Good
export function getVocabulary(userId: string): Promise<Vocabulary[]> {
  // ...
}

// Bad - missing return type
export function getVocabulary(userId: string) {
  // ...
}
```

### React Components

- Functional components with hooks
- Props interface exported separately
- Custom hooks for logic > 10 lines

```typescript
// Good
export interface VocabularyListProps {
  words: Vocabulary[];
  onWordClick: (word: Vocabulary) => void;
}

export function VocabularyList({ words, onWordClick }: VocabularyListProps) {
  return (/* ... */);
}
```

### Error Handling

Use Result types for operations that can fail:

```typescript
import { Result, ok, err } from 'neverthrow';

async function fetchVocabulary(userId: string): Promise<Result<Vocabulary[], ApiError>> {
  try {
    const data = await db.vocabulary.findMany({ where: { userId } });
    return ok(data);
  } catch (e) {
    return err(new ApiError('FETCH_FAILED', e));
  }
}
```

### Formatting

Prettier handles formatting automatically. Config in `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

## Database

### Schema Changes

1. Edit `apps/api/src/db/schema.ts`
2. Generate migration:
   ```bash
   pnpm --filter @kairos/api db:generate
   ```
3. Apply migration:
   ```bash
   pnpm --filter @kairos/api db:push
   ```

### Drizzle Studio

Visual database browser:

```bash
pnpm --filter @kairos/api db:studio
```

### Common Queries

```typescript
import { db } from './db';
import { vocabulary, cards } from './db/schema';
import { eq, and, desc } from 'drizzle-orm';

// Get user vocabulary
const words = await db.query.vocabulary.findMany({
  where: eq(vocabulary.userId, userId),
  orderBy: desc(vocabulary.createdAt),
  limit: 20,
});

// Get due reviews
const due = await db.query.vocabulary.findMany({
  where: and(
    eq(vocabulary.userId, userId),
    lte(vocabulary.nextReview, new Date())
  ),
});
```

## AI Services

### Using Hosted Services (Default)

By default, the API calls Modal-hosted endpoints. No configuration needed.

### Local Development

To run AI services locally:

```bash
# NLP Service
cd services/nlp
pip install -e ".[dev]"

# Download dictionary
mkdir -p data
curl -L https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz -o data/cedict.txt.gz
gunzip data/cedict.txt.gz
mv data/cedict.txt data/cedict_ts.u8

python -m src.main  # http://localhost:8000
```

### Deploying to Modal

```bash
cd services/nlp
modal deploy modal_app.py

cd services/pitch
modal deploy modal_pitch.py

cd services/simplify
modal deploy modal_app.py
```

## Debugging

### API

```bash
# Enable debug logging
DEBUG=kairos:* pnpm --filter @kairos/api dev

# Use VS Code debugger
# .vscode/launch.json is pre-configured
```

### Mobile

```bash
# React Native debugger
# Press 'j' in Expo CLI to open debugger

# Flipper (recommended)
# Install from https://fbflipper.com/
```

### Desktop

```bash
# Tauri dev tools
# Right-click in window > Inspect Element

# Rust backend logs
RUST_LOG=debug pnpm --filter @kairos/desktop dev
```

### Extension

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Inspect" on the extension
4. Use DevTools as normal

## Common Issues

### pnpm install fails

```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules
pnpm install
```

### TypeScript errors after pulling

```bash
# Rebuild packages
pnpm --filter "./packages/*" build
pnpm typecheck
```

### Database connection fails

```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
pnpm --filter @kairos/api db:studio
```

### Tauri build fails

```bash
# Update Rust
rustup update

# Clean and rebuild
pnpm --filter @kairos/desktop clean
pnpm --filter @kairos/desktop build
```

### Modal deployment fails

```bash
# Re-authenticate
modal token new

# Check Python version
python --version  # Should be 3.10+
```

## Related Documents

- [Architecture](ARCHITECTURE.md) - System design
- [API Reference](API.md) - API documentation
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Contributing](../CONTRIBUTING.md) - Contribution guidelines
