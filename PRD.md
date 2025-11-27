# Product Requirements Document (PRD): "Kairos" – The Intelligent Chinese Immersion Engine

| **Document Name** | Kairos PRD: Next-Gen Chinese Immersion |
| :--- | :--- |
| **Version** | 2.1 |
| **Status** | Production Ready |
| **Strategic Position** | **"The Chinese-First Comprehension Engine"**<br>Moving beyond simple dictionaries to AI-driven content adaptation and tone mastery, with superior Chinese NLP and sustainable unit economics via open-source AI. |

-----

## 1\. Executive Summary & Strategic Positioning

### 1.1 The Opportunity

The current market for immersion tools is polarized. On one end, **Migaku** and **Refold** cater to hardcore power users but suffer from technical friction (legacy segmentation breaks on Chinese). On the other, **Language Reactor** is accessible but technically stagnant ("abandonware") with poor Chinese parsing.

**Kairos** directly competes with Migaku on value, not price. We offer:
- **Superior Chinese processing** (PaddleNLP vs. generic tokenizers)
- **AI comprehension features** they don't have (i+1 simplification, tone visualization)
- **Cross-platform experience** (browser + mobile + standalone player)

The goal is not to be cheaper—it's to be *definitively better* for Chinese learners.

### 1.2 Core Differentiators

