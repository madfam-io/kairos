# Kairos Roadmap

## Overview

Development is organized into 4 phases over 12 months, followed by scale and expansion.

## Phase 1: Foundation (Months 1-3)

**Goal:** Core product with working Chinese segmentation and reliable infrastructure.

### Deliverables

| Feature | Priority | Status |
|---------|----------|--------|
| Chrome/Firefox extension | P0 | Implemented |
| Tauri desktop player | P0 | Implemented |
| PaddleNLP segmentation (cloud) | P0 | Implemented |
| Basic dictionary lookup (CC-CEDICT) | P0 | Implemented |
| One-click Anki export | P0 | Implemented |
| User accounts + sync | P1 | Implemented |
| Backend API (core endpoints) | P0 | Implemented |

### Milestones

- **Week 4**: Alpha (internal testing)
- **Week 8**: Closed beta (500 users)
- **Week 12**: Open beta launch

### Pricing

Free (beta period)

---

## Phase 2: Differentiation + Mobile (Months 4-6)

**Goal:** AI features that competitors don't have, plus mobile presence.

### Deliverables

| Feature | Priority | Status |
|---------|----------|--------|
| AI Simplification Engine (Qwen3) | P0 | Implemented |
| Pre-computed simplification packs | P1 | Implemented |
| Pitch visualization (Shadowing) | P0 | Implemented |
| Grammar explainer tooltips | P1 | Implemented |
| Mobile app (iOS + Android) | P0 | Implemented |
| Hard-sub OCR (PaddleOCR) | P1 | Implemented |
| Payment integration (Janua) | P0 | Implemented |

### Milestones

- **Week 16**: AI features live (Learner tier)
- **Week 20**: Mobile app beta (TestFlight/Play Store)
- **Week 24**: Full launch (paid tiers)

### Pricing Launch

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Core features, 5 cards/day |
| Learner | $8/mo | Full features, 500 AI sentences/mo |
| Immersion | $12/mo | Unlimited AI, mobile app |

---

## Phase 3: Community & Growth (Months 7-9)

**Goal:** Network effects and viral mechanics.

### Deliverables

| Feature | Priority | Status |
|---------|----------|--------|
| Shared vocabulary decks | P0 | Implemented |
| "Classroom Mode" for tutors | P1 | Implemented |
| Pre-simplified packs (50+ shows) | P1 | Implemented |
| Leaderboards + social features | P2 | Implemented |
| API for third-party integrations | P2 | Implemented |
| Affiliate/referral program | P1 | Implemented |

### Milestones

- **Week 28**: Shared decks v1
- **Week 32**: Classroom Mode beta
- **Week 36**: 10,000 paid subscribers target

---

## Phase 4: Scale & Expand (Months 10-12)

**Goal:** Operational excellence and market expansion.

### Deliverables

| Feature | Priority | Status |
|---------|----------|--------|
| Japanese language support | P1 | Implemented |
| Advanced analytics dashboard | P2 | Implemented |
| Enterprise/institutional tier | P2 | Implemented |
| Native Windows/Mac apps | P1 | Implemented |
| Offline mode (full) | P1 | Implemented |

---

## Go-To-Market Timeline

### Pre-Launch (Weeks -8 to 0)

| Week | Action | Goal |
|------|--------|------|
| -8 | Active in r/ChineseLanguage, Refold Discord | Build recognition |
| -6 | Publish "State of Chinese Segmentation" blog | SEO + credibility |
| -4 | Open-source PaddleNLP WASM wrapper | Goodwill + backlinks |
| -3 | Announce closed beta, collect 500 emails | Waitlist |
| -2 | Invite 50 beta testers | Early feedback |
| -1 | "Building in Public" thread | Anticipation |
| 0 | Public beta launch | Go live |

### Launch Sequence

```
Month 1: Closed Beta (500 users)
├── Goal: Find critical bugs, validate core value prop
├── Metrics: NPS > 40, DAU/MAU > 30%
└── No monetization

Month 2: Open Beta (2,000 users)
├── Goal: Stress test infrastructure, refine onboarding
├── Metrics: 7-day retention > 40%
└── No monetization

Month 3: Soft Launch (5,000 users)
├── Goal: Introduce paid tiers, measure conversion
├── Metrics: Free → Paid conversion > 5%
└── Learner + Immersion tiers live

Month 4+: Growth Phase
├── Goal: Scale acquisition, add mobile
├── Metrics: MRR growth > 20% MoM
└── Full marketing push
```

