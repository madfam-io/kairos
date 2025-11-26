# @kairos/types

Shared TypeScript type definitions for Kairos applications.

## Overview

This package is the **single source of truth** for all TypeScript types used across:
- API server
- Mobile app
- Desktop app
- Browser extension
- Shared packages

Centralizing types ensures:
- Consistency across the codebase
- No duplicate type definitions
- Easy refactoring
- Strong type safety

## Installation

This package is internal to the Kairos monorepo:

```json
{
  "dependencies": {
    "@kairos/types": "workspace:*"
  }
}
```

## Usage

```typescript
import type {
  User,
  VocabularyWord,
  Card,
  ApiResponse,
  SegmentResponse,
} from '@kairos/types';
```

## Type Categories

### User Types

```typescript
// User profile
interface User {
  id: string;
  email: string;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: string | null;
  settings: UserSettings;
  createdAt: string;
}

// Subscription tiers
type SubscriptionTier = 'free' | 'learner' | 'immersion';

// User settings
interface UserSettings {
  hskLevel: HSKLevel;
  showPinyin: boolean;
  simplificationEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  keyboardShortcutsEnabled: boolean;
}

// HSK levels
type HSKLevel = 1 | 2 | 3 | 4 | 5 | 6;
```

### Vocabulary Types

```typescript
// Vocabulary word
interface VocabularyWord {
  id: string;
  userId: string;
  word: string;
  pinyin: string | null;
  definition: string | null;
  hskLevel: HSKLevel | null;
  status: VocabularyStatus;
  easeFactor: number;
  nextReview: string | null;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

// Vocabulary status
type VocabularyStatus = 'new' | 'learning' | 'known';

// SRS review
interface ReviewResult {
  quality: ReviewQuality;
}

type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;
```

### Card Types

```typescript
// Mined flashcard
interface Card {
  id: string;
  userId: string;
  word: string;
  sentence: string | null;
  simplifiedSentence: string | null;
  audioUrl: string | null;
  screenshotUrl: string | null;
  sourceTitle: string | null;
  sourceTimestamp: string | null;
  exportedToAnki: boolean;
  createdAt: string;
}

// Card creation
interface CreateCardRequest {
  word: string;
  sentence?: string;
  audioUrl?: string;
  screenshotUrl?: string;
  sourceTitle?: string;
  sourceTimestamp?: string;
}

// Export format
type ExportFormat = 'anki' | 'csv' | 'json';
```

### NLP Types

```typescript
// Segmentation request
interface SegmentRequest {
  text: string;
  includePinyin?: boolean;
  includeDefinitions?: boolean;
  includeHsk?: boolean;
}

// Segmentation response
interface SegmentResponse {
  segments: Segment[];
  originalText: string;
  wordCount: number;
}

// Individual segment
interface Segment {
  text: string;
  pinyin?: string;
  toneMarks?: string;
  definitions?: string[];
  hskLevel?: HSKLevel | null;
  pos?: string;
  isPunctuation: boolean;
}

// Dictionary lookup
interface LookupResponse {
  word: string;
  traditional?: string;
  pinyin?: string;
  definitions?: string[];
  hskLevel?: HSKLevel | null;
  found: boolean;
}
```

### API Types

```typescript
// Standard API response
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

// API error
interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

// Error codes
type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

// Pagination metadata
interface ApiMeta {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Paginated request
interface PaginatedRequest {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
```

### Sync Types

```typescript
// Sync operation
interface SyncOperation<T = unknown> {
  id: string;
  entityId: string;
  entityType: string;
  type: OperationType;
  data: T | null;
  timestamp: HLCTimestamp;
  userId: string;
}

type OperationType = 'create' | 'update' | 'delete';

// Hybrid Logical Clock timestamp
interface HLCTimestamp {
  time: number;
  counter: number;
  node: string;
}

// Sync push request
interface SyncPushRequest {
  clientId: string;
  operations: SyncOperation[];
}

// Sync pull request
interface SyncPullRequest {
  since?: string;
  collections?: string[];
}
```

### Auth Types

```typescript
// Login request
interface LoginRequest {
  email: string;
  password: string;
}

// Register request
interface RegisterRequest {
  email: string;
  password: string;
}

// Auth response
interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Token refresh
interface RefreshRequest {
  refreshToken: string;
}
```

### Subscription Types

```typescript
// Subscription info
interface Subscription {
  tier: SubscriptionTier;
  expiresAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

// Pricing
interface PricingTier {
  tier: SubscriptionTier;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
}
```

## Project Structure

```
packages/types/
├── src/
│   ├── index.ts          # Main exports
│   ├── api.ts            # API response types
│   ├── user.ts           # User types
│   ├── vocabulary.ts     # Vocabulary types
│   ├── cards.ts          # Card types
│   ├── nlp.ts            # NLP types
│   ├── sync.ts           # Sync types
│   ├── auth.ts           # Auth types
│   └── subscription.ts   # Subscription types
├── package.json
└── tsconfig.json
```

## Exports

All types are exported from the main entry point:

```typescript
// Import individual types
import type { User, VocabularyWord, Card } from '@kairos/types';

// Import all types
import * as Types from '@kairos/types';
const user: Types.User = { ... };
```

## Type Guards

Utility type guards for runtime checking:

```typescript
import { isVocabularyStatus, isHSKLevel } from '@kairos/types';

function processWord(status: unknown) {
  if (isVocabularyStatus(status)) {
    // status is now typed as VocabularyStatus
  }
}

function validateLevel(level: unknown) {
  if (isHSKLevel(level)) {
    // level is now typed as HSKLevel
  }
}
```

## Best Practices

### Importing Types

Always use `import type` for type-only imports:

```typescript
// Good - tree-shaken in production
import type { User, VocabularyWord } from '@kairos/types';

// Avoid - may include runtime code
import { User, VocabularyWord } from '@kairos/types';
```

### Extending Types

When extending shared types:

```typescript
import type { VocabularyWord } from '@kairos/types';

// App-specific extension
interface VocabularyWordWithUI extends VocabularyWord {
  isSelected: boolean;
  isExpanded: boolean;
}
```

### Adding New Types

1. Add to appropriate file in `src/`
2. Export from `src/index.ts`
3. Run `pnpm build` to verify
4. Update consuming packages

## Related Documentation

- [Architecture](../../docs/ARCHITECTURE.md) - System design
- [API Reference](../../docs/API.md) - API documentation
- [apps/api](../../apps/api/README.md) - Backend API