1.  **Chinese-First Architecture:** Abandoning generic "polyglot" libraries for **PaddleNLP** and **PaddleOCR**, ensuring 99% accuracy in Chinese segmentation and hard-sub recognition (solving the #1 user complaint).
2.  **The "i+1" Generator (AI Simplification):** Using **open-source LLMs** (Qwen3-30B-A3B via vLLM) to rewrite complex C-Drama subtitles into HSK 3/4/5 vocabulary while retaining the original meaning. Self-hosted inference ensures sustainable unit economics.
3.  **Visual Tone Feedback:** A "Shadowing Mode" that visualizes the user's pitch contour overlaying the native speaker's audio in real-time, addressing the specific needs of tonal language learners.
4.  **Platform Resilience:** Standalone local video player as the reliable core, with browser extensions as convenience layers that can break without killing the product.
5.  **Mobile-First Review:** Companion app for reviewing mined content, ensuring learning continues away from the desktop.

-----

## 2\. User Personas

| Persona | **"The Plateaued Intermediate" (Liam)** | **"The Efficient Professional" (Sarah)** |
| :--- | :--- | :--- |
| **Profile** | HSK 4 level. Stuck. Can read textbooks but fails at Netflix. | Tech-savvy, busy. Willing to pay to save time. |
| **Current Pain** | "I try to watch *The Untamed*, but I have to pause every 2 seconds. It's too hard, so I quit." | "Setting up Anki + Yomitan + ASBPlayer takes 3 hours. I just want it to work." |
| **Kairos Solution** | **AI Simplification:** He toggles "HSK 4 Mode." Subtitles are rewritten to his level. He stays in the flow. | **One-Click Mining:** Instant export to Anki with high-res audio/screenshot without configuration. |

-----

## 3\. Monetization Strategy

### 3.1 Pricing Model: Subscription-Only

We accept the Migaku comparison and compete directly on value. Clean, simple pricing with no hybrid confusion.

| Tier | Price | Includes |
| :--- | :--- | :--- |
| **Free** | $0 | Core player, manual segmentation lookup, 5 cards/day export, no AI features |
| **Learner** | $8/month | Unlimited mining, AI simplification (500 sentences/mo), pitch visualization, cloud sync |
| **Immersion** | $12/month | Everything in Learner + unlimited AI, priority processing, mobile app, early features |
| **Annual Discount** | 2 months free | $80/year (Learner) or $120/year (Immersion) |

### 3.2 Unit Economics

**Target metrics at 10,000 paid subscribers (Month 18):**

| Metric | Value |
| :--- | :--- |
| **MRR** | $100,000 (assuming 70% Learner, 30% Immersion) |
| **Infrastructure cost** | ~$15,000/mo (inference, hosting, CDN) |
| **Gross margin** | 85% |
| **CAC target** | <$30 |
| **LTV (24-mo, 5% churn)** | ~$180 |
| **LTV:CAC ratio** | 6:1 |

### 3.3 Cost Control: Open Source AI

Proprietary LLM APIs (Claude, GPT-4) cost $3-15 per 1M tokens. At scale, this destroys margins.

**Our approach:** Self-hosted open-source models optimized for Chinese:

| Use Case | Model | Why |
| :--- | :--- | :--- |
| Subtitle simplification | **Qwen3-30B-A3B** | Best Chinese performance, MoE architecture, Apache 2.0 license |
| Grammar explanation | **Qwen3-30B-A3B** | Nuanced linguistic explanations |
| Fallback/complex | **Qwen3-30B-A3B** | Unified model for consistency |

**Inference cost estimate (self-hosted via Docker/Enclii):**
- Qwen3-30B-A3B: ~$0.0004/request (vs $0.01+ for proprietary APIs)
- 500 sentences/user/month ≈ $0.20/user/month
- At 10K users: $2,000/month for simplification inference (vs $50,000+ with proprietary APIs)

-----

## 4\. Go-To-Market Strategy

### 4.1 Launch Philosophy: Community-First

We are not launching a product; we are joining a community. The Chinese learning community (r/ChineseLanguage, Refold Discord, MandarinCorner) is tight-knit and skeptical of new tools. Trust is earned through:
1. **Transparency** about what works and what doesn't
2. **Responsiveness** to feedback and bug reports
3. **Contribution** to the community before asking for payment

### 4.2 Pre-Launch (Months -2 to 0)

| Week | Action | Goal |
| :--- | :--- | :--- |
| -8 | Founder active in r/ChineseLanguage, Refold Discord, Heavenly Path Discord | Build recognition, understand pain points |
| -6 | Publish "State of Chinese Segmentation" blog post (technical deep-dive comparing tools) | SEO + credibility |
| -4 | Open-source the PaddleNLP WASM wrapper as standalone library | Goodwill + backlinks |
| -3 | Announce closed beta, collect 500 email signups | Waitlist |
| -2 | Invite 50 beta testers from community contributors | Early feedback |
| -1 | "Building in Public" thread on Reddit/Twitter showing development | Anticipation |
| 0 | Public beta launch | Go live |

### 4.3 Acquisition Channels

**Primary channels (80% of effort):**

| Channel | Tactic | CAC Estimate |
| :--- | :--- | :--- |
| **Reddit** | Weekly value posts in r/ChineseLanguage, r/LearnChinese, r/Refold. No spam—genuine help. | $5-10 |
| **Discord communities** | Refold, Heavenly Path, Matt vs Japan servers. Become known helper before promoting. | $5-10 |
| **YouTube** | Partner with 3-5 mid-tier Chinese learning YouTubers (10K-100K subs) for honest reviews. Affiliate program (20% rev share). | $20-30 |
| **SEO** | Target long-tail: "learn Chinese with Netflix," "Chinese drama subtitles," "HSK 4 immersion" | $10-15 |

**Secondary channels (20% of effort):**

| Channel | Tactic |
| :--- | :--- |
| **iTalki tutors** | Partner program: tutors get free Immersion tier, recommend to students |
| **Chinese learning blogs** | Guest posts on Hacking Chinese, Chinese-Forums.com |
| **Product Hunt** | Coordinate launch for visibility spike |

### 4.4 Launch Sequence

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

### 4.5 Retention Mechanics

Acquisition means nothing without retention. Built-in retention loops:

1. **Daily streak tracking** — Gamification for consistent usage
2. **Weekly progress emails** — "You learned 47 words this week" with social comparison
3. **Spaced repetition integration** — Cards need reviewing (external habit trigger)
4. **Shared decks for popular shows** — Community content keeps users engaged
5. **Mobile app** — Learning continues when desktop isn't available

### 4.6 Competitive Response Plan

When Migaku inevitably copies our features:

| If they copy... | Our response |
| :--- | :--- |
| AI simplification | Emphasize Chinese-specific quality (Qwen vs generic models) |
| Chinese segmentation | We're 18 months ahead; focus on next differentiator |
| Pricing | Don't race to bottom; emphasize value |

**Sustainable moat (long-term):**
- Community-generated simplified subtitle packs for 100+ popular shows
- User vocabulary data enabling personalized difficulty scoring
- Network effects from shared decks and classroom features

-----

## 5\. Functional Requirements

### 5.1 Core Player & Overlay

The core interface is **multi-modal**: a standalone desktop player (primary), browser extension (convenience), and mobile app (review).

  * **FR-01: Neural Segmentation (WASM/Cloud Hybrid):**
      * **Requirement:** Must replace standard browser segmentation with **PaddleNLP** (or a distilled WASM version) to correctly parse proper nouns (e.g., distinguishing "Harry Potter" transliterations from random characters).
      * **Implementation:** WASM for common cases (<50ms), cloud fallback for complex sentences (>200ms acceptable).
      * **Feature:** "Ambiguity Hover." If a phrase is ambiguous, the parser highlights the ambiguity and offers the two most likely segmentations.
  * **FR-02: Hard-Sub OCR (Optical Character Recognition):**
      * **Requirement:** Auto-detect subtitle region on first frame, with manual adjustment option.
      * **Tech Stack:** **PaddleOCR** (optimized for Chinese characters) via ONNX runtime.
      * **Performance:** OCR latency must be <500ms for real-time, <800ms acceptable for manual trigger.
  * **FR-03: Standalone Desktop Player:**
      * **Requirement:** Electron/Tauri-based player for local video files (.mkv, .mp4, .avi).
      * **Rationale:** Platform-independent reliability. Works offline. No extension breakage risk.
      * **Features:** All core features (segmentation, OCR, mining, simplification) available without browser.

### 5.2 The "i+1" Simplification Engine (AI Feature)

  * **FR-04: Real-Time Subtitle Rewriting:**
      * **User Action:** User selects their level (e.g., "HSK 3").
      * **System Action:** When a subtitle line exceeds the user's level, the system calls the LLM to rewrite using *only* HSK 3 vocabulary + proper nouns, displayed below the original.
      * **Model:** Qwen2.5-7B-Instruct (self-hosted) with fine-tuned prompt for subtitle simplification.
      * **Latency target:** <1.5s for first display (pre-fetch next 3 subtitles while current plays).
      * **Example:**
          * *Original:* "陛下，此事万万不可鲁莽行事" (Your Majesty, this matter absolutely cannot be handled recklessly).
          * *Simplified (HSK 3):* "皇上，这件事不能太快做" (The Emperor, this matter cannot be done too fast).
  * **FR-05: Pre-computed Simplification Packs:**
      * **Requirement:** For popular shows (top 50 C-Dramas), pre-compute and cache all simplified subtitles at HSK 3/4/5 levels.
      * **Benefit:** Zero latency for cached content, reduced inference costs.
      * **Community feature:** Users can contribute/verify simplifications.
  * **FR-06: Grammar "Explainer" Tooltip:**
      * **Requirement:** Hovering over a grammar particle (e.g., 了, 把, 被) invokes a specific grammar explanation, not a dictionary definition.
      * **Implementation:** Curated grammar database (500+ patterns) with LLM fallback for unlisted patterns.

### 5.3 The "Tone Perfect" Shadowing Module

  * **FR-07: Pitch Visualization Overlay:**
      * **Requirement:** When video is paused, user can record audio. The system visualizes the *Pitch Contour* (F0 frequency) of the actor vs. the user.
      * **Tech:** TensorFlow.js SPICE model for pitch extraction.
      * **Differentiation:** Competitors use simple waveform (volume), which is useless for tones. We show actual pitch.
  * **FR-08: Tone Scoring:**
      * **Requirement:** Provide a 0-100 score for tone accuracy with specific feedback ("Tone 2 started too low").

### 5.4 The Mining Workflow (Anki Integration)

  * **FR-09: Zero-Config AnkiConnect:**
      * **Requirement:** Auto-detect running Anki instance. Pre-installed "Kairos Note Type" with fields for: Audio, Screenshot, Sentence, Definition, Pinyin, and **simplified sentence version**.
      * **Fallback:** If Anki not detected, offer internal SRS or CSV export.
  * **FR-10: Smart Audio Clipping (VAD):**
      * **Requirement:** Use Voice Activity Detection (Silero VAD) to ensure the audio clip doesn't cut off the first/last syllable, adding dynamic padding (±250ms) based on the waveform.
  * **FR-11: Batch Mining Mode:**
      * **Requirement:** "Mine all unknown words in this episode" with review queue before export.

-----

## 6\. Technical Architecture & Stack

### 6.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│   Browser Extension │   Desktop App       │   Mobile App                    │
│   (Plasmo/React)    │   (Tauri/React)     │   (React Native)                │
│   - Netflix/YT      │   - Local videos    │   - Card review                 │
│   - Convenience     │   - Primary player  │   - Progress sync               │
└─────────┬───────────┴─────────┬───────────┴─────────────────┬───────────────┘
          │                     │                             │
          └─────────────────────┼─────────────────────────────┘
                                │ HTTPS/WSS
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│                         (Cloudflare Workers)                                 │
│   - Rate limiting    - Auth validation    - Request routing                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Auth Service │       │   Core API      │       │  Inference API  │
│  (Supabase)   │       │   (Hono/Bun)    │       │  (Modal/RunPod) │
│               │       │                 │       │                 │
│ - JWT tokens  │       │ - User data     │       │ - Qwen2.5-7B    │
│ - OAuth       │       │ - Vocabulary    │       │ - Qwen2.5-14B   │
│ - Sessions    │       │ - Sync          │       │ - DeepSeek      │
└───────────────┘       │ - Analytics     │       │ - PaddleNLP     │
                        └────────┬────────┘       └────────┬────────┘
                                 │                         │
                                 ▼                         │
                        ┌─────────────────┐                │
                        │   PostgreSQL    │                │
                        │   (Supabase)    │                │
                        │                 │                │
                        │ - Users         │                │
                        │ - Subscriptions │                │
                        │ - Vocabulary    │                │
                        │ - Analytics     │                │
                        └─────────────────┘                │
                                                           │
                        ┌─────────────────┐                │
                        │     Redis       │◄───────────────┘
                        │  (Upstash)      │
                        │                 │
                        │ - LLM cache     │
                        │ - Rate limits   │
                        │ - Sessions      │
                        └─────────────────┘
```

### 6.2 Technology Selection

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Browser Extension** | React + Plasmo Framework | Industry standard for cross-browser extensions |
| **Desktop App** | Tauri + React | Rust-based, smaller than Electron, better performance |
| **Mobile App** | React Native | Code sharing with web, mature ecosystem |
| **API Gateway** | Cloudflare Workers | Global edge, DDoS protection, <50ms latency worldwide |
| **Core API** | Hono + Bun | Fast, TypeScript-native, edge-compatible |
| **Auth** | Janua SSO | Unified auth/billing with OAuth, JWT, JWKS verification |
| **Database** | PostgreSQL (Enclii) | Managed Postgres with connection pooling |
| **Cache** | Upstash Redis | Serverless Redis, pay-per-request |
| **Segmentation** | PaddleNLP (Modal serverless) | Best-in-class Chinese NER |
| **OCR** | PaddleOCR (ONNX in-browser + Modal fallback) | Superior Chinese character recognition |
| **Pitch Detection** | TensorFlow.js (SPICE) | Client-side pitch extraction |
| **LLM Inference** | Docker/Enclii (Qwen3-30B-A3B) | Self-hosted GPU, vLLM for efficiency |

### 6.3 Inference Infrastructure (Open Source Models)

**Primary compute provider: Modal**

| Model | GPU | Cost/hr | Tokens/sec | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| Qwen3-30B-A3B | A10G | $0.76 | ~150 | All simplification and grammar |

**Scaling strategy:**
- Cold start mitigation: Keep 1 warm instance during peak hours (8am-11pm user timezone)
- Auto-scale: 0-10 instances based on queue depth
- Caching: Redis cache with 24hr TTL for identical sentences
- Batching: Aggregate requests in 100ms windows for throughput

**Alternative providers (failover):**
- RunPod: Slightly cheaper, less reliable cold starts
- Together.ai: Managed inference, higher cost but zero ops
- Replicate: Good for burst traffic

### 6.4 Backend Services Detail

#### 6.4.1 Auth Service (Janua)

```typescript
// Auth flows supported:
- Email/password registration
- Google OAuth
- GitHub OAuth
- Microsoft OAuth

// Session management:
- JWT tokens (15min access, 7day refresh)
- JWKS-based token verification
- Role-based access (subscriber:learner, subscriber:immersion)
```

#### 6.4.2 Core API Endpoints

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

GET    /api/v1/user/profile
PATCH  /api/v1/user/profile
GET    /api/v1/user/subscription

GET    /api/v1/vocabulary
POST   /api/v1/vocabulary/batch
PATCH  /api/v1/vocabulary/:id
DELETE /api/v1/vocabulary/:id

POST   /api/v1/sync/push          # Client → Server
GET    /api/v1/sync/pull          # Server → Client
POST   /api/v1/sync/resolve       # Conflict resolution

POST   /api/v1/nlp/segment        # PaddleNLP segmentation
POST   /api/v1/nlp/simplify       # LLM simplification
POST   /api/v1/nlp/grammar        # Grammar explanation

POST   /api/v1/cards/export       # Generate Anki deck

GET    /api/v1/analytics/progress # Learning analytics
POST   /api/v1/analytics/event    # Usage telemetry
```

#### 6.4.3 Database Schema (Core Tables)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  subscription_tier TEXT DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'
);

