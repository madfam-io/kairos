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
  - [Developer](#developer)
  - [Enterprise](#enterprise)

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

### Developer

Developer Platform API for OAuth applications, API keys, webhooks, and integrations.

#### GET /developer/applications

List user's registered OAuth applications. **Requires auth.**

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "My App",
      "description": "App description",
      "clientId": "kairos_app_...",
      "redirectUris": ["https://myapp.com/callback"],
      "scopes": ["read:vocabulary", "write:cards"],
      "rateLimitTier": "standard",
      "isVerified": false,
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /developer/applications

Create a new OAuth application. **Requires auth.**

**Request:**
```json
{
  "name": "My Integration",
  "description": "Optional description",
  "websiteUrl": "https://myapp.com",
  "redirectUris": ["https://myapp.com/callback"],
  "scopes": ["read:vocabulary", "write:cards"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Integration",
    "clientId": "kairos_app_...",
    "clientSecret": "kairos_secret_...",
    "redirectUris": ["https://myapp.com/callback"],
    "scopes": ["read:vocabulary", "write:cards"]
  },
  "warning": "Store the client secret securely. It will not be shown again."
}
```

#### POST /developer/applications/:appId/rotate-secret

Rotate OAuth client secret. **Requires auth.**

#### DELETE /developer/applications/:appId

Delete an OAuth application. **Requires auth.**

#### GET /developer/api-keys

List user's API keys. **Requires auth.**

#### POST /developer/api-keys

Create a new API key. **Requires auth.**

**Request:**
```json
{
  "name": "Production Key",
  "scopes": ["read:vocabulary", "read:progress"],
  "expiresInDays": 90
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Production Key",
    "keyPrefix": "kairos_...",
    "key": "kairos_live_...",
    "scopes": ["read:vocabulary", "read:progress"],
    "expiresAt": "2025-04-01T00:00:00Z"
  },
  "warning": "Store the API key securely. It will not be shown again."
}
```

#### DELETE /developer/api-keys/:keyId

Revoke an API key. **Requires auth.**

#### GET /developer/authorized-apps

List third-party apps the user has authorized. **Requires auth.**

#### DELETE /developer/authorized-apps/:appId

Revoke access for a third-party app. **Requires auth.**

#### GET /developer/webhooks

List user's webhooks. **Requires auth.**

#### POST /developer/webhooks

Create a webhook endpoint. **Requires auth.**

**Request:**
```json
{
  "url": "https://myapp.com/webhooks/kairos",
  "description": "Production webhook",
  "events": ["vocabulary.created", "card.created", "milestone.achieved"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "url": "https://myapp.com/webhooks/kairos",
    "events": ["vocabulary.created", "card.created", "milestone.achieved"],
    "secret": "whsec_..."
  },
  "warning": "Store the webhook secret securely. It will not be shown again."
}
```

**Available Events:**
- `vocabulary.created` - New vocabulary word added
- `vocabulary.updated` - Vocabulary word updated
- `vocabulary.deleted` - Vocabulary word deleted
- `card.created` - New card mined
- `card.exported` - Card exported to Anki
- `milestone.achieved` - Learning milestone reached
- `streak.updated` - Study streak changed
- `review.completed` - Review session completed

#### GET /developer/webhooks/:webhookId/deliveries

Get webhook delivery history. **Requires auth.**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Max deliveries to return (max 100) |

#### POST /developer/webhooks/:webhookId/rotate-secret

Rotate webhook secret. **Requires auth.**

#### DELETE /developer/webhooks/:webhookId

Delete a webhook. **Requires auth.**

#### GET /developer/integrations

List connected external integrations. **Requires auth.**

#### DELETE /developer/integrations/:provider

Disconnect an external integration. **Requires auth.**

#### GET /developer/usage

Get API usage statistics. **Requires auth.**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `apiKeyId` | string | - | Filter by specific API key |
| `days` | number | 30 | Days of history (max 90) |

#### GET /developer/scopes

List available API scopes.

**Available Scopes:**
- `read:vocabulary` - Read vocabulary words and learning status
- `write:vocabulary` - Add, update, or delete vocabulary words
- `read:cards` - Read mined cards
- `write:cards` - Create or modify cards
- `read:progress` - Read learning progress and statistics
- `read:profile` - Read user profile information
- `write:profile` - Update user profile settings

#### GET /developer/webhook-events

List available webhook events with descriptions.

---

### Enterprise

Enterprise/Organization API for institutional deployments.

#### GET /enterprise/organizations

List user's organizations. **Requires auth.**

#### POST /enterprise/organizations

Create a new organization. **Requires auth.**

**Request:**
```json
{
  "name": "Acme University",
  "type": "university",
  "domain": "acme.edu",
  "billingEmail": "billing@acme.edu",
  "maxSeats": 500
}
```

**Organization Types:** `university`, `school`, `company`, `language_school`

#### GET /enterprise/organizations/:orgId

Get organization details. **Requires auth + org membership.**

#### PATCH /enterprise/organizations/:orgId

Update organization settings. **Requires auth + owner role.**

#### GET /enterprise/organizations/by-slug/:slug

Get organization public info by slug (for join pages).

---

#### Member Management

#### GET /enterprise/organizations/:orgId/members

List organization members. **Requires auth + org membership.**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `departmentId` | string | Filter by department |
| `role` | string | Filter by role: `owner`, `admin`, `instructor`, `member` |
| `isActive` | boolean | Filter by active status |
| `limit` | number | Items per page (default 50) |
| `offset` | number | Pagination offset |

#### POST /enterprise/organizations/:orgId/members/:userId

Add a member by user ID. **Requires auth + admin role.**

#### PATCH /enterprise/organizations/:orgId/members/:userId

Update member role. **Requires auth + admin role.**

**Request:**
```json
{
  "role": "instructor"
}
```

**Roles:** `admin`, `instructor`, `member` (owner cannot be changed)

#### DELETE /enterprise/organizations/:orgId/members/:userId

Remove a member. **Requires auth + admin role.**

---

#### Invitations

#### GET /enterprise/organizations/:orgId/invites

List pending invitations. **Requires auth + admin role.**

#### POST /enterprise/organizations/:orgId/invites

Create an invitation. **Requires auth + admin role.**

**Request:**
```json
{
  "email": "student@acme.edu",
  "role": "member",
  "departmentId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "inv_...",
    "expiresAt": "2025-01-08T00:00:00Z",
    "inviteUrl": "https://app.kairos.dev/join/inv_..."
  }
}
```

#### POST /enterprise/organizations/:orgId/invites/bulk

Bulk invite/provision users (up to 500). **Requires auth + admin role.**

**Request:**
```json
{
  "users": [
    {
      "email": "student1@acme.edu",
      "displayName": "John Doe",
      "studentId": "12345",
      "departmentId": "uuid",
      "role": "member"
    }
  ]
}
```

#### POST /enterprise/invites/:token/accept

Accept an invitation. **Requires auth.**

#### DELETE /enterprise/organizations/:orgId/invites/:inviteId

Cancel an invitation. **Requires auth + admin role.**

---

#### Departments

#### GET /enterprise/organizations/:orgId/departments

List departments. **Requires auth + org membership.**

#### POST /enterprise/organizations/:orgId/departments

Create a department. **Requires auth + admin role.**

**Request:**
```json
{
  "name": "Chinese Department",
  "code": "CHIN",
  "description": "Chinese language courses",
  "parentId": "uuid"
}
```

#### PATCH /enterprise/organizations/:orgId/departments/:deptId

Update a department. **Requires auth + admin role.**

#### DELETE /enterprise/organizations/:orgId/departments/:deptId

Delete a department. **Requires auth + admin role.**

---

#### Organization Decks

#### GET /enterprise/organizations/:orgId/decks

List organization's private deck library. **Requires auth + org membership.**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `departmentId` | string | Filter by department |

#### POST /enterprise/organizations/:orgId/decks

Add a deck to organization library. **Requires auth + instructor role.**

**Request:**
```json
{
  "deckId": "uuid",
  "departmentId": "uuid",
  "isRequired": true
}
```

#### DELETE /enterprise/organizations/:orgId/decks/:deckId

Remove a deck from organization library. **Requires auth + instructor role.**

---

#### Analytics

#### GET /enterprise/organizations/:orgId/analytics

Get organization learning analytics. **Requires auth + instructor role.**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | number | 30 | Days of data (7-365) |

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMembers": 150,
    "activeMembers": 120,
    "totalWordsLearned": 45000,
    "averageWordsPerMember": 300,
    "totalStudyTimeHours": 1200,
    "averageStudyTimeHours": 8,
    "topLearners": [
      {
        "userId": "uuid",
        "displayName": "Jane Doe",
        "wordsLearned": 850,
        "studyTimeHours": 25.5
      }
    ],
    "departmentBreakdown": [
      {
        "departmentId": "uuid",
        "departmentName": "Chinese Department",
        "memberCount": 50,
        "wordsLearned": 15000
      }
    ],
    "progressOverTime": [
      {
        "date": "2025-01-15",
        "wordsLearned": 1500,
        "activeUsers": 85
      }
    ]
  }
}
```

---

#### Audit Logs

#### GET /enterprise/organizations/:orgId/audit-logs

Get organization audit logs. **Requires auth + owner role.**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Items per page |
| `offset` | number | 0 | Pagination offset |
| `actorId` | string | - | Filter by actor |
| `action` | string | - | Filter by action type |

---

#### License Management

#### GET /enterprise/organizations/:orgId/license

Get license information. **Requires auth + owner role.**

**Response:**
```json
{
  "success": true,
  "data": {
    "licenseTier": "premium",
    "maxSeats": 500,
    "usedSeats": 150,
    "availableSeats": 350,
    "licenseExpiresAt": "2026-01-01T00:00:00Z",
    "isExpired": false
  }
}
```

**License Tiers:** `standard`, `premium`, `unlimited`

#### PATCH /enterprise/organizations/:orgId/license

Update license (admin only). **Requires auth + owner role.**

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
