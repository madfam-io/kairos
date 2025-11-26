# Product Requirements Document (PRD): "Kairos" – The Intelligent Chinese Immersion Engine

| **Document Name** | Kairos PRD: Next-Gen Chinese Immersion |
| :--- | :--- |
| **Version** | 1.0 (Draft) |
| **Status** | Planning Phase |
| **Blue Ocean Strategy** | **"Smart Simplification & Pitch Precision"**<br>Moving beyond simple dictionaries to AI-driven content adaptation and tone mastery. |

-----

## 1\. Executive Summary & Strategic Positioning

### 1.1 The Opportunity

The current market for immersion tools is polarized. On one end, **Migaku** and **Refold** cater to hardcore power users but suffer from high subscription fatigue ($120/year) and technical friction (legacy segmentation). On the other, **Language Reactor** is accessible but technically stagnant ("abandonware") with poor Chinese parsing.

**Kairos** will carve a Blue Ocean by shifting the value proposition from **"Tooling for Mining"** (Migaku) to **"Engine for Comprehension."** Instead of just helping users *save* words they don't understand, Kairos will use Generative AI to *rewrite* subtitles in real-time to the user's HSK level, effectively lowering the barrier to entry for native content.

### 1.2 The "Blue Ocean" Differentiators

1.  **Chinese-First Architecture:** Abandoning generic "polyglot" libraries for **PaddleNLP** and **PaddleOCR**, ensuring 99% accuracy in Chinese segmentation and hard-sub recognition (solving the \#1 user complaint).
2.  **The "i+1" Generator (AI Simplification):** Unlike competitors that just translate, Kairos offers a "Simplify" toggle. It uses LLMs (Claude 3.5 Sonnet / GPT-4o) to rewrite complex C-Drama subtitles into HSK 3/4/5 vocabulary while retaining the original meaning.
3.  **Visual Tone Feedback:** A "Shadowing Mode" that visualizes the user's pitch contour overlaying the native speaker's audio in real-time, addressing the specific needs of tonal language learners.
4.  **Lifetime Monetization:** Counter-positioning against Migaku's subscription model with a "Buy Once, Keep Forever" license for the core software, with optional "API Credits" for heavy AI usage.

-----

## 2\. User Personas

| Persona | **"The Plateaued Intermediate" (Liam)** | **"The Efficient Professional" (Sarah)** |
| :--- | :--- | :--- |
| **Profile** | HSK 4 level. Stuck. Can read textbooks but fails at Netflix. | Tech-savvy, busy. Willing to pay to save time. |
| **Current Pain** | "I try to watch *The Untamed*, but I have to pause every 2 seconds. It's too hard, so I quit." | "Setting up Anki + Yomitan + ASBPlayer takes 3 hours. I just want it to work." |
| **Kairos Solution** | **AI Simplification:** He toggles "HSK 4 Mode." Subtitles are rewritten to his level. He stays in the flow. | **One-Click Mining:** Instant export to Anki with high-res audio/screenshot without configuration. |

-----

## 3\. Functional Requirements

### 3.1 Core Player & Overlay (The "Thin Client")

The core interface is a browser extension overlay compatible with Netflix, YouTube, and local video files.

  * **FR-01: Neural Segmentation (WASM/Cloud Hybrid):**
      * **Requirement:** Must replace standard browser segmentation with **PaddleNLP** (or a distilled WASM version) to correctly parse proper nouns (e.g., distinguishing "Harry Potter" transliterations from random characters).
      * **Blue Ocean Feature:** "Ambiguity Hover." If a phrase is ambiguous, the parser highlights the ambiguity and offers the two most likely segmentations.
  * **FR-02: Hard-Sub OCR (Optical Character Recognition):**
      * **Requirement:** Users must be able to "draw" a box over hard-coded Chinese subtitles (common in historical dramas).
      * **Tech Stack:** Implementation of **PaddleOCR** (optimized for Chinese characters) rather than Tesseract.
      * **Performance:** OCR latency must be \<800ms.

### 3.2 The "i+1" Simplification Engine (AI Feature)

  * **FR-03: Real-Time Subtitle Rewriting:**
      * **User Action:** User selects their level (e.g., "HSK 3").
      * **System Action:** When a subtitle line exceeds the user's level, the system calls an LLM (via cached API) to rewrite the sentence using *only* HSK 3 words + proper nouns, displayed below the original.
      * **Example:**
          * *Original:* "陛下，此事万万不可鲁莽行事" (Your Majesty, this matter absolutely cannot be handled recklessly).
          * *Simplified (HSK 3):* "皇上，这件事不能太快做" (The Emperor, this matter cannot be done too fast).
  * **FR-04: Grammar "Explainer" Tooltip:**
      * **Requirement:** Hovering over a grammar particle (e.g., 了, 把, 被) invokes a specific grammar explanation, not a dictionary definition.

### 3.3 The "Tone Perfect" Shadowing Module

  * **FR-05: Pitch Visualization Overlay:**
      * **Requirement:** When video is paused, user can record audio. The system visualizes the *Pitch Contour* (F0 frequency) of the actor vs. the user.
      * **Differentiation:** Competitors use simple waveform (volume), which is useless for tones. Kairos uses pitch detection (e.g., `crepe` or `pitch.js`) to show tone accuracy.

### 3.4 The Mining Workflow (Anki Integration)

  * **FR-06: Zero-Config AnkiConnect:**
      * **Requirement:** Auto-detect running Anki instance. Pre-installed "Kairos Note Type" with fields for: Audio, Screenshot, Sentence, Definition, Pinyin, and **simplified sentence version**.
  * **FR-07: Smart Audio Clipping (VAD):**
      * **Requirement:** Use Voice Activity Detection to ensure the audio clip doesn't cut off the first/last syllable, adding dynamic padding (±250ms) based on the waveform.

-----

## 4\. Technical Architecture & Stack

### 4.1 Technology Selection

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React + Plasmo Framework | Plasmo is the industry standard for robust browser extensions. |
| **Segmentation** | **PaddleNLP (Serverless)** | Best-in-class performance for Mandarin NER (Named Entity Recognition). |
| **OCR Engine** | **PaddleOCR (ONNX Runtime)** | Runs efficiently in-browser (via ONNX) or edge cloud; superior to Tesseract for Hanzi. |
| **Pitch Detection** | **TensorFlow.js (SPICE model)** | Allows for accurate pitch extraction directly in the browser. |
| **LLM Gateway** | **Claude 3.5 Sonnet / Haiku** | Claude exhibits higher nuance in Chinese literary translation than GPT-4o. |

### 4.2 Data Privacy & Sync

  * **Local First:** User decks and "Known Words" database stored locally in IndexedDB (browser).
  * **Optional Cloud Sync:** Encrypted sync for users who want cross-device progress (Monetized feature).

-----

## 5\. UI/UX Guidelines

### 5.1 The "Immersive" Principle

  * **Invisible UI:** By default, the interface should be invisible. Subtitles only look different when hovered.
  * **Smart Hiding:** "Known words" (based on user's Anki history) should NOT be highlighted or underlined, reducing visual clutter.

### 5.2 The "Simplification" Toggle

  * A physical toggle switch on the video player bar: \*\*\*\*.
  * When "Simplified" is active, the subtitle font changes slightly (e.g., to a rounded font) to visually indicate it is AI-modified text.

-----

## 6\. Roadmap & Phasing

### Phase 1: The "Better Mousetrap" (Months 1–3)

  * **Goal:** Parity with Migaku/LR but with *working* Chinese segmentation.
  * **Deliverables:** Chrome Extension, PaddleNLP segmentation, One-click Anki export.
  * **Price:** Free / Beta.

### Phase 2: The "Blue Ocean" Features (Months 4–6)

  * **Goal:** Differentiation via AI.
  * **Deliverables:** "i+1" Simplification Engine (LLM integration), Pitch Visualization overlay.
  * **Price:** Launch "Lifetime Core" ($60) + "AI Subscription" ($5/mo for heavy users).

### Phase 3: The "Social" Layer (Months 7+)

  * **Goal:** Viral growth.
  * **Deliverables:** "Classroom Mode" for tutors to assign videos with pre-simplified subtitles; Shared "Mining Decks" for popular C-Dramas (e.g., "The Three-Body Problem HSK 5 Deck").

-----

## 7\. Success Metrics (KPIs)

1.  **Mining Velocity:** Average time to create a card (Target: \< 3 seconds).
2.  **Retention:** % of users who use the extension \> 3 times a week.
3.  **Simplification Rate:** % of subtitles users choose to "Simplify" vs "Native" (Indicates value of the AI feature).
4.  **Parsing Accuracy Reports:** Number of "Incorrect Segmentation" reports filed by users (Target: \< 1 per 1,000 sentences).