-- Vocabulary (user's known/learning words)
CREATE TABLE vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  pinyin TEXT,
  definition TEXT,
  hsk_level INT,
  status TEXT DEFAULT 'learning', -- 'known', 'learning', 'new'
  ease_factor FLOAT DEFAULT 2.5,
  next_review TIMESTAMPTZ,
  review_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word)
);

-- Mined cards
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  sentence TEXT,
  simplified_sentence TEXT,
  audio_url TEXT,
  screenshot_url TEXT,
  source_title TEXT,
  source_timestamp TEXT,
  exported_to_anki BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simplification cache (reduces LLM costs)
CREATE TABLE simplification_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_text TEXT NOT NULL,
  hsk_level INT NOT NULL,
  simplified_text TEXT NOT NULL,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  hit_count INT DEFAULT 1,
  UNIQUE(original_text, hsk_level)
);

-- Pre-computed show simplifications
CREATE TABLE show_simplifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id TEXT NOT NULL,
  episode INT NOT NULL,
  subtitle_index INT NOT NULL,
  original_text TEXT NOT NULL,
  hsk3_text TEXT,
  hsk4_text TEXT,
  hsk5_text TEXT,
  verified BOOLEAN DEFAULT FALSE,
  UNIQUE(show_id, episode, subtitle_index)
);

-- Analytics events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vocabulary_user_status ON vocabulary(user_id, status);
CREATE INDEX idx_vocabulary_next_review ON vocabulary(user_id, next_review);
CREATE INDEX idx_cards_user_created ON cards(user_id, created_at DESC);
CREATE INDEX idx_cache_original ON simplification_cache(original_text);
CREATE INDEX idx_analytics_user_type ON analytics_events(user_id, event_type, created_at);
```

### 6.5 Data Privacy & Sync

  * **Local First:** User vocabulary and cards stored locally (IndexedDB in browser, SQLite in desktop/mobile).
  * **Sync Protocol:** CRDT-based conflict resolution for offline-first experience.
  * **Encryption:** All user data encrypted at rest (Supabase default) and in transit (TLS 1.3).
  * **Data Residency:** EU users can request EU-only data storage (GDPR compliance).
  * **Export:** Users can export all their data (vocabulary, cards, settings) as JSON.

### 6.6 Monitoring & Observability

| Concern | Tool | Purpose |
| :--- | :--- | :--- |
| **Error tracking** | Sentry | Client + server error capture |
| **Logging** | Axiom | Structured logs, 30-day retention |
| **Metrics** | Grafana Cloud | Infrastructure + business metrics |
| **Uptime** | Better Uptime | Public status page, alerting |
| **Analytics** | PostHog | Product analytics, funnels, retention |

**Key alerts:**
- API latency P95 > 500ms
- Error rate > 1%
- Inference queue depth > 100
- Database connection pool > 80%

-----

## 7\. Platform Contingency Plan

### 7.1 Risk Assessment

| Platform | Risk Level | Failure Mode | Impact |
| :--- | :--- | :--- | :--- |
| Netflix | **HIGH** | DOM changes, anti-extension measures | Extension breaks, 2-5 days to fix |
| YouTube | **HIGH** | Anti-adblock collateral damage | Extension breaks, 1-3 days to fix |
| Browser extensions | **MEDIUM** | Manifest V3 restrictions | Feature limitations |
| LLM providers | **LOW** | API changes, pricing changes | Switch providers in 1-2 days |

### 7.2 Mitigation Strategy: Platform-Agnostic Core

```
Architecture Principle: The standalone desktop player is the CANONICAL implementation.
Browser extensions are ADAPTERS that may break. Mobile is REVIEW-ONLY.

