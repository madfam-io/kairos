# Product Requirements Document (PRD): "Kairos" – The Intelligent Chinese Immersion Engine

| **Document Name** | Kairos PRD: Next-Gen Chinese Immersion |
| :--- | :--- |
| **Version** | 2.0 |
| **Status** | Planning Phase |
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
2.  **The "i+1" Generator (AI Simplification):** Using **open-source LLMs** (Qwen2.5, DeepSeek) to rewrite complex C-Drama subtitles into HSK 3/4/5 vocabulary while retaining the original meaning. Self-hosted inference ensures sustainable unit economics.
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
| Subtitle simplification | **Qwen2.5-7B-Instruct** | Best Chinese performance at 7B scale, Apache 2.0 license |
| Grammar explanation | **Qwen2.5-14B-Instruct** | More nuanced for linguistic explanations |
| Fallback/complex | **DeepSeek-V2-Lite** | Cost-efficient MoE architecture for edge cases |

**Inference cost estimate (self-hosted on RunPod/Modal):**
- Qwen2.5-7B: ~$0.10 per 1M tokens (vs $3+ for Claude Haiku)
- 500 sentences/user/month ≈ 50K tokens ≈ $0.005/user/month
- At 10K users: $50/month for simplification inference (vs $500+ with proprietary APIs)

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
| **Auth** | Supabase Auth | Managed auth with OAuth, JWT, row-level security |
| **Database** | Supabase PostgreSQL | Managed Postgres with realtime subscriptions |
| **Cache** | Upstash Redis | Serverless Redis, pay-per-request |
| **Segmentation** | PaddleNLP (Modal serverless) | Best-in-class Chinese NER |
| **OCR** | PaddleOCR (ONNX in-browser + Modal fallback) | Superior Chinese character recognition |
| **Pitch Detection** | TensorFlow.js (SPICE) | Client-side pitch extraction |
| **LLM Inference** | Modal (Qwen2.5, DeepSeek) | Serverless GPU, pay-per-second, auto-scaling |

### 6.3 Inference Infrastructure (Open Source Models)

**Primary compute provider: Modal**

| Model | GPU | Cost/hr | Tokens/sec | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| Qwen2.5-7B-Instruct | A10G | $0.76 | ~150 | Subtitle simplification (primary) |
| Qwen2.5-14B-Instruct | A100-40G | $2.78 | ~100 | Grammar explanations |
| DeepSeek-V2-Lite | A10G | $0.76 | ~120 | Complex/fallback cases |

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

#### 6.4.1 Auth Service (Supabase)

```typescript
// Auth flows supported:
- Email/password registration
- Google OAuth
- Apple OAuth (required for iOS)
- Magic link (passwordless)

// Session management:
- JWT tokens (15min access, 7day refresh)
- Row-level security policies in PostgreSQL
- Device tracking for "logged in devices" UI
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
