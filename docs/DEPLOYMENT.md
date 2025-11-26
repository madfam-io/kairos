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
│                    Enclii Deployment Platform                        │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  PostgreSQL   │     │    Redis      │     │  AI Services  │
│  (Enclii)     │     │   (Enclii)    │     │   (Docker)    │
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
| All Services | Enclii | Docker orchestration |
| Database | PostgreSQL (Enclii) | Data persistence |
| Cache | Redis (Enclii) | Rate limiting, sessions |
| AI Inference | Docker + GPU | NLP, Simplify, Pitch, Speech |
| Auth/Payments | Janua | Authentication + Billing |
| CDN | Cloudflare | Static assets, DDoS |

### Environment Variables (Production)

```bash
# Required
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@postgres:5432/kairos
REDIS_URL=redis://redis:6379

# Authentication (Janua)
JANUA_API_URL=https://auth.kairos.dev
JANUA_PUBLISHABLE_KEY=pk_live_...
JANUA_JWT_SECRET=your-jwt-secret

# Billing (via Janua plugins)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
CONEKTA_API_KEY=key_live_...
CONEKTA_WEBHOOK_KEY=whkey_...
POLAR_ACCESS_TOKEN=pat_...
POLAR_ORGANIZATION_ID=org_...

# AI Services (internal Enclii network)
NLP_SERVICE_URL=http://nlp:8000
SIMPLIFY_SERVICE_URL=http://simplify:8001
PITCH_SERVICE_URL=http://pitch:8002
SPEECH_SERVICE_URL=http://speech:8003

# AI Models
HF_TOKEN=hf_...  # HuggingFace token for model downloads
MODEL_ID=Qwen/Qwen3-30B-A3B  # Simplification model

# Monitoring
SENTRY_DSN=https://...
POSTHOG_KEY=phc_...
```

## API Deployment

### Option 1: Enclii (Recommended)

The API is deployed as part of the Enclii stack. Configuration is in `enclii.yaml`:

```bash
# Deploy everything
enclii deploy

# Deploy only API service
enclii deploy --service api

# View logs
enclii logs api

# Scale API
enclii scale api --replicas 3
```

The API service is defined in `enclii.yaml`:
- **Port**: 3000
- **Resources**: 1 CPU, 1Gi memory
- **Health check**: `/health` endpoint
- **Auto-scaling**: 1-5 replicas based on CPU/memory

### Option 2: Fly.io

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

All AI services run as Docker containers within the Enclii platform with GPU support.

### Services Overview

| Service | Port | GPU | Model |
|---------|------|-----|-------|
| NLP | 8000 | - | PaddleNLP (Chinese NLP) |
| Simplify | 8001 | A10G | Qwen3-30B-A3B (vLLM) |
| Pitch | 8002 | T4 | FCPE (Pitch extraction) |
| Speech | 8003 | A10G | SenseVoice + CosyVoice |

### Deploy All AI Services

```bash
# Deploy all services via Enclii
enclii deploy

# Or deploy individual services
enclii deploy --service nlp
enclii deploy --service simplify
enclii deploy --service pitch
enclii deploy --service speech
```

### Service Endpoints

Each service exposes REST endpoints:

**NLP Service** (`:8000`):
- `POST /segment` - Segment Chinese text
- `POST /analyze` - Full linguistic analysis
- `GET /health` - Health check

**Simplify Service** (`:8001`):
- `POST /simplify` - Simplify text to target HSK level
- `GET /health` - Health check

**Pitch Service** (`:8002`):
- `POST /extract` - Extract pitch from audio
- `POST /analyze-tone` - Analyze Mandarin tones
- `POST /compare` - Compare learner vs native pitch
- `GET /health` - Health check

**Speech Service** (`:8003`):
- `POST /asr/transcribe` - Speech-to-text
- `POST /tts/synthesize` - Text-to-speech
- `POST /tts/clone` - Voice cloning
- `GET /health` - Health check

### GPU Configuration

GPU resources are configured in `enclii.yaml`:

```yaml
simplify:
  resources:
    cpu: 4
    memory: 24Gi
    gpu: 1
    gpu_type: a10g  # NVIDIA A10G for large LLM

pitch:
  resources:
    cpu: 2
    memory: 8Gi
    gpu: 1
    gpu_type: t4    # NVIDIA T4 for pitch detection

speech:
  resources:
    cpu: 4
    memory: 16Gi
    gpu: 1
    gpu_type: a10g  # NVIDIA A10G for TTS
```

### Model Caching

Models are cached in persistent volumes to avoid re-downloading:

```yaml
volumes:
  huggingface-cache:
    size: 100Gi
    type: ssd
  nlp-models:
    size: 10Gi
  speech-models:
    size: 20Gi
```

### Cost Optimization

- **Persistent volumes**: Models cached to avoid re-downloading
- **Auto-scaling**: Scale down during low traffic
- **Caching**: Redis cache for repeated requests
- **GPU sharing**: Multiple requests per GPU where possible

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

### Enclii PostgreSQL

The database runs as a managed PostgreSQL container within Enclii.

```yaml
# From enclii.yaml
postgres:
  image: postgres:16-alpine
  port: 5432
  resources:
    cpu: 1
    memory: 2Gi
  volumes:
    - postgres-data:/var/lib/postgresql/data
  backup:
    enabled: true
    schedule: "0 2 * * *"  # Daily at 2 AM
    retention: 7
```

### Run Migrations

```bash
# Via Enclii
enclii exec api -- bun run db:migrate

# Or locally (requires network access)
DATABASE_URL=postgresql://... bun run db:push
```

### Database Security

Authentication and authorization is handled via Janua:

```typescript
// API middleware validates Janua JWT tokens
app.use('/api/*', authMiddleware);

// User context available in routes
const userId = c.get('userId');
```

### Backups

Enclii automatically backs up the database daily:

```bash
# View backups
enclii backups list postgres

# Manual backup
enclii backups create postgres

# Restore from backup
enclii backups restore postgres --backup-id backup-123

# Download backup
enclii backups download postgres --backup-id backup-123 > backup.sql
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
# .github/workflows/deploy.yml
name: Deploy to Enclii

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck
      - run: bun test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Enclii CLI
        run: curl -fsSL https://get.enclii.dev | sh

      - name: Deploy to production
        run: enclii deploy --env production
        env:
          ENCLII_TOKEN: ${{ secrets.ENCLII_TOKEN }}

      - name: Run migrations
        run: enclii exec api -- bun run db:migrate
        env:
          ENCLII_TOKEN: ${{ secrets.ENCLII_TOKEN }}
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

**Enclii (API & AI Services):**
```bash
# View deployment history
enclii releases list

# Rollback to previous version
enclii rollback api --version v1.2.3

# Rollback all services
enclii rollback --all --version v1.2.3
```

**Mobile (EAS):**
```bash
eas update:rollback --branch production
```

## Related Documents

- [Architecture](ARCHITECTURE.md) - System design
- [Development Guide](DEVELOPMENT.md) - Local setup
- [API Reference](API.md) - API documentation