┌─────────────────────────────────────────────────────────────────┐
│                     CORE ENGINE (Rust/WASM)                     │
│  - Segmentation    - Simplification client    - Mining logic    │
│  - OCR             - Audio processing         - Card generation │
└──────────────────────────────┬──────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│  Desktop    │        │  Browser    │        │   Mobile    │
│  (Tauri)    │        │  Extension  │        │   (RN)      │
│             │        │  (Plasmo)   │        │             │
│  RELIABLE   │        │  FRAGILE    │        │  REVIEW     │
│  Primary    │        │  Convenience│        │  ONLY       │
└─────────────┘        └─────────────┘        └─────────────┘
```

### 7.3 Breakage Response Protocol

**When Netflix/YouTube extension breaks:**

```
Hour 0:     Alert triggered (user reports or automated tests)
Hour 0-2:   Triage - identify breaking change
Hour 2-8:   Develop fix
Hour 8-12:  QA + staged rollout (10% → 50% → 100%)
Hour 12-24: Full deployment

Communication:
- In-app banner: "Netflix extension temporarily unavailable. Use desktop player."
- Email to affected users (if breaking change takes >24h)
- Status page update
```

**Standing contingency messaging:**
> "The desktop player works with any video file. Download your shows and use Kairos offline for the most reliable experience."

### 7.4 Browser Extension Survival Tactics

1. **Minimal DOM interaction:** Read-only overlay, don't modify Netflix DOM
2. **MutationObserver resilience:** Graceful degradation if expected elements missing
3. **Version detection:** Detect Netflix/YouTube version changes, alert before break
4. **Automated testing:** Playwright tests run daily against live Netflix/YouTube
5. **Rapid release pipeline:** Extension update within 4 hours of fix

### 7.5 Long-term Platform Independence

**Phase 1 (Launch):** Desktop player + browser extension parity
**Phase 2 (Month 6):** Desktop player feature-complete, extension is "convenience mode"
**Phase 3 (Month 12):** Marketing emphasizes "works with any video" - reduce Netflix dependency

**Content acquisition guidance:**
- Partner with subtitle databases (Subscene, OpenSubtitles)
- Provide "how to download legally purchased content" guides
- Build community around local video workflows

-----

## 8\. UI/UX Guidelines

### 8.1 The "Immersive" Principle

  * **Invisible UI:** By default, the interface should be invisible. Subtitles only look different when hovered.
  * **Smart Hiding:** "Known words" (based on user's vocabulary) should NOT be highlighted or underlined, reducing visual clutter.
  * **Keyboard-first:** All common actions accessible via keyboard shortcuts (spacebar pause, 'S' simplify, 'M' mine).

### 8.2 The "Simplification" Toggle

  * A physical toggle switch on the video player bar labeled "原文 / 简化" (Original / Simplified).
  * When "Simplified" is active, the subtitle font changes slightly (e.g., to a rounded font like "ZCOOL XiaoWei") to visually indicate AI-modified text.
  * HSK level selector (3/4/5/6) appears when simplified mode is active.

### 8.3 Accessibility

  * **Keyboard navigation:** Full tab navigation through all UI elements
  * **Screen reader support:** ARIA labels on all interactive elements
  * **Color contrast:** WCAG AA compliance for all text
  * **Colorblind modes:** Alternative color schemes for pitch visualization
  * **Font size controls:** User-adjustable subtitle size (independent of video player)

### 8.4 Platform-Specific UX

| Platform | Primary Use | UX Focus |
| :--- | :--- | :--- |
| **Desktop App** | Focused study sessions | Full feature set, keyboard shortcuts, multi-monitor |
| **Browser Extension** | Casual watching | Minimal UI, quick mining, "get out of the way" |
| **Mobile App** | Review on the go | Card review, progress checking, no video playback |

-----

## 9\. Roadmap & Phasing

### Phase 1: Foundation (Months 1–3)

**Goal:** Core product with working Chinese segmentation and reliable infrastructure.

| Deliverable | Priority | Notes |
| :--- | :--- | :--- |
| Chrome/Firefox extension | P0 | Netflix + YouTube support |
| Tauri desktop player | P0 | Local video files, primary platform |
| PaddleNLP segmentation (cloud) | P0 | Core differentiator |
| Basic dictionary lookup | P0 | CC-CEDICT integration |
| One-click Anki export | P0 | AnkiConnect + CSV fallback |
| User accounts + sync | P1 | Supabase auth |
| Backend API (core endpoints) | P0 | Vocabulary, cards, sync |

**Milestones:**
- Week 4: Alpha (internal testing)
- Week 8: Closed beta (500 users)
- Week 12: Open beta launch

**Pricing:** Free (beta)

### Phase 2: Differentiation + Mobile (Months 4–6)

**Goal:** AI features that competitors don't have, plus mobile presence.

| Deliverable | Priority | Notes |
| :--- | :--- | :--- |
| AI Simplification Engine | P0 | Qwen2.5-7B, HSK 3/4/5/6 levels |
| Pre-computed simplification packs | P1 | Top 20 C-Dramas |
| Pitch visualization (Shadowing) | P0 | TensorFlow.js SPICE |
| Grammar explainer tooltips | P1 | 500+ patterns database |
| **Mobile app (iOS + Android)** | P0 | Card review, progress, vocabulary |
| Hard-sub OCR (PaddleOCR) | P1 | Auto-detect subtitle region |
| Payment integration | P0 | Stripe subscriptions |

**Milestones:**
- Week 16: AI features live (Learner tier)
- Week 20: Mobile app beta (TestFlight/Play Store)
- Week 24: Full launch (paid tiers)

**Pricing:** Launch subscription tiers
- Free: Core features, 5 cards/day
- Learner: $8/mo - Full features, 500 AI sentences/mo
- Immersion: $12/mo - Unlimited AI, mobile app

### Phase 3: Community & Growth (Months 7–9)

**Goal:** Network effects and viral mechanics.

| Deliverable | Priority | Notes |
| :--- | :--- | :--- |
| Shared vocabulary decks | P0 | Community-created show decks |
| "Classroom Mode" for tutors | P1 | Assign shows, track student progress |
| Pre-simplified packs (50+ shows) | P1 | Reduce real-time inference |
| Leaderboards + social features | P2 | Streak sharing, friend comparisons |
| API for third-party integrations | P2 | Pleco, other SRS apps |
| Affiliate/referral program | P1 | 20% rev share for referrals |

**Milestones:**
- Week 28: Shared decks v1
- Week 32: Classroom Mode beta
- Week 36: 10,000 paid subscribers target

### Phase 4: Scale & Expand (Months 10–12)

**Goal:** Operational excellence and market expansion.

| Deliverable | Priority | Notes |
| :--- | :--- | :--- |
| Japanese language support | P1 | Leverage existing architecture |
| Advanced analytics dashboard | P2 | Learning curves, predictions |
| Enterprise/institutional tier | P2 | University site licenses |
| Native Windows/Mac apps | P1 | Beyond Tauri if needed |
| Offline mode (full) | P1 | Downloaded content + cached AI |

-----

## 10\. Success Metrics (KPIs)

### 10.1 Product Metrics

| Metric | Target | Measurement |
| :--- | :--- | :--- |
| **Mining Velocity** | < 3 seconds per card | Time from click to card created |
| **Parsing Accuracy** | < 1 error per 1,000 sentences | User "incorrect segmentation" reports |
| **Simplification Quality** | > 4.0/5 rating | In-app feedback on simplified sentences |
| **OCR Accuracy** | > 98% character accuracy | Automated testing against known subtitles |
| **Pitch Detection Accuracy** | > 85% tone match | Comparison against native speaker baseline |

### 10.2 Business Metrics

| Metric | Month 6 Target | Month 12 Target |
| :--- | :--- | :--- |
| **Registered users** | 10,000 | 50,000 |
| **Paid subscribers** | 1,000 | 10,000 |
| **MRR** | $9,000 | $100,000 |
| **Free → Paid conversion** | 5% | 8% |
| **Monthly churn** | < 8% | < 5% |
| **NPS** | > 40 | > 50 |

### 10.3 Engagement Metrics

| Metric | Target | Why It Matters |
| :--- | :--- | :--- |
| **DAU/MAU** | > 30% | Indicates habit formation |
| **Sessions per week** | > 3 | Correlates with learning outcomes |
| **Cards mined per session** | > 10 | Shows active learning |
| **Simplification toggle usage** | > 40% of sessions | Validates AI feature value |
| **Mobile app DAU** | > 20% of total DAU | Cross-platform stickiness |

### 10.4 Infrastructure Metrics

| Metric | Target | Alert Threshold |
| :--- | :--- | :--- |
| **API latency (P95)** | < 200ms | > 500ms |
| **Inference latency (P95)** | < 1.5s | > 3s |
| **Error rate** | < 0.5% | > 1% |
| **Uptime** | 99.9% | < 99.5% |
| **Sync conflict rate** | < 0.1% | > 1% |

-----

## 11\. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Netflix/YouTube breaks extension | High | High | Desktop player as primary; rapid response protocol |
| LLM inference costs exceed projections | Medium | High | Aggressive caching; pre-computed packs; model distillation |
| Migaku copies features | High | Medium | Stay 12-18 months ahead; community moat |
| PaddleNLP/OCR maintenance abandoned | Low | High | Fork and maintain; evaluate alternatives (LAC, HanLP) |
| User data breach | Low | Critical | SOC 2 compliance; regular audits; encryption |
| App store rejection (mobile) | Medium | Medium | Comply with guidelines; no streaming integration in app |
| Slow user acquisition | Medium | High | Diversify channels; increase content marketing |

-----

## 12\. Open Questions

1. **Pricing sensitivity:** Is $8/mo the right price point, or should we test $6 and $10?
2. **Japanese priority:** Should Japanese support be Phase 3 instead of Phase 4?
3. **Offline AI:** Is there demand for on-device inference (larger app, works offline)?
4. **B2B opportunity:** Should we pursue university/language school partnerships earlier?
5. **Content partnerships:** Can we partner with streaming services directly for official subtitle access?

-----

## Appendix A: Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Advantage |
| :--- | :--- | :--- | :--- |
| **Migaku** | Established brand, polyglot support | Broken Chinese parsing, subscription fatigue, complex setup | Chinese-first, AI simplification |
| **Language Reactor** | Free, easy setup | Abandonware, poor Chinese support, no AI | Active development, AI features |
| **Pleco** | Best dictionary, trusted brand | No immersion features, mobile only | Full immersion workflow |
| **Du Chinese** | Good graded content | Limited content library, no native content | Works with any content |
| **Anki + Yomitan** | Free, customizable | 3+ hour setup, technical users only | Zero-config, integrated experience |

-----

## Appendix B: Technical Glossary

| Term | Definition |
| :--- | :--- |
| **HSK** | Hanyu Shuiping Kaoshi - Chinese proficiency test with 6 levels |
| **i+1** | Krashen's input hypothesis - learning occurs when input is slightly above current level |
| **Segmentation** | Breaking Chinese text into individual words (no spaces in Chinese) |
| **SRS** | Spaced Repetition System - algorithm for optimal review timing |
| **Mining** | Extracting vocabulary cards from native content |
| **Hard-subs** | Subtitles burned into video (cannot be toggled off) |
| **OCR** | Optical Character Recognition - extracting text from images |
| **VAD** | Voice Activity Detection - identifying speech in audio |
| **CRDT** | Conflict-free Replicated Data Type - for offline-first sync |

-----

## Appendix C: BMAD Analysis

### C.1 Business Model Deep-Dive

#### C.1.1 Financial Projections (24-Month)

```
Revenue Model: SaaS Subscription

