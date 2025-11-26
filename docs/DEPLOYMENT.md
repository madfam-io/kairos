# Deployment Guide

This guide covers deploying Kairos to production environments.

## Table of Contents

- [Overview](#overview)
- [Infrastructure](#infrastructure)
- [API Deployment](#api-deployment)
- [AI Services Deployment](#ai-services-deployment)
- [Mobile App Deployment](#mobile-app-deployment)
- [Desktop App Deployment](#desktop-app-deployment)
- [Browser Extension Deployment](#browser-extension-deployment)
- [Database Setup](#database-setup)
- [Monitoring](#monitoring)
- [CI/CD](#cicd)

## Overview

### Production Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE                                   │
│                    (CDN, DDoS, WAF)                                  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                      API (Bun Runtime)                               │
│                   Cloudflare Workers / Fly.io                        │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Supabase    │     │    Upstash    │     │     Modal     │
│  PostgreSQL   │     │     Redis     │     │  AI Services  │
└───────────────┘     └───────────────┘     └───────────────┘
```

### Environment Configuration

| Environment | Purpose |
|-------------|---------|
| `development` | Local development |
| `staging` | Pre-production testing |
| `production` | Live environment |

## Infrastructure

### Required Services

| Service | Provider | Purpose |
|---------|----------|---------|
| API Hosting | Fly.io / Cloudflare Workers | Backend API |
| Database | Supabase | PostgreSQL + Auth |
| Cache | Upstash | Redis for rate limiting |
| AI Inference | Modal | GPU serverless |
| CDN | Cloudflare | Static assets, DDoS |
| Email | Resend / Postmark | Transactional email |

### Environment Variables (Production)

```bash
# Required
NODE_ENV=production
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cache
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# AI Services
MODAL_NLP_URL=https://kairos-nlp--web-app.modal.run
MODAL_PITCH_URL=https://kairos-pitch--web-app.modal.run
MODAL_SIMPLIFY_URL=https://kairos-simplify--web-app.modal.run

# Monitoring
SENTRY_DSN=https://...
POSTHOG_KEY=phc_...
```

## API Deployment

### Option 1: Fly.io (Recommended)

**1. Install Fly CLI:**

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

**2. Create fly.toml:**

```toml
# apps/api/fly.toml
app = "kairos-api"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[services.ports]]
  port = 443
  handlers = ["tls", "http"]

[checks]
  [checks.health]
    port = 3000
    type = "http"
    interval = "15s"
    timeout = "2s"
    path = "/health"
```

**3. Create Dockerfile:**

```dockerfile
# apps/api/Dockerfile
FROM oven/bun:1 as builder
WORKDIR /app

COPY package.json bun.lockb ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN bun install --frozen-lockfile

COPY packages/types ./packages/types
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
```

**4. Deploy:**

```bash
cd apps/api
fly launch
fly secrets set DATABASE_URL="..." SUPABASE_URL="..."
fly deploy
```

### Option 2: Cloudflare Workers

```bash
# Install Wrangler
npm install -g wrangler

# Configure
wrangler login

# Deploy
cd apps/api
wrangler deploy
```

### Option 3: Self-hosted (Docker)

```bash
# Build image
docker build -t kairos-api ./apps/api

# Run
docker run -d \
  --name kairos-api \
  -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e SUPABASE_URL="..." \
  kairos-api
```

## AI Services Deployment

All AI services are deployed to [Modal](https://modal.com).

### Initial Setup

```bash
# Install Modal CLI
pip install modal

# Authenticate
modal token new
```

### Deploy NLP Service

```bash
cd services/nlp
modal deploy modal_app.py
```

### Deploy Simplification Service

```bash
cd services/simplify
modal deploy modal_app.py
```

### Deploy Pitch Service

```bash
cd services/pitch
modal deploy modal_pitch.py
```

### Deploy Speech Service

```bash
cd services/speech
modal deploy modal_speech.py
```

### Modal Configuration

Each service has auto-scaling configured:

```python
@app.cls(
    image=image,
    gpu="A10G",  # or "T4" for lighter models
    timeout=120,
    container_idle_timeout=180,  # Keep warm for 3 min
    allow_concurrent_inputs=16,  # Handle concurrent requests
)
```

### Cost Optimization

- **Cold start mitigation**: Keep 1 warm instance during peak hours
- **Caching**: Redis cache for repeated requests
- **Batching**: Aggregate requests in 100ms windows

## Mobile App Deployment

### Prerequisites

- Apple Developer Account ($99/year)
- Google Play Developer Account ($25 one-time)
- EAS CLI: `npm install -g eas-cli`

### EAS Configuration

```json
// apps/mobile/eas.json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### Build & Submit

```bash
cd apps/mobile

# Configure
eas login
eas build:configure

# Build iOS
eas build --platform ios --profile production

# Build Android
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### OTA Updates

```bash
# Push JavaScript update (no store review)
eas update --branch production --message "Bug fixes"
```

## Desktop App Deployment

### Prerequisites

- Code signing certificates (macOS, Windows)
- Tauri CLI: `cargo install tauri-cli`

### Build for All Platforms

```bash
cd apps/desktop

# Build for current platform
pnpm tauri build

# Cross-compile (requires CI)
# See GitHub Actions workflow
```

### Code Signing

**macOS:**
```bash
# Export certificate
security find-identity -v -p codesigning

# Sign
codesign --sign "Developer ID Application: Your Name" \
  --options runtime \
  target/release/bundle/macos/Kairos.app
```

**Windows:**
```bash
# Sign with signtool
signtool sign /f certificate.pfx /p password \
  target/release/bundle/msi/Kairos.msi
```

### Distribution

- **macOS**: Notarize and distribute via website or Mac App Store
- **Windows**: Distribute via website or Microsoft Store
- **Linux**: AppImage on website, Flatpak/Snap for stores

### Auto-Update

Tauri supports auto-updates via `tauri-plugin-updater`:

```json
// apps/desktop/src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://releases.kairos.dev/{{target}}/{{current_version}}"],
      "pubkey": "..."
    }
  }
}
```

## Browser Extension Deployment

### Build

```bash
cd apps/extension
pnpm build
```

Output: `build/chrome-mv3-prod.zip` and `build/firefox-mv2-prod.zip`

### Chrome Web Store

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay $5 one-time fee
3. Create new item
4. Upload `chrome-mv3-prod.zip`
5. Fill in listing details
6. Submit for review (1-3 days)

### Firefox Add-ons

1. Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
2. Create account
3. Submit new add-on
4. Upload `firefox-mv2-prod.zip`
5. Submit for review (1-7 days)

### Update Process

1. Increment version in `package.json`
2. Build: `pnpm build`
3. Upload to stores
4. Updates auto-install for users

## Database Setup

### Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings > Database > Connection string
3. Copy the connection string to `DATABASE_URL`

### Run Migrations

```bash
# From local machine
pnpm --filter @kairos/api db:push

# Or via Supabase CLI
supabase db push
```

### Enable Row Level Security

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own data
CREATE POLICY "Users can read own vocabulary"
  ON vocabulary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocabulary"
  ON vocabulary FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Backups

Supabase provides automatic daily backups. For additional safety:

```bash
# Manual backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Monitoring

### Sentry (Error Tracking)

```typescript
// apps/api/src/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### PostHog (Analytics)

```typescript
// apps/mobile/src/providers/AnalyticsProvider.tsx
import PostHog from 'posthog-react-native';

const posthog = new PostHog(process.env.POSTHOG_KEY);

posthog.capture('card_mined', {
  source: 'netflix',
  hsk_level: 3,
});
```

### Uptime Monitoring

Set up Better Uptime or similar:

- Monitor `/health` endpoint
- Alert on downtime
- Public status page

### Alerts

Configure alerts for:

| Metric | Threshold | Action |
|--------|-----------|--------|
| API latency P95 | >500ms | PagerDuty |
| Error rate | >1% | Slack |
| Database connections | >80% | Email |
| Inference queue | >100 | Email |

## CI/CD

### GitHub Actions

```yaml
# .github/workflows/deploy-api.yml
name: Deploy API

on:
  push:
    branches: [main]
    paths:
      - 'apps/api/**'
      - 'packages/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - run: flyctl deploy --remote-only
        working-directory: apps/api
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### Deployment Checklist

Before deploying to production:

- [ ] All tests pass
- [ ] Type check passes
- [ ] Lint passes
- [ ] Manual QA on staging
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Monitoring alerts set up
- [ ] Rollback plan documented

### Rollback

**API (Fly.io):**
```bash
fly releases list
fly deploy --image registry.fly.io/kairos-api:v123
```

**Modal:**
```bash
modal app history kairos-nlp
modal app rollback kairos-nlp v1
```

**Mobile (EAS):**
```bash
eas update:rollback --branch production
```

## Related Documents

- [Architecture](ARCHITECTURE.md) - System design
- [Development Guide](DEVELOPMENT.md) - Local setup
- [API Reference](API.md) - API documentation
