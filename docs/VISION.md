# Kairos Vision

> **"The Chinese-First Comprehension Engine"**

## The Opportunity

The current market for immersion tools is polarized:

- **Migaku/Refold**: Cater to hardcore power users but suffer from technical friction (legacy segmentation breaks on Chinese)
- **Language Reactor**: Accessible but technically stagnant ("abandonware") with poor Chinese parsing

**Kairos** competes on value, not price. We offer definitively better Chinese learning.

## Core Differentiators

### 1. Chinese-First Architecture

Abandoning generic "polyglot" libraries for **PaddleNLP** and **PaddleOCR**, ensuring 99% accuracy in Chinese segmentation and hard-sub recognition (solving the #1 user complaint).

### 2. The "i+1" Generator (AI Simplification)

Using open-source LLMs (Qwen3) to rewrite complex C-Drama subtitles into HSK 3/4/5 vocabulary while retaining the original meaning. Self-hosted inference ensures sustainable unit economics.

**Example:**
- *Original:* "陛下，此事万万不可鲁莽行事" (Your Majesty, this matter absolutely cannot be handled recklessly)
- *Simplified (HSK 3):* "皇上，这件事不能太快做" (The Emperor, this matter cannot be done too fast)

### 3. Visual Tone Feedback

A "Shadowing Mode" that visualizes the user's pitch contour overlaying the native speaker's audio in real-time, addressing the specific needs of tonal language learners.

### 4. Platform Resilience

Standalone local video player as the reliable core, with browser extensions as convenience layers that can break without killing the product.

### 5. Mobile-First Review

Companion app for reviewing mined content, ensuring learning continues away from the desktop.

## Target Users

| Persona | Profile | Pain Point | Our Solution |
|---------|---------|------------|--------------|
| **Plateaued Intermediate** | HSK 4 level, stuck | "I try to watch dramas but have to pause every 2 seconds" | AI Simplification: Toggle "HSK 4 Mode" |
| **Efficient Professional** | Tech-savvy, busy | "Setting up Anki + Yomitan takes 3 hours" | One-Click Mining: Instant export |

## Sustainable Moat (Long-term)

1. **Community-generated content**: Simplified subtitle packs for 100+ popular shows
2. **Personalized difficulty**: User vocabulary data enables personalized difficulty scoring
3. **Network effects**: Shared decks and classroom features

## Technical Philosophy

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

## Success Vision

**Month 12 targets:**
- 50,000 registered users
- 10,000 paid subscribers
- $100,000 MRR
- NPS > 50

**Month 24 targets:**
- 200,000 registered users
- 28,000 paid subscribers
- $252,000 MRR
- Japanese language support launched

## Related Documents

- [Roadmap](./ROADMAP.md) - Phased development timeline
- [Architecture](./ARCHITECTURE.md) - Technical implementation
- [PRD](../PRD.md) - Full product requirements