Month     Users    Paid    Conv%   MRR        ARR         Burn      Runway
──────────────────────────────────────────────────────────────────────────
M1        500      0       0%      $0         $0          $15K      18mo
M2        2,000    0       0%      $0         $0          $15K      17mo
M3        5,000    250     5%      $2,250     $27K        $18K      15mo
M4        8,000    480     6%      $4,320     $52K        $20K      14mo
M5        12,000   780     6.5%    $7,020     $84K        $22K      13mo
M6        18,000   1,260   7%      $11,340    $136K       $25K      12mo
──────────────────────────────────────────────────────────────────────────
M7        25,000   1,875   7.5%    $16,875    $203K       $28K      12mo
M8        32,000   2,560   8%      $23,040    $276K       $30K      13mo
M9        40,000   3,400   8.5%    $30,600    $367K       $32K      14mo
M10       48,000   4,320   9%      $38,880    $467K       $35K      15mo
M11       55,000   5,225   9.5%    $47,025    $564K       $38K      16mo
M12       65,000   6,500   10%     $58,500    $702K       $40K      18mo
──────────────────────────────────────────────────────────────────────────
M18       120,000  14,400  12%     $129,600   $1.56M      $55K      24mo+
M24       200,000  28,000  14%     $252,000   $3.02M      $75K      36mo+

Assumptions:
- Average Revenue Per User (ARPU): $9/mo (blend of $8 Learner + $12 Immersion)
- Monthly churn: 6% (M1-6), 5% (M7-12), 4% (M13+)
- Viral coefficient: 0.3 (each user brings 0.3 new users)
- Paid marketing spend: $0 (M1-3), $5K/mo (M4-6), $15K/mo (M7+)
```

#### C.1.2 Cost Structure

```
Monthly Operating Costs (at scale: 10K paid users)

INFRASTRUCTURE                          MONTHLY COST
├── Supabase (Pro)                      $25
├── Cloudflare Workers (Pro)            $20
├── Upstash Redis                       $50
├── Modal (GPU inference)               $800
├── Vercel (marketing site)             $20
├── Domain + SSL                        $5
└── Subtotal                            $920

THIRD-PARTY SERVICES
├── Sentry (errors)                     $26
├── PostHog (analytics)                 $0 (free tier)
├── Axiom (logging)                     $25
├── Better Uptime                       $20
├── Stripe fees (2.9% + $0.30)          ~$2,700
└── Subtotal                            $2,771

TEAM (assuming bootstrapped start)
├── Founder salary                      $0 (equity only, M1-6)
├── Contract developer (part-time)      $4,000
├── Design contractor                   $1,500
└── Subtotal                            $5,500

MARKETING
├── Content creation                    $500
├── YouTube sponsorships                $2,000
├── Community management                $500
└── Subtotal                            $3,000

TOTAL MONTHLY BURN                      ~$12,200 (early stage)
                                        ~$40,000 (at 10K users)