---

## Financial Projections

| Month | Users | Paid | Conv% | MRR | ARR |
|-------|-------|------|-------|-----|-----|
| M3 | 5,000 | 250 | 5% | $2,250 | $27K |
| M6 | 18,000 | 1,260 | 7% | $11,340 | $136K |
| M9 | 40,000 | 3,400 | 8.5% | $30,600 | $367K |
| M12 | 65,000 | 6,500 | 10% | $58,500 | $702K |
| M18 | 120,000 | 14,400 | 12% | $129,600 | $1.56M |
| M24 | 200,000 | 28,000 | 14% | $252,000 | $3.02M |

---

## Success Metrics (KPIs)

### Product Metrics

| Metric | Target |
|--------|--------|
| Mining Velocity | < 3 seconds per card |
| Parsing Accuracy | < 1 error per 1,000 sentences |
| Simplification Quality | > 4.0/5 rating |
| OCR Accuracy | > 98% character accuracy |
| Pitch Detection Accuracy | > 85% tone match |

### Business Metrics

| Metric | Month 6 | Month 12 |
|--------|---------|----------|
| Registered users | 10,000 | 50,000 |
| Paid subscribers | 1,000 | 10,000 |
| MRR | $9,000 | $100,000 |
| Free → Paid conversion | 5% | 8% |
| Monthly churn | < 8% | < 5% |
| NPS | > 40 | > 50 |

### Engagement Metrics

| Metric | Target | Why |
|--------|--------|-----|
| DAU/MAU | > 30% | Habit formation |
| Sessions per week | > 3 | Learning consistency |
| Cards mined per session | > 10 | Active learning |
| Simplification toggle usage | > 40% of sessions | AI feature validation |
| Mobile app DAU | > 20% of total | Cross-platform stickiness |

---

## Current Implementation Status

### Completed

**Core Infrastructure:**
- Backend API (Bun + Hono + Drizzle)
- Database schema (PostgreSQL)
- Auth system (Janua)
- CRDT sync engine
- Docker deployment (Enclii)
- Integration tests

**NLP Services:**
- PaddleNLP segmentation service (Chinese)
- CC-CEDICT dictionary service
- Qwen3 simplification service
- Pre-computed simplification packs
- Grammar explainer tooltips (Chinese & Japanese)
- Japanese language support (SudachiPy + JMdict + JLPT)

**Speech Services:**
- FCPE pitch detection service
- SenseVoice ASR service
- CosyVoice + Fish Speech TTS services
- Hard-sub OCR (PaddleOCR)

**Client Apps:**
- Mobile app (Expo + React Native 0.77)
- Desktop app (Tauri 2.1)
- Browser extension (Chrome/Firefox)

**User Features:**
- Payment integration (Stripe, Conekta, Polar via Janua)
- Anki export (CSV, JSON, AnkiConnect, text import)
- Shared vocabulary decks (community)
- Classroom mode (for tutors)
- Affiliate/referral program
- Full offline mode

**Analytics & Insights:**
- Advanced analytics dashboard with real database queries
- Daily/weekly/monthly progress tracking
- Vocabulary growth charts with HSK breakdown
- Activity heatmap (GitHub-style)
- Retention and mastery analysis
- Learning goals and milestones
- AI-generated learning insights and recommendations

**Enterprise/Institutional:**
- Organization management (universities, schools, companies)
- Multi-tier role system (owner, admin, instructor, member)
- Department/course hierarchy
- Bulk user provisioning (CSV import, invitations)
- Private content libraries (organization-only decks)
- SSO integration support (SAML/OIDC)
- Organization-wide analytics dashboard
- Seat-based licensing with volume pricing
- Comprehensive audit logging
- License management and history

**Third-Party API Integrations:**
- OAuth2 authorization code flow with PKCE
- API key authentication for server-to-server
- Developer portal for app registration
- Webhook system with delivery tracking and retries
- LTI 1.3 integration for LMS (Canvas, Blackboard, Moodle)
- External integrations (Notion, Readwise, Obsidian, Anki Connect)
- API usage analytics and rate limiting
- Comprehensive documentation and scopes

### Planned

All major planned features have been implemented!

---

## Related Documents

- [Vision](./VISION.md) - Strategic positioning
- [Architecture](./ARCHITECTURE.md) - Technical implementation
- [Development](./DEVELOPMENT.md) - Setup guide
- [PRD](../PRD.md) - Full product requirements
