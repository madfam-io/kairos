# @kairos/sync

CRDT-based synchronization engine for Kairos applications.

## Overview

This package provides offline-first synchronization using:
- **CRDTs** (Conflict-free Replicated Data Types) for conflict resolution
- **Hybrid Logical Clocks (HLC)** for distributed timestamps
- **IndexedDB** for local persistence
- **React hooks** for easy integration

## Why CRDTs?

Traditional sync approaches require:
- Central server as source of truth
- Online connectivity for writes
- Complex conflict resolution

CRDTs enable:
- Offline writes that merge automatically
- No conflicts by design (Last-Writer-Wins)
- Eventually consistent across all devices

## Installation

This package is internal to the Kairos monorepo:

```json
{
  "dependencies": {
    "@kairos/sync": "workspace:*"
  }
}
```

## Usage

### Basic Setup

```typescript
import { SyncEngine } from '@kairos/sync';

const engine = new SyncEngine({
  userId: 'user-123',
  clientId: 'device-456',
  apiUrl: 'https://api.kairos.dev',
});

// Start sync
await engine.start();

// Stop sync
await engine.stop();
```

### React Integration

```typescript
import { SyncProvider, useSync, useSyncStatus } from '@kairos/sync/react';

// Wrap your app
function App() {
  return (
    <SyncProvider userId={userId} clientId={clientId}>
      <YourApp />
    </SyncProvider>
  );
}

// Access sync status
function SyncIndicator() {
  const { status, pendingCount, isOnline } = useSyncStatus();

  return (
    <div>
      {isOnline ? '🟢 Online' : '🟡 Offline'}
      {pendingCount > 0 && ` (${pendingCount} pending)`}
    </div>
  );
}

// Use synced data
function VocabularyList() {
  const { vocabulary, addWord, updateWord } = useSync();

  const handleAdd = () => {
    addWord({
      word: '学习',
      pinyin: 'xuéxí',
      status: 'learning',
    });
    // Works offline! Syncs when online.
  };

  return (/* ... */);
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SyncEngine                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐    │
│   │    HLC      │      │  LWW-Map    │      │  Storage    │    │
│   │ (Timestamp) │ ──── │  (CRDT)     │ ──── │ (IndexedDB) │    │
│   └─────────────┘      └─────────────┘      └─────────────┘    │
│          │                    │                    │            │
│          └────────────────────┼────────────────────┘            │
│                               │                                  │
│                               ▼                                  │
│                    ┌─────────────────┐                          │
│                    │  Sync Protocol  │                          │
│                    │  (Push/Pull)    │                          │
│                    └────────┬────────┘                          │
│                             │                                    │
└─────────────────────────────│────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Kairos API    │
                    │  /api/v1/sync   │
                    └─────────────────┘
```

## API Reference

### HybridLogicalClock

Distributed timestamp for ordering events:

```typescript
import { HybridLogicalClock } from '@kairos/sync';

const clock = new HybridLogicalClock('node-id');

// Generate timestamp
const ts = clock.now();
// { time: 1705312800000, counter: 0, node: 'node-id' }

// Receive remote timestamp (updates local clock)
clock.receive(remoteTimestamp);

// Compare timestamps
HybridLogicalClock.isAfter(ts1, ts2); // true if ts1 > ts2
HybridLogicalClock.compare(ts1, ts2); // -1, 0, or 1
```

### LWWMap

Last-Writer-Wins map for storing entities:

```typescript
import { LWWMap, HybridLogicalClock } from '@kairos/sync';

const clock = new HybridLogicalClock('node-id');
const map = new LWWMap<VocabularyWord>(clock);

// Local operations (creates pending ops)
const op = map.set({ id: '1', word: '学习', status: 'learning' });
const deleteOp = map.delete('1');

// Get data
const word = map.get('1');
const allWords = map.getAll();

// Apply remote operations
map.apply(remoteOp);
map.applyBatch(remoteOps);

// Get pending operations (for sync)
const pending = map.getPendingOps();
```

### SyncEngine

Main synchronization coordinator:

```typescript
import { SyncEngine } from '@kairos/sync';

const engine = new SyncEngine({
  userId: 'user-123',
  clientId: 'device-456',
  apiUrl: 'https://api.kairos.dev',
  collections: ['vocabulary', 'cards'],
  syncInterval: 30000, // 30 seconds
});

// Start/stop
await engine.start();
await engine.stop();

// Manual sync
await engine.syncNow();

// Event listeners
engine.on('sync:start', () => console.log('Syncing...'));
engine.on('sync:complete', ({ pushed, pulled }) => {
  console.log(`Pushed ${pushed}, pulled ${pulled}`);
});
engine.on('sync:error', (error) => console.error(error));
engine.on('online', () => console.log('Online'));
engine.on('offline', () => console.log('Offline'));
```

### Storage

IndexedDB persistence layer:

```typescript
import { createStorage } from '@kairos/sync';

const storage = await createStorage('kairos-sync');

// Save state
await storage.save('vocabulary', map.serialize());

// Load state
const data = await storage.load('vocabulary');
map.load(data);

// Get last sync timestamp
const lastSync = await storage.getLastSync('vocabulary');
```

## Sync Protocol

### Push (Client → Server)

```typescript
// Request
POST /api/v1/sync
{
  "clientId": "device-456",
  "operations": [
    {
      "id": "op-1",
      "entityId": "vocab-123",
      "entityType": "vocabulary",
      "type": "update",
      "data": { "status": "known" },
      "timestamp": { "time": 1705312800000, "counter": 1, "node": "device-456" }
    }
  ]
}

// Response
{
  "accepted": 1,
  "rejected": 0,
  "serverTime": { "time": 1705312801000, "counter": 0, "node": "server" }
}
```

### Pull (Server → Client)

```typescript
// Request
GET /api/v1/sync/pull?since=1705312800000&collections=vocabulary,cards

// Response
{
  "operations": [...],
  "serverTime": { ... }
}
```

## Conflict Resolution

LWW (Last-Writer-Wins) ensures deterministic merge:

```
Device A                    Device B
    │                           │
    │  set(word, "known")       │  set(word, "learning")
    │  timestamp: T1            │  timestamp: T2
    │                           │
    └───────────┬───────────────┘
                │
                ▼
           ┌─────────┐
           │  Merge  │  If T2 > T1: "learning" wins
           │  (LWW)  │  If T1 > T2: "known" wins
           └─────────┘
```

No conflicts because:
1. HLC timestamps are globally unique
2. Same timestamp → node ID breaks ties
3. Later timestamp always wins

## Collections

Built-in CRDT maps for Kairos data:

```typescript
import { VocabularyMap, CardsMap } from '@kairos/sync';

// Vocabulary with proper typing
const vocabularyMap = new VocabularyMap(clock);
vocabularyMap.set({
  id: '1',
  word: '学习',
  pinyin: 'xuéxí',
  definitions: ['to learn', 'to study'],
  hskLevel: 1,
  status: 'learning',
  encounters: 5,
  lastSeen: new Date().toISOString(),
  addedAt: new Date().toISOString(),
});

// Cards with proper typing
const cardsMap = new CardsMap(clock);
cardsMap.set({
  id: '1',
  word: '学习',
  sentence: '我正在学习中文',
  definitions: ['to learn'],
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
  createdAt: new Date().toISOString(),
});
```

## React Hooks

### useSyncStatus

```typescript
const {
  status,      // 'idle' | 'syncing' | 'error'
  pendingCount, // Number of pending operations
  isOnline,    // Network connectivity
  lastSync,    // Last successful sync timestamp
  error,       // Last sync error
} = useSyncStatus();
```

### useSync

```typescript
const {
  vocabulary,  // All vocabulary words
  cards,       // All cards
  addWord,     // Add vocabulary word
  updateWord,  // Update vocabulary word
  deleteWord,  // Delete vocabulary word
  addCard,     // Add card
  deleteCard,  // Delete card
} = useSync();
```

## Project Structure

```
packages/sync/
├── src/
│   ├── index.ts          # Main exports
│   ├── react.ts          # React exports
│   ├── crdt.ts           # CRDT implementations
│   ├── hlc.ts            # Hybrid Logical Clock
│   ├── engine.ts         # Sync engine
│   └── storage.ts        # IndexedDB storage
├── package.json
└── tsconfig.json
```

## Related Documentation

- [Architecture](../../docs/ARCHITECTURE.md) - System design
- [API Reference](../../docs/API.md) - Sync endpoints
- [apps/api](../../apps/api/README.md) - Backend API