```

#### C.1.3 Funding Strategy

| Stage | Amount | Use of Funds | Milestone to Raise |
| :--- | :--- | :--- | :--- |
| **Bootstrap** | $50K (savings) | MVP development, beta launch | - |
| **Pre-seed** | $150K (angels) | 6-month runway, first hires | 1,000 paid users, $9K MRR |
| **Seed** | $750K-1M | Scale team to 5, aggressive growth | 5,000 paid users, $50K MRR |
| **Series A** | $3-5M | International expansion, Japanese launch | 25K paid users, $250K MRR |

**Ideal Investor Profile:**
- EdTech or language learning experience
- Consumer SaaS background
- Connections to Chinese/Asian markets
- Patient capital (education is slow-burn)

#### C.1.4 Team Composition

**Phase 1 (Bootstrap): 1-2 people**
```
Founder/CEO
├── Product vision, architecture
├── Core development (Rust/TypeScript)
├── Community building
└── Everything else

Contractor: UI/UX Designer ($50/hr, 20hr/mo)
```

**Phase 2 (Pre-seed): 3-4 people**
```
Founder/CEO
├── Product, fundraising, strategy

Full-stack Engineer
├── Browser extension, desktop app
├── API development

ML/AI Engineer (part-time → full-time)
├── Model fine-tuning
├── Inference optimization
├── PaddleNLP/OCR integration

Designer (contract → part-time)
├── UI/UX, brand identity
```

**Phase 3 (Seed): 6-8 people**
```
Founder/CEO
├── Strategy, fundraising, partnerships

CTO/Lead Engineer
├── Architecture, hiring, technical vision

2x Full-stack Engineers
├── Feature development, platform expansion

ML Engineer
├── Model optimization, new AI features

Designer
├── Full-time, product + marketing

Community/Marketing Lead
├── Content, partnerships, support

Part-time: Customer support, QA
```

#### C.1.5 Key Hires & Timing

| Role | When | Why Critical | Salary Range |
| :--- | :--- | :--- | :--- |
| ML Engineer | Month 3 | AI features are core differentiator | $120-180K |
| Mobile Developer | Month 4 | Phase 2 requires iOS/Android | $100-150K |
| Community Lead | Month 5 | GTM requires dedicated attention | $60-90K |
| DevOps/SRE | Month 8 | Scale reliability | $130-170K |

-----

### C.2 Market Analysis Deep-Dive

#### C.2.1 Market Sizing (TAM/SAM/SOM)

```
TOTAL ADDRESSABLE MARKET (TAM): Global Language Learning
├── Market size (2024): $67B
├── Growth rate: 18% CAGR
├── Online segment: $25B
└── Relevant: Language learning software

SERVICEABLE ADDRESSABLE MARKET (SAM): Chinese Learners + Immersion Tools
├── Chinese learners worldwide: ~100M
├── Serious learners (HSK 3+): ~15M
├── Using digital tools: ~10M
├── Willing to pay for software: ~3M
├── Average spend: $100/year
└── SAM: $300M/year

SERVICEABLE OBTAINABLE MARKET (SOM): Year 1-3 Realistic Target
├── Immersion-method learners: ~500K
├── Reachable via our channels: ~200K
├── Conversion to trial: 10% = 20K
├── Conversion to paid: 30% = 6K
├── Year 1 SOM: 6,000 users × $100 = $600K
├── Year 3 SOM (5% of SAM willing-to-pay): 150K users = $15M
```

#### C.2.2 Market Validation Approach

**Before Building (Weeks -8 to -4):**

| Validation | Method | Success Criteria |
| :--- | :--- | :--- |
| Problem validation | 20 user interviews (r/ChineseLanguage, Discord) | 15+ confirm segmentation pain point |
| Solution validation | Clickable prototype, 5 user tests | 4+ say "I would pay for this" |
| Pricing validation | Survey (n=100) with price anchoring | >50% accept $8/mo, >30% accept $12/mo |
| Channel validation | Post in 3 communities, measure engagement | >100 upvotes, >50 comments |

**During Beta (Months 1-3):**

| Metric | Method | Target |
| :--- | :--- | :--- |
| Activation rate | % completing first mining session | >60% |
| Retention | Week 1 return rate | >40% |
| NPS | In-app survey at Day 7 | >40 |
| Willingness to pay | "Would you pay $8/mo?" prompt | >30% "Yes" |

**User Interview Script (Problem Discovery):**

```markdown
1. Tell me about your Chinese learning journey. What level are you at?
2. What content do you use for immersion? (Netflix, YouTube, etc.)
3. Walk me through the last time you tried to watch something in Chinese.
4. What tools do you currently use? (Migaku, LR, Anki, etc.)
5. What's the most frustrating part of your current workflow?
6. [If they mention segmentation] Can you show me an example?
7. How much time do you spend on immersion per week?
8. Have you ever paid for language learning tools? How much?
9. If a tool could do [X], how valuable would that be to you?
10. Is there anything else I should know about your learning process?
```

#### C.2.3 Competitive Intelligence

**Migaku Deep-Dive:**

| Aspect | Details | Our Counter |
| :--- | :--- | :--- |
| **Pricing** | $10/mo or $96/year | Match on Immersion tier, undercut on Learner |
| **Strengths** | Brand recognition, multi-language, Refold partnership | Focus on Chinese-only excellence |
| **Weaknesses** | Chinese segmentation broken, complex UI, no AI | Our core differentiators |
| **User complaints** | "Setup takes forever", "Chinese doesn't work", "Too expensive" | Zero-config, Chinese-first, value pricing |
| **Churn reasons** | Feature bloat, technical issues, subscription fatigue | Simplicity, reliability, fair pricing |

**Language Reactor Deep-Dive:**

| Aspect | Details | Our Counter |
| :--- | :--- | :--- |
| **Pricing** | Free + $5/mo Pro | Free tier competitive, Pro significantly better |
| **Strengths** | Easy onboarding, familiar UI, free tier | Match ease, exceed features |
| **Weaknesses** | Abandonware (no updates 2+ years), no Chinese optimization | Active development, Chinese-first |
| **User complaints** | "Broken on new Netflix", "Chinese parsing useless" | Rapid updates, PaddleNLP |

#### C.2.4 User Research Repository

**Persona Deep-Dive: Liam (Plateaued Intermediate)**

```yaml
Demographics:
  Age: 25-35
  Location: US, UK, Australia
  Occupation: Knowledge worker, student
  Income: $40-80K

Chinese Journey:
  Started: 2-4 years ago
  Current level: HSK 4 (self-assessed)
  Goal: Conversational fluency for travel/work
  Weekly study time: 5-10 hours

Current Stack:
  - Anki (daily, 30min)
  - HelloChinese (completed)
  - Tried Migaku (quit: too complex)
  - Tried Language Reactor (quit: Chinese broken)
  - YouTube: Comprehensible Chinese, Mandarin Corner

Pain Points (verbatim quotes):
  - "I know 2000 characters but I can't watch a drama without pausing constantly"
  - "Setting up sentence mining took me a whole weekend"
  - "The segmentation is always wrong on names"
  - "I want to watch The Untamed but it's too hard"

Desired Outcome:
  - Watch C-dramas with understanding
  - Build vocabulary naturally
  - Feel progress, not frustration

Willingness to Pay:
  - Currently pays: $0-5/mo on tools
  - Would pay: Up to $15/mo for "something that actually works"

