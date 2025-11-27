# Kairos

**The Intelligent Chinese Immersion Engine**

Kairos helps learners acquire Chinese through immersive content consumption. Watch your favorite C-dramas, YouTube videos, and more while building vocabulary naturally with AI-powered tools designed specifically for Chinese.

[![CI](https://github.com/kairos-app/kairos/actions/workflows/ci.yml/badge.svg)](https://github.com/kairos-app/kairos/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)]()

## Why Kairos?

| Problem | Kairos Solution |
|---------|-----------------|
| Generic tools break on Chinese text | **Chinese-first architecture** with PaddleNLP (99% accuracy) |
| Native content is too hard | **AI Simplification** rewrites subtitles to your HSK level |
| Tone practice is guesswork | **Pitch visualization** shows your voice vs native speakers |
| Setup takes hours | **Zero-config** across desktop, browser, and mobile |

## Features

- **Neural Segmentation**: PaddleNLP LAC for accurate word boundaries
- **AI Simplification**: Qwen2.5-7B rewrites sentences to HSK 3/4/5/6 levels
- **Pitch Visualization**: FCPE-powered tone analysis for shadowing practice
- **Sentence Mining**: One-click vocabulary cards with audio and screenshots
- **Cross-platform Sync**: CRDT-based offline-first synchronization
- **Anki Export**: Direct integration with AnkiConnect

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├────────────────┬────────────────┬────────────────┬──────────────┤
│    Desktop     │    Browser     │     Mobile     │    Shared    │
│  apps/desktop  │ apps/extension │  apps/mobile   │   packages/  │
│   (Tauri)      │   (Plasmo)     │    (Expo)      │  types,sync  │
└───────┬────────┴───────┬────────┴───────┬────────┴──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API LAYER                               │
│                        apps/api (Hono/Bun)                       │
└───────┬────────────────┬────────────────┬───────────────────────┘
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis     │ │    Modal     │
│  (Supabase)  │ │  (Upstash)   │ │ (AI Services)│
└──────────────┘ └──────────────┘ └──────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (optional, for local services)

### Installation

```bash
# Clone the repository
git clone https://github.com/kairos-app/kairos.git
cd kairos

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development servers
pnpm dev
```

### Running Individual Apps

```bash
# API server (http://localhost:3000)
pnpm --filter @kairos/api dev

# Mobile app (Expo)
pnpm --filter @kairos/mobile dev

# Desktop app (Tauri)
pnpm --filter @kairos/desktop dev

# Browser extension
pnpm --filter @kairos/extension dev
```

## Project Structure

```
kairos/
├── apps/
│   ├── api/              # REST API (Bun + Hono)
│   ├── desktop/          # Desktop player (Tauri + React)
│   ├── extension/        # Browser extension (Plasmo)
│   └── mobile/           # Mobile app (React Native + Expo)
├── packages/
│   ├── auth/             # Authentication utilities
│   ├── sync/             # CRDT sync engine
│   └── types/            # Shared TypeScript types
├── services/
│   ├── nlp/              # Chinese segmentation (PaddleNLP)
│   ├── pitch/            # Tone detection (FCPE)
│   ├── simplify/         # AI simplification (Qwen2.5)
│   └── speech/           # ASR + TTS (SenseVoice, CosyVoice)
└── docs/                 # Documentation
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design and technical decisions |
| [API Reference](docs/API.md) | REST API endpoints and schemas |
| [Development Guide](docs/DEVELOPMENT.md) | Local setup and workflows |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deployment instructions |
| [Contributing](CONTRIBUTING.md) | How to contribute to Kairos |
| [PRD](PRD.md) | Product requirements and roadmap |

### App Documentation

| App | Description |
|-----|-------------|
| [API](apps/api/README.md) | Backend REST API |
| [Desktop](apps/desktop/README.md) | Tauri desktop application |
| [Extension](apps/extension/README.md) | Browser extension for Netflix/YouTube |
| [Mobile](apps/mobile/README.md) | React Native mobile app |

### Package Documentation

| Package | Description |
|---------|-------------|
| [auth](packages/auth/README.md) | Authentication utilities |
| [sync](packages/sync/README.md) | CRDT synchronization engine |
| [types](packages/types/README.md) | Shared TypeScript types |

### Service Documentation

| Service | Description |
|---------|-------------|
| [NLP](services/nlp/README.md) | Chinese segmentation and dictionary |
| [Pitch](services/pitch/README.md) | Tone detection and analysis |
| [Simplify](services/simplify/README.md) | AI sentence simplification |
| [Speech](services/speech/README.md) | ASR and TTS services |

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | pnpm workspaces + Turborepo |
| **API** | Bun + Hono + Drizzle ORM |
| **Database** | PostgreSQL |
| **Cache** | Redis (Upstash) |
| **Auth** | Janua SSO |
| **Desktop** | Tauri 2 + React |
| **Mobile** | React Native + Expo 52 |
| **Extension** | Plasmo (Chrome MV3) |
| **AI Services** | Docker containers (Enclii) |
| **NLP** | PaddleNLP LAC |
| **LLM** | Qwen3-30B-A3B |
| **Pitch** | FCPE |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all development servers |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type check all packages |
| `pnpm format` | Format code with Prettier |
| `pnpm clean` | Clean all build artifacts |

## Environment Variables

See [.env.example](.env.example) for required environment variables:

```bash
# Database
DATABASE_URL=postgres://kairos:kairos@localhost:5432/kairos

# Janua Authentication
JANUA_API_URL=http://localhost:4000
JANUA_PUBLISHABLE_KEY=pk_your_publishable_key
JANUA_JWT_SECRET=your_jwt_secret_key

# Payment Providers
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# AI Services (internal Docker network)
NLP_SERVICE_URL=http://nlp:8000
SIMPLIFY_SERVICE_URL=http://simplify:8001

# Analytics (Optional)
SENTRY_DSN=
POSTHOG_KEY=
```

## Roadmap

See [PRD.md](PRD.md) for detailed roadmap. Summary:

- **Phase 1** (Months 1-3): Core player, segmentation, mining
- **Phase 2** (Months 4-6): AI simplification, pitch visualization, mobile
- **Phase 3** (Months 7-9): Shared decks, community features
- **Phase 4** (Months 10-12): Japanese support, enterprise tier

## License

This project is proprietary software. See [LICENSE](LICENSE) for details.

## Acknowledgments

- [PaddleNLP](https://github.com/PaddlePaddle/PaddleNLP) for Chinese NLP
- [FCPE](https://github.com/CNChTu/FCPE) for pitch detection
- [Qwen](https://github.com/QwenLM/Qwen2.5) for language model
- [CC-CEDICT](https://cc-cedict.org/) for dictionary data
