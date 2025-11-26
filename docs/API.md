# Kairos API Reference

REST API documentation for the Kairos backend.

**Base URL**: `https://api.kairos.dev/api/v1` (production) or `http://localhost:3000/api/v1` (development)

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Codes](#error-codes)
- [Endpoints](#endpoints)
  - [Auth](#auth)
  - [User](#user)
  - [Vocabulary](#vocabulary)
  - [Cards](#cards)
  - [NLP](#nlp)
  - [Content](#content)
  - [Pitch](#pitch)
  - [Speech](#speech)
  - [Sync](#sync)
  - [Analytics](#analytics)
  - [Billing](#billing)

## Authentication

Most endpoints require authentication via Bearer token.

```bash
curl -X GET "https://api.kairos.dev/api/v1/user" \
  -H "Authorization: Bearer <access_token>"
```

### Token Lifecycle

| Token | Lifetime | Usage |
|-------|----------|-------|
| Access Token | 15 minutes | API requests |
| Refresh Token | 7 days | Obtain new access token |

### Public Endpoints (No Auth Required)

- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/billing/webhook`

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response payload
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | AI service unavailable |

---

## Endpoints

### Auth

#### POST /auth/register

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

#### POST /auth/login

Authenticate and receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "subscriptionTier": "learner"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

#### POST /auth/refresh

Refresh access token.

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

#### POST /auth/logout

Revoke tokens. **Requires auth.**

**Response:**
```json
{
  "success": true
}
```

#### POST /auth/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

---

### User

#### GET /user

Get current user profile. **Requires auth.**

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "subscriptionTier": "learner",
    "subscriptionExpiresAt": "2025-12-01T00:00:00Z",
    "settings": {
      "hskLevel": 4,
      "showPinyin": true,
      "theme": "dark"
    },
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### PATCH /user/settings

Update user settings. **Requires auth.**

**Request:**
```json
{
  "hskLevel": 5,
  "showPinyin": false
}
```

#### GET /user/stats

Get learning statistics. **Requires auth.**

**Response:**
```json
{
  "success": true,
  "data": {
    "totalWordsLearned": 1250,
    "totalCardsMined": 340,
    "currentStreak": 15,
    "longestStreak": 42,
    "totalStudyTimeMinutes": 3600,
    "lastActiveAt": "2025-01-15T10:30:00Z"
  }
}
```

---

### Vocabulary

#### GET /vocabulary

List user vocabulary. **Requires auth.**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `status` | string | - | Filter: `new`, `learning`, `known` |
| `hskLevel` | number | - | Filter by HSK level (1-6) |
| `search` | string | - | Search word or pinyin |
| `sort` | string | `createdAt` | Sort field |
| `order` | string | `desc` | Sort order: `asc`, `desc` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "word": "学习",
      "pinyin": "xuéxí",
      "definition": "to learn; to study",
      "hskLevel": 1,
      "status": "learning",
      "easeFactor": 2.5,
      "nextReview": "2025-01-16T08:00:00Z",
      "reviewCount": 5,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1250,
      "totalPages": 63
    }
  }
}
```

#### POST /vocabulary/batch

Add multiple words. **Requires auth.**

**Request:**
```json
{
  "words": [
    {
      "word": "学习",
      "pinyin": "xuéxí",
      "definition": "to learn; to study",
      "hskLevel": 1
    }
  ]
}
```

#### GET /vocabulary/stats

Get vocabulary statistics. **Requires auth.**

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 1250,
    "byStatus": {
      "new": 150,
      "learning": 800,
      "known": 300
    },
    "byHskLevel": {
      "1": 200,
      "2": 300,
      "3": 400,
      "4": 250,
      "5": 80,
      "6": 20
    }
  }
}
```

#### GET /vocabulary/due

Get words due for review. **Requires auth.**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Maximum words to return |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "word": "学习",
      "pinyin": "xuéxí",
      "definition": "to learn; to study",
      "easeFactor": 2.5,
      "reviewCount": 5
    }
  ]
}
```

#### PATCH /vocabulary/:id

Update a vocabulary word. **Requires auth.**

**Request:**
```json
{
  "status": "known",
  "definition": "Updated definition"
}
```

#### DELETE /vocabulary/:id

Delete a vocabulary word. **Requires auth.**

#### POST /vocabulary/:id/review

Submit SRS review result. **Requires auth.**

**Request:**
```json
{
  "quality": 4
}
```

Quality scale (SM-2 algorithm):
- `0`: Complete blackout
- `1`: Incorrect, remembered upon seeing answer
- `2`: Incorrect, easy to recall after seeing answer
- `3`: Correct with serious difficulty
- `4`: Correct with some hesitation
- `5`: Perfect response

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "easeFactor": 2.6,
    "nextReview": "2025-01-20T08:00:00Z",
    "interval": 4
  }
}
```

---

### Cards

#### GET /cards

List mined flashcards. **Requires auth.**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `exported` | boolean | - | Filter by export status |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "word": "学习",
      "sentence": "我正在学习中文。",
      "simplifiedSentence": "我在学中文。",
      "audioUrl": "https://...",
      "screenshotUrl": "https://...",
      "sourceTitle": "The Untamed",
      "sourceTimestamp": "01:23:45",
      "exportedToAnki": false,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /cards

Create a new card. **Requires auth.**

**Request:**
```json
{
  "word": "学习",
  "sentence": "我正在学习中文。",
  "audioUrl": "https://...",
  "screenshotUrl": "https://...",
  "sourceTitle": "The Untamed",
  "sourceTimestamp": "01:23:45"
}
```

#### DELETE /cards/:id

Delete a card. **Requires auth.**

#### POST /cards/export

Export cards to various formats. **Requires auth.**

**Request:**
```json
{
  "format": "anki",
  "cardIds": ["uuid1", "uuid2"],
  "includeAudio": true,
  "includeScreenshots": true
}
```

Supported formats: `anki`, `csv`, `json`

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://...",
    "expiresAt": "2025-01-16T00:00:00Z",
    "cardCount": 25
  }
}
```

---

### NLP

#### POST /nlp/segment

Segment Chinese text into words. **Requires auth.**

**Request:**
```json
{
  "text": "你好，我正在学习中文。",
  "includePinyin": true,
  "includeDefinitions": true,
  "includeHsk": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "segments": [
      {
        "text": "你好",
        "pinyin": "nǐhǎo",
        "definitions": ["hello", "hi"],
        "hskLevel": 1,
        "pos": "interjection",
        "isPunctuation": false
      },
      {
        "text": "，",
        "isPunctuation": true
      }
    ],
    "originalText": "你好，我正在学习中文。",
    "wordCount": 6
  }
}
```

#### POST /nlp/analyze

Full linguistic analysis. **Requires auth.**

**Request:**
```json
{
  "text": "他毅然决然地离开了。"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "segments": [...],
    "complexity": {
      "averageHskLevel": 4.2,
      "unknownRatio": 0.15
    },
    "grammar": {
      "patterns": [
        {
          "pattern": "地 (adverbial marker)",
          "example": "毅然决然地",
          "explanation": "Connects an adjective/adverb to a verb"
        }
      ]
    }
  }
}
```

---

### Content

#### POST /content/simplify

Simplify a sentence to target HSK level. **Requires auth.** **Premium feature.**

**Request:**
```json
{
  "text": "这部电影的情节跌宕起伏，令人叹为观止。",
  "targetLevel": 3,
  "preserveNames": true,
  "context": "Movie review"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "original": "这部电影的情节跌宕起伏，令人叹为观止。",
    "simplified": "这部电影的故事很精彩，让人觉得很好看。",
    "targetLevel": 3,
    "confidence": 0.9,
    "cached": false,
    "tokensUsed": 45
  }
}
```

#### POST /content/simplify/batch

Simplify multiple sentences. **Requires auth.** **Premium feature.**

**Request:**
```json
{
  "sentences": [
    "这部电影的情节跌宕起伏",
    "他毅然决然地放弃了工作"
  ],
  "targetLevel": 3
}
```

---

### Pitch

#### POST /pitch/extract

Extract pitch contour from audio. **Requires auth.**

**Request:** `multipart/form-data`
- `audio`: Audio file (WAV, MP3)
- `hopLength`: Hop length in samples (default: 160)
- `threshold`: Voicing threshold (default: 0.3)

**Response:**
```json
{
  "success": true,
  "data": {
    "f0": [0, 0, 150.2, 155.3, ...],
    "confidence": [0, 0, 0.95, 0.97, ...],
    "times": [0, 0.01, 0.02, ...],
    "voicedF0": [150.2, 155.3, ...],
    "voicedTimes": [0.02, 0.03, ...],
    "duration": 2.5
  }
}
```

#### POST /pitch/analyze

Analyze Mandarin tone. **Requires auth.**

**Request:** `multipart/form-data`
- `audio`: Audio file
- `expectedTone`: Expected tone (1-5, optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "detectedTone": 2,
    "toneName": "rising",
    "confidence": 0.89,
    "isCorrect": true,
    "similarityScore": 0.92,
    "contourFeatures": {
      "startPitch": -2.1,
      "midPitch": 0.5,
      "endPitch": 3.2,
      "slope": 0.12
    }
  }
}
```

#### POST /pitch/compare

Compare user pitch to reference. **Requires auth.**

**Request:** `multipart/form-data`
- `reference`: Reference audio file
- `userAudio`: User audio file

**Response:**
```json
{
  "success": true,
  "data": {
    "similarity": 0.85,
    "segmentScores": [0.9, 0.82, 0.78, 0.88, 0.87],
    "referenceContour": [...],
    "userContour": [...],
    "referenceDuration": 1.2,
    "userDuration": 1.3
  }
}
```

---

### Speech

#### POST /speech/synthesize

Generate speech from text. **Requires auth.**

**Request:**
```json
{
  "text": "你好世界",
  "speaker": "中文女",
  "speed": 1.0
}
```

**Response:** Audio file (WAV)

#### GET /speech/speakers

List available voices.

**Response:**
```json
{
  "success": true,
  "data": {
    "speakers": ["中文女", "中文男", "粤语女", "英文女", "英文男"]
  }
}
```

---

### Sync

#### POST /sync

Push local changes to server. **Requires auth.**

**Request:**
```json
{
  "clientId": "device-uuid",
  "operations": [
    {
      "id": "op-uuid",
      "entityId": "vocab-uuid",
      "entityType": "vocabulary",
      "type": "update",
      "data": { "status": "known" },
      "timestamp": {
        "time": 1705312800000,
        "counter": 1,
        "node": "device-uuid"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accepted": 5,
    "rejected": 0,
    "serverTime": {
      "time": 1705312801000,
      "counter": 0,
      "node": "server"
    }
  }
}
```

#### GET /sync/pull

Pull changes from server. **Requires auth.**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `since` | string | HLC timestamp (optional) |
| `collections` | string | Comma-separated: `vocabulary,cards,settings` |

**Response:**
```json
{
  "success": true,
  "data": {
    "operations": [...],
    "serverTime": {...}
  }
}
```

---

### Analytics

#### POST /analytics/event

Log analytics event. **Requires auth.**

**Request:**
```json
{
  "eventType": "card_mined",
  "eventData": {
    "word": "学习",
    "source": "netflix",
    "hskLevel": 1
  }
}
```

#### GET /analytics/summary

Get user analytics summary. **Requires auth.**

**Response:**
```json
{
  "success": true,
  "data": {
    "daily": {
      "cardsReviewed": 25,
      "cardsMined": 5,
      "studyMinutes": 45
    },
    "weekly": {
      "cardsReviewed": 150,
      "cardsMined": 30,
      "studyMinutes": 280
    },
    "trends": {
      "reviewAccuracy": 0.85,
      "streakDays": 15
    }
  }
}
```

---

### Billing

#### POST /billing/subscribe

Create subscription. **Requires auth.**

**Request:**
```json
{
  "tier": "learner",
  "interval": "monthly"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
}
```

#### GET /billing/portal

Get customer portal URL. **Requires auth.**

**Response:**
```json
{
  "success": true,
  "data": {
    "portalUrl": "https://billing.stripe.com/..."
  }
}
```

#### POST /billing/webhook

Stripe webhook endpoint. **No auth** (verified by Stripe signature).

---

## Rate Limits

| Endpoint Pattern | Limit | Window |
|------------------|-------|--------|
| `*` | 100 requests | 1 minute |
| `/auth/*` | 5 requests | 1 minute |
| `/nlp/*` | 50 requests | 1 minute |
| `/content/simplify` | 20 requests | 1 minute |
| `/pitch/*` | 30 requests | 1 minute |
| `/speech/*` | 20 requests | 1 minute |

Rate limit headers:
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp

## Related Documents

- [Architecture](ARCHITECTURE.md) - System design
- [Development Guide](DEVELOPMENT.md) - Local setup
- [apps/api/README.md](../apps/api/README.md) - API app documentation