Channels:
  - Reddit: r/ChineseLanguage (daily)
  - Discord: Refold, Heavenly Path
  - YouTube: Language learning content
```

**Persona Deep-Dive: Sarah (Efficient Professional)**

```yaml
Demographics:
  Age: 30-45
  Location: US, EU, Singapore
  Occupation: Tech professional, consultant, executive
  Income: $100-200K

Chinese Journey:
  Started: 1-3 years ago
  Current level: HSK 3-4
  Goal: Business proficiency, cultural fluency
  Weekly study time: 3-5 hours (time-constrained)

Current Stack:
  - Paid tutor on iTalki ($40/hr, 2x/week)
  - Pleco (dictionary)
  - Tried various apps (abandoned)
  - Occasional YouTube/Netflix

Pain Points (verbatim quotes):
  - "I don't have time to configure tools"
  - "I just want to click and start learning"
  - "My tutor says I should watch more content but it's too hard"
  - "I'll pay for something that saves me time"

Desired Outcome:
  - Efficient learning (maximize output per hour)
  - Seamless workflow (no setup friction)
  - Measurable progress (data-driven)

Willingness to Pay:
  - Currently pays: $200+/mo on learning
  - Would pay: $20+/mo for excellent tool

Channels:
  - LinkedIn
  - Hacker News
  - Tech podcasts
  - Word of mouth from other learners
```

-----

### C.3 Architecture Expansion

#### C.3.1 Security Architecture

```
SECURITY LAYERS

┌─────────────────────────────────────────────────────────────────┐
│                        EDGE LAYER                                │
│  Cloudflare: DDoS protection, WAF, bot detection, rate limiting │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────┐
│                      APPLICATION LAYER                           │
│  - Input validation (zod schemas)                                │
│  - Output encoding (XSS prevention)                              │
│  - CSRF tokens (SameSite cookies)                               │
│  - Content Security Policy headers                               │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────┐
│                    AUTHENTICATION LAYER                          │
│  - JWT with short expiry (15min access, 7day refresh)           │
│  - Secure cookie storage (HttpOnly, Secure, SameSite)           │
│  - OAuth 2.0 + PKCE for third-party auth                        │
│  - Rate limiting on auth endpoints (5 attempts/min)             │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────┐
│                    AUTHORIZATION LAYER                           │
│  - Row-Level Security (RLS) in PostgreSQL                       │
│  - Subscription tier validation middleware                       │
│  - Resource ownership verification                               │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────┐
│                        DATA LAYER                                │
│  - Encryption at rest (AES-256, Supabase default)               │
│  - Encryption in transit (TLS 1.3)                              │
│  - PII minimization (hash emails for analytics)                 │
│  - Automated backups (daily, 30-day retention)                  │
└─────────────────────────────────────────────────────────────────┘
```

**Security Checklist (Pre-Launch):**

- [ ] OWASP Top 10 audit
- [ ] Dependency vulnerability scan (npm audit, cargo audit)
- [ ] Penetration testing (basic, self or contractor)
- [ ] Privacy policy and ToS reviewed by lawyer
- [ ] GDPR compliance verification
- [ ] Data deletion workflow tested
- [ ] Incident response plan documented
- [ ] Security headers verified (securityheaders.com)

#### C.3.2 CI/CD Pipeline

```yaml
# .github/workflows/main.yml (conceptual)

TRIGGER: Push to main, PR to main

PIPELINE STAGES:

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    LINT     │────▶│    TEST     │────▶│    BUILD    │
│  (2 min)    │     │  (5 min)    │     │  (3 min)    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    ▼                          ▼                          ▼
            ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
            │  EXTENSION  │            │   DESKTOP   │            │   MOBILE    │
            │   BUILD     │            │    BUILD    │            │   BUILD     │
            │  (Chrome,   │            │  (Win/Mac/  │            │ (iOS/And)   │
            │   Firefox)  │            │   Linux)    │            │             │
            └──────┬──────┘            └──────┬──────┘            └──────┬──────┘
                   │                          │                          │
                   ▼                          ▼                          ▼
            ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
            │   E2E TEST  │            │   E2E TEST  │            │   E2E TEST  │
            │ (Playwright)│            │  (Tauri)    │            │  (Detox)    │
            └──────┬──────┘            └──────┬──────┘            └──────┬──────┘
                   │                          │                          │
                   └──────────────────────────┼──────────────────────────┘
                                              ▼
                                      ┌─────────────┐
                                      │   DEPLOY    │
                                      │  (Staging)  │
                                      └──────┬──────┘
                                              │
                                      ┌───────▼───────┐
                                      │  SMOKE TEST   │
                                      │   (Staging)   │
                                      └───────┬───────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                      [Manual QA]    [Canary Deploy]   [Full Deploy]
                                         (10%)           (100%)

ENVIRONMENTS:
- Development: Local, hot reload
- Staging: staging.kairos.app (auto-deploy from main)
- Production: app.kairos.app (manual promotion from staging)
```

**Deployment Strategy:**

| Component | Deployment Method | Rollback Time |
| :--- | :--- | :--- |
| API | Cloudflare Workers (instant) | <1 min |
| Web app | Vercel (instant) | <1 min |
| Desktop app | GitHub Releases + auto-update | 1 hour (user-initiated) |
| Browser extension | Chrome/Firefox stores | 1-3 days (store review) |
| Mobile app | App Store/Play Store | 1-7 days (store review) |

#### C.3.3 Testing Strategy

```
TEST PYRAMID

                    ┌───────────┐
                    │    E2E    │  5%   - Critical user journeys
                    │  (Slow)   │        - Real browser/device
                    ├───────────┤
                    │Integration│ 20%   - API contract tests
                    │  (Medium) │        - Database integration
                    │           │        - External service mocks
                    ├───────────┤
                    │   Unit    │ 75%   - Business logic
                    │  (Fast)   │        - Pure functions
                    │           │        - Component rendering
                    └───────────┘

COVERAGE TARGETS:
- Unit tests: >80% line coverage
- Integration tests: All API endpoints
- E2E tests: 10 critical paths
```

**Critical E2E Test Scenarios:**

1. **New user onboarding**: Install extension → Create account → First mining session
2. **Subscription flow**: Free user → Select tier → Stripe checkout → Access premium
3. **Mining workflow**: Watch video → Click word → Generate card → Export to Anki
4. **AI simplification**: Enable simplified mode → Verify correct HSK level output
5. **Cross-device sync**: Mine on desktop → Verify appears on mobile
6. **Offline resilience**: Go offline → Mine cards → Come online → Sync
7. **Extension recovery**: Netflix DOM change → Graceful degradation message
8. **Account management**: Change password → Delete account → Verify data removal

#### C.3.4 Performance Budgets

| Metric | Budget | Measurement |
| :--- | :--- | :--- |
| **Extension load time** | <500ms | Time from page load to overlay ready |
| **First contentful paint (marketing)** | <1.5s | Lighthouse |
| **API response (P95)** | <200ms | Datadog/Grafana |
| **Segmentation latency** | <100ms (WASM), <300ms (cloud) | In-app telemetry |
| **OCR latency** | <500ms | In-app telemetry |
| **LLM simplification** | <1.5s (first), <500ms (cached) | In-app telemetry |
| **Extension bundle size** | <500KB (gzipped) | Build output |
| **Desktop app size** | <50MB (installer) | Build output |
| **Mobile app size** | <30MB | App store listing |

-----

### C.4 Development Process

#### C.4.1 Sprint Structure

```
SPRINT CADENCE: 2 weeks

