# Kairos Architecture

This document describes the high-level architecture, design decisions, and technical patterns used in Kairos.

## Table of Contents

- [System Overview](#system-overview)
- [Design Principles](#design-principles)
- [Client Applications](#client-applications)
- [Backend Services](#backend-services)
- [AI Services](#ai-services)
- [Data Layer](#data-layer)
- [Synchronization](#synchronization)
- [Security](#security)
- [Performance](#performance)

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│   Browser Extension │   Desktop App       │   Mobile App                    │
│   (Plasmo/React)    │   (Tauri/React)     │   (React Native/Expo)           │
│   - Netflix/YT      │   - Local videos    │   - Card review                 │
│   - Convenience     │   - Primary player  │   - Progress sync               │
└─────────┬───────────┴─────────┬───────────┴─────────────────┬───────────────┘
          │                     │                             │
          └─────────────────────┼─────────────────────────────┘
                                │ HTTPS/WSS
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│                           apps/api (Hono/Bun)                                │
│   - Rate limiting    - Auth validation    - Request routing                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Auth Service │       │   PostgreSQL    │       │  AI Services    │
│   (Janua)     │       │                 │       │   (Docker)      │
│               │       │                 │       │                 │
│ - JWT tokens  │       │ - Users         │       │ - NLP           │
│ - OAuth       │       │ - Vocabulary    │       │ - Simplify      │
│ - Sessions    │       │ - Cards         │       │ - Pitch         │
└───────────────┘       │ - Analytics     │       │ - Speech        │
                        └────────┬────────┘       └────────┬────────┘
                                 │                         │
                        ┌────────▼────────┐                │
                        │     Redis       │◄───────────────┘
                        │   (Upstash)     │
                        │                 │
                        │ - LLM cache     │
                        │ - Rate limits   │
                        │ - Sessions      │
                        └─────────────────┘
```

## Design Principles

### 1. Chinese-First

Every technical decision prioritizes Chinese language accuracy:
- **PaddleNLP LAC** instead of generic tokenizers (99% vs 85% accuracy)
- **Qwen2.5** LLM trained on Chinese data
- **FCPE** pitch detection tuned for Mandarin tones
- **HSK vocabulary** classification built into the data model

### 2. Platform Resilience

Browser extensions are fragile (Netflix/YouTube can break them at any time). Our architecture treats:
- **Desktop app** as the canonical, reliable implementation
- **Browser extension** as a convenience layer that may break
- **Mobile app** as review-focused (no video playback)

```
                        ┌───────────────────────┐
                        │   CORE ENGINE         │
                        │   - Segmentation      │
                        │   - Mining logic      │
                        │   - Sync              │
                        └───────────┬───────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌─────────────┐             ┌─────────────┐             ┌─────────────┐
│  Desktop    │             │  Browser    │             │   Mobile    │
│  (Tauri)    │             │  Extension  │             │   (Expo)    │
│             │             │  (Plasmo)   │             │             │
│  RELIABLE   │             │  FRAGILE    │             │  REVIEW     │
│  Primary    │             │  Convenience│             │  ONLY       │
└─────────────┘             └─────────────┘             └─────────────┘
```

### 3. Offline-First

Users should be able to learn without internet:
- **CRDT synchronization** for conflict-free offline edits
- **IndexedDB** for local data storage
- **Queue-based sync** when connectivity returns

### 4. Cost-Efficient AI

Proprietary APIs (GPT-4, Claude) destroy margins at scale:
- **Self-hosted Qwen3-30B-A3B** via Docker/Enclii ($0.0004/request vs $0.01+)
- **Aggressive caching** for repeated sentences
- **Pre-computed simplifications** for popular shows

## Client Applications

### Desktop App (apps/desktop)

**Technology**: Tauri 2.1 (Rust backend + React frontend)

**Purpose**: Primary video player for local files

**Key Features**:
- Local video playback (.mkv, .mp4, .avi)
- Subtitle overlay with segmentation
- Mining modal for vocabulary cards
- Keyboard-first interface

**Architecture**:
```
┌─────────────────────────────────────────┐
│              React Frontend              │
│  ├── pages/                             │
│  │   ├── HomePage.tsx                   │
│  │   ├── PlayerPage.tsx (core)          │
│  │   ├── VocabularyPage.tsx             │
│  │   └── SettingsPage.tsx               │
│  ├── components/player/                 │
│  │   ├── SubtitleOverlay.tsx            │
│  │   └── MiningModal.tsx                │
│  └── store/ (Zustand)                   │
├─────────────────────────────────────────┤
│              Tauri Backend               │
│  - File system access                   │
│  - Native video decoding                │
│  - OS integration                       │
└─────────────────────────────────────────┘
```

**Related Docs**: [apps/desktop/README.md](../apps/desktop/README.md)

### Browser Extension (apps/extension)

**Technology**: Plasmo (Chrome MV3 + Firefox)

**Purpose**: Overlay on Netflix/YouTube for streaming content

**Key Features**:
- Subtitle interception and enhancement
- Word click for definitions
- One-click mining to API
- Keyboard shortcuts

**Architecture**:
```
┌─────────────────────────────────────────┐
│           Content Scripts                │
│  ├── netflix.tsx (subtitle observer)    │
│  └── youtube.tsx (subtitle observer)    │
├─────────────────────────────────────────┤
│           Background Worker              │
│  ├── messages/word-clicked.ts           │
│  ├── messages/mine-word.ts              │
│  └── messages/segment-text.ts           │
├─────────────────────────────────────────┤
│           Popup UI                       │
│  └── popup.tsx                          │
└─────────────────────────────────────────┘
```

**Related Docs**: [apps/extension/README.md](../apps/extension/README.md)

### Mobile App (apps/mobile)

**Technology**: React Native + Expo 52 + Expo Router

**Purpose**: Review vocabulary and track progress on the go

**Key Features**:
- Spaced repetition review
- Progress dashboard
- Shadowing practice with pitch visualization
- Offline sync

**Architecture**:
```
┌─────────────────────────────────────────┐
│           Expo Router                    │
│  ├── (auth)/                            │
│  │   ├── login.tsx                      │
│  │   └── register.tsx                   │
│  ├── (tabs)/                            │
│  │   ├── index.tsx (dashboard)          │
│  │   ├── vocabulary.tsx                 │
│  │   ├── cards.tsx                      │
│  │   └── settings.tsx                   │
│  ├── review.tsx (SRS session)           │
│  ├── shadowing.tsx (pitch practice)     │
│  └── progress.tsx (analytics)           │
├─────────────────────────────────────────┤
│           Hooks                          │
│  ├── useAuth.ts                         │
│  ├── useSync.ts                         │
│  ├── useVocabulary.ts                   │
│  └── usePitch.ts                        │
└─────────────────────────────────────────┘
```

**Related Docs**: [apps/mobile/README.md](../apps/mobile/README.md)

## Backend Services

### API Server (apps/api)

**Technology**: Bun + Hono + Drizzle ORM

**Purpose**: Central REST API for all clients

**Key Components**:

| Component | Purpose |
|-----------|---------|
| `routes/` | API endpoint handlers |
| `services/` | Business logic and external integrations |
| `middleware/` | Auth, rate limiting, error handling |
| `db/` | Drizzle schema and queries |

**Middleware Stack**:
```
Request
    │
    ▼
┌─────────────┐
│   CORS      │ ← Allow origins: localhost, chrome-extension, app.kairos.dev
└─────┬───────┘
      ▼
┌─────────────┐
│  Logging    │ ← Request/response logging
└─────┬───────┘
      ▼
┌─────────────┐
│  Timing     │ ← X-Process-Time header
└─────┬───────┘
      ▼
┌─────────────┐
│  Security   │ ← Security headers (CSP, etc.)
└─────┬───────┘
      ▼
┌─────────────┐
│ Rate Limit  │ ← Per-user request quotas
└─────┬───────┘
      ▼
┌─────────────┐
│   Auth      │ ← JWT verification (protected routes)
└─────┬───────┘
      ▼
   Handler
```

**Related Docs**: [apps/api/README.md](../apps/api/README.md), [API Reference](API.md)

## AI Services

All AI services run as Docker containers, deployed locally via Docker Compose or in production via [Enclii](https://github.com/madfam-io/enclii).

### NLP Service (services/nlp)

**Model**: PaddleNLP LAC (Lexical Analysis of Chinese)

**Capabilities**:
- Word segmentation (99% accuracy)
- POS tagging
- Named entity recognition
- Pinyin generation (pypinyin)
- Dictionary lookup (CC-CEDICT)
- HSK level classification

**Performance**:
- Cold start: ~10s
- Inference: 10-50ms/request

**Related Docs**: [services/nlp/README.md](../services/nlp/README.md)

### Simplification Service (services/simplify)

**Model**: Qwen3-30B-A3B (vLLM)

**Capabilities**:
- Rewrite sentences to target HSK level
- Preserve proper nouns
- Batch processing

**Cost**: ~$0.0004/request (self-hosted vs $0.01+ proprietary)

**Related Docs**: [services/simplify/README.md](../services/simplify/README.md)

### Pitch Service (services/pitch)

**Model**: FCPE (Fast Context-based Pitch Estimation)

**Capabilities**:
- F0 pitch extraction
- Mandarin tone classification (1-5)
- Pitch contour comparison for shadowing

**Performance**: 77x faster than CREPE, 96.79% accuracy

**Related Docs**: [services/pitch/README.md](../services/pitch/README.md)

### Speech Service (services/speech)

**Models**:
- ASR: SenseVoice-Small (15x faster than Whisper)
- TTS: CosyVoice 2.0 (150ms latency)

**Capabilities**:
- Speech-to-text transcription
- Text-to-speech synthesis
- Zero-shot voice cloning

**Related Docs**: [services/speech/README.md](../services/speech/README.md)

## Data Layer

### Database Schema

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
│               │   │               │   │               │
│ word, pinyin  │   │ word, sentence│   │ eventType     │
│ hskLevel      │   │ audioUrl      │   │ eventData     │
│ status (SRS)  │   │ screenshotUrl │   │ timestamp     │
│ nextReview    │   │ sourceTitle   │   │               │
└───────────────┘   └───────────────┘   └───────────────┘

┌───────────────────────────────────────────────────────────────┐
│                    Supporting Tables                           │
├───────────────────┬───────────────────┬───────────────────────┤
│ simplificationCache│ showSimplifications│     syncChanges      │
│                   │                   │                       │
│ Reduces LLM costs │ Pre-computed HSK  │ CRDT sync operations  │
│ by caching results│ simplifications   │ for offline-first     │
└───────────────────┴───────────────────┴───────────────────────┘
```

### Key Design Decisions

1. **UUID Primary Keys**: Enable CRDT sync without central coordination
2. **JSONB Settings**: Flexible user preferences without migrations
3. **Cascade Deletes**: User deletion removes all associated data
4. **Indexes**: Optimized for vocabulary status queries and SRS scheduling

**Related Docs**: [apps/api/README.md](../apps/api/README.md)

## Synchronization

### CRDT Architecture

Kairos uses **LWW (Last-Writer-Wins) CRDTs** with **Hybrid Logical Clocks** for conflict-free synchronization:

```
┌─────────────────────────────────────────────────────────────────┐
│                     packages/sync                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐    │
│   │    HLC      │      │  LWW-Map    │      │   Engine    │    │
│   │ (Timestamp) │ ──── │  (Storage)  │ ──── │   (Sync)    │    │
│   └─────────────┘      └─────────────┘      └─────────────┘    │
│                                                                  │
│   - Monotonic time     - Get/set/delete    - Push/pull ops     │
│   - Node ID            - Pending queue     - Conflict resolve  │
│   - Compare/merge      - Batch apply       - IndexedDB persist │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Flow

```
Client A                    Server                    Client B
    │                          │                          │
    │  1. Local edit           │                          │
    │  (LWW timestamp)         │                          │
    │                          │                          │
    │  2. Push changes ──────► │                          │
    │                          │  3. Store with           │
    │                          │     vector clock         │
    │                          │                          │
    │                          │ ◄────── 4. Pull changes  │
    │                          │                          │
    │                          │  5. Send changes ──────► │
    │                          │                          │
    │                          │         6. Apply with    │
    │                          │            LWW merge     │
```

**Related Docs**: [packages/sync/README.md](../packages/sync/README.md)

## Security

### Authentication Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        Janua Auth                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Supported Methods:                                              │
│   - Email/password                                                │
│   - Google OAuth                                                  │
│   - GitHub OAuth                                                  │
│   - Microsoft OAuth                                               │
│                                                                   │
│   Token Lifecycle:                                                │
│   - Access token: 15 minutes                                      │
│   - Refresh token: 7 days                                         │
│   - Automatic refresh in clients                                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Security Layers

| Layer | Implementation |
|-------|----------------|
| **Edge** | Cloudflare DDoS protection, WAF |
| **Transport** | TLS 1.3 |
| **Application** | Input validation (Zod), CSRF protection |
| **Auth** | JWT verification, rate limiting on auth endpoints |
| **Data** | Row-level security (RLS), encryption at rest |

### Rate Limiting

```typescript
// Per-user limits (sliding window)
const limits = {
  'api/*': { requests: 100, window: '1m' },
  'api/v1/auth/*': { requests: 5, window: '1m' },
  'api/v1/nlp/*': { requests: 50, window: '1m' },
  'api/v1/content/simplify': { requests: 20, window: '1m' },
};
```

## Performance

### Targets

| Metric | Target | Current |
|--------|--------|---------|
| API latency (P95) | <200ms | ~150ms |
| NLP segmentation | <100ms | 10-50ms |
| LLM simplification | <1.5s | ~1s |
| Extension load | <500ms | ~300ms |
| Mobile app startup | <2s | ~1.5s |

### Optimization Strategies

1. **Edge Caching**: Cloudflare for static assets
2. **LLM Caching**: Redis cache for identical sentences (24h TTL)
3. **Pre-computation**: Popular show simplifications pre-generated
4. **Batch Processing**: Aggregate LLM requests in 100ms windows
5. **Connection Pooling**: Drizzle connection pool for PostgreSQL

### Monitoring

| Concern | Tool |
|---------|------|
| Error tracking | Sentry |
| Logging | Axiom |
| Metrics | Grafana Cloud |
| Uptime | Better Uptime |
| Analytics | PostHog |

## Related Documents

- [API Reference](API.md) - REST API documentation
- [Development Guide](DEVELOPMENT.md) - Local setup and workflows
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Contributing](../CONTRIBUTING.md) - Contribution guidelines
- [PRD](../PRD.md) - Product requirements