Week 1:
├── Monday: Sprint planning (2hr)
│   ├── Review backlog
│   ├── Estimate stories (t-shirt sizing)
│   └── Commit to sprint goal
├── Tue-Thu: Development
│   ├── Daily async standup (Slack)
│   └── Pair programming sessions
└── Friday: Mid-sprint check-in (30min)

Week 2:
├── Mon-Wed: Development + QA
├── Thursday:
│   ├── Code freeze (noon)
│   ├── QA verification
│   └── Staging deployment
└── Friday:
    ├── Sprint review/demo (1hr)
    ├── Retrospective (1hr)
    └── Production deployment

CEREMONIES:
- Planning: Define what we build
- Daily standup: Async, blockers only
- Review: Demo to stakeholders
- Retro: What to improve
```

#### C.4.2 Story Template

```markdown
## User Story

**As a** [persona],
**I want to** [action],
**So that** [benefit].

## Acceptance Criteria

- [ ] Given [context], when [action], then [outcome]
- [ ] Given [context], when [action], then [outcome]
- [ ] Edge case: [description]

## Technical Notes

- Affected components: [list]
- API changes: [yes/no, details]
- Database changes: [yes/no, migration needed]
- Dependencies: [blocked by X, blocks Y]

## Design

- Figma link: [url]
- Screenshot: [attached]

## Definition of Done

- [ ] Code complete and self-reviewed
- [ ] Unit tests written (>80% coverage for new code)
- [ ] Integration tests updated
- [ ] Documentation updated
- [ ] PR approved by 1+ reviewer
- [ ] QA verified on staging
- [ ] No P0/P1 bugs
- [ ] Analytics events added
- [ ] Feature flag configured (if applicable)
```

#### C.4.3 Code Quality Standards

```typescript
// CODING STANDARDS

// 1. TypeScript strict mode (always)
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// 2. Error handling pattern
// BAD:
try {
  await riskyOperation();
} catch (e) {
  console.log(e); // Lost error
}

// GOOD:
import { Result, ok, err } from 'neverthrow';

async function riskyOperation(): Promise<Result<Data, AppError>> {
  try {
    const data = await fetchData();
    return ok(data);
  } catch (e) {
    logger.error('Operation failed', { error: e });
    return err(new AppError('FETCH_FAILED', e));
  }
}

// 3. Component structure (React)
// - One component per file
// - Props interface defined and exported
// - Hooks extracted to custom hooks when >10 lines
// - No inline styles (use Tailwind or CSS modules)

// 4. API response format (consistent)
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    pagination?: { page: number; limit: number; total: number };
  };
}

// 5. Commit message format (Conventional Commits)
// type(scope): description
//
// feat(mining): add batch export to Anki
// fix(segmentation): handle proper nouns correctly
// docs(readme): update installation instructions
// refactor(api): extract auth middleware
// test(e2e): add subscription flow test
```

#### C.4.4 Technical Debt Management

```markdown
## Tech Debt Tracking

CATEGORIES:
- 🔴 Critical: Blocks features or causes outages
- 🟠 High: Slows development significantly
- 🟡 Medium: Annoying but workable
- 🟢 Low: Nice to fix someday

PROCESS:
1. Add tech debt items to backlog with [DEBT] prefix
2. Allocate 20% of each sprint to debt reduction
3. Review debt backlog monthly
4. Escalate 🔴 items immediately

CURRENT DEBT REGISTER:
| ID | Category | Description | Impact | Effort |
|----|----------|-------------|--------|--------|
| TD-001 | 🟠 | No retry logic on LLM calls | User errors | 2 days |
| TD-002 | 🟡 | Inconsistent error messages | Confusion | 1 day |
| TD-003 | 🟢 | Legacy CSS in components | Tech debt | 3 days |
```

#### C.4.5 On-Call & Incident Response

```
ON-CALL ROTATION (post-launch)

Schedule: Weekly rotation
Hours: 9am-9pm user timezone (initially)
Escalation: Slack → Phone after 15min

SEVERITY LEVELS:

SEV-1 (Critical): Service down, data loss
├── Response: 15 min
├── Resolution: 4 hours
├── Postmortem: Required
└── Example: API returning 500s for all users

SEV-2 (High): Major feature broken
├── Response: 1 hour
├── Resolution: 24 hours
├── Postmortem: Required
└── Example: Mining not working, AI simplification broken

SEV-3 (Medium): Minor feature broken
├── Response: 4 hours
├── Resolution: 72 hours
├── Postmortem: Optional
└── Example: Specific browser version issue

SEV-4 (Low): Cosmetic/minor issue
├── Response: Next business day
├── Resolution: Next sprint
├── Postmortem: No
└── Example: Typo in UI, minor alignment issue

INCIDENT TEMPLATE:
1. Detect: How was it found?
2. Triage: What's the severity?
3. Communicate: Status page update, user notification
4. Mitigate: Stop the bleeding
5. Resolve: Fix the root cause
6. Postmortem: What do we learn?
```

-----

### C.5 Launch Checklist

#### C.5.1 Pre-Launch (T-2 weeks)

**Product:**
- [ ] All P0 features complete
- [ ] No P0/P1 bugs in backlog
- [ ] Performance budgets met
- [ ] Accessibility audit passed
- [ ] Localization complete (EN, ZH-Hans)

**Infrastructure:**
- [ ] Production environment provisioned
- [ ] SSL certificates configured
- [ ] CDN configured and tested
- [ ] Database backups verified
- [ ] Monitoring dashboards live
- [ ] Alerting configured and tested
- [ ] Load testing completed (2x expected traffic)

**Security:**
- [ ] Security audit completed
- [ ] Penetration test passed
- [ ] Privacy policy published
- [ ] Terms of Service published
- [ ] GDPR compliance verified
- [ ] Data deletion workflow tested

**Legal:**
- [ ] Company incorporated
- [ ] Trademarks filed (if applicable)
- [ ] Stripe account verified
- [ ] App store developer accounts active

#### C.5.2 Launch Day (T-0)

**Morning:**
- [ ] Final staging verification
- [ ] Production deployment
- [ ] Smoke tests passed
- [ ] Team on standby (all hands)

**Go-Live:**
- [ ] Feature flags enabled
- [ ] Status page: "Operational"
- [ ] Social media announcements
- [ ] Email to waitlist
- [ ] Reddit/Discord posts
- [ ] Product Hunt submission (if coordinated)

**Monitoring:**
- [ ] Error rate dashboard open
- [ ] Real-time user count visible
- [ ] Support queue monitored
- [ ] Social media monitored

#### C.5.3 Post-Launch (T+1 to T+7)

**Day 1:**
- [ ] Review error logs
- [ ] Respond to all support tickets
- [ ] Fix any critical bugs
- [ ] Thank early users publicly

**Day 2-3:**
- [ ] Analyze activation funnel
- [ ] Interview 5 new users
- [ ] Prioritize feedback

**Week 1:**
- [ ] Publish "Week 1" retrospective
- [ ] Plan first post-launch sprint
- [ ] Review metrics vs. targets
