/**
 * IndexedDB storage for offline-first data
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { HLCTimestamp } from './hlc';
import type { Operation, LWWRegister } from './crdt';

interface KairosDBSchema extends DBSchema {
  vocabulary: {
    key: string;
    value: LWWRegister<{
      id: string;
      word: string;
      pinyin: string | null;
      definitions: string[];
      hskLevel: number | null;
      status: 'new' | 'learning' | 'known';
      encounters: number;
      lastSeen: string;
      addedAt: string;
    }>;
    indexes: {
      'by-status': string;
      'by-word': string;
    };
  };
  cards: {
    key: string;
    value: LWWRegister<{
      id: string;
      word: string;
      sentence: string;
      simplifiedSentence?: string;
      pinyin?: string;
      definitions: string[];
      hskLevel?: number;
      sourceTitle?: string;
      interval: number;
      easeFactor: number;
      repetitions: number;
      nextReview?: string;
      createdAt: string;
    }>;
    indexes: {
      'by-word': string;
      'by-next-review': string;
    };
  };
  pendingOps: {
    key: string;
    value: Operation;
    indexes: {
      'by-timestamp': string;
      'by-entity-type': string;
    };
  };
  syncState: {
    key: string;
    value: {
      id: string;
      lastSyncTimestamp: HLCTimestamp | null;
      lastSyncTime: number;
      nodeId: string;
    };
  };
}

const DB_NAME = 'kairos-sync';
const DB_VERSION = 1;

export class SyncStorage {
  private db: IDBPDatabase<KairosDBSchema> | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    await this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.db = await openDB<KairosDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Vocabulary store
        if (!db.objectStoreNames.contains('vocabulary')) {
          const vocabStore = db.createObjectStore('vocabulary', { keyPath: 'value.id' });
          vocabStore.createIndex('by-status', 'value.status');
          vocabStore.createIndex('by-word', 'value.word');
        }

        // Cards store
        if (!db.objectStoreNames.contains('cards')) {
          const cardsStore = db.createObjectStore('cards', { keyPath: 'value.id' });
          cardsStore.createIndex('by-word', 'value.word');
          cardsStore.createIndex('by-next-review', 'value.nextReview');
        }

        // Pending operations store
        if (!db.objectStoreNames.contains('pendingOps')) {
          const opsStore = db.createObjectStore('pendingOps', { keyPath: 'id' });
          opsStore.createIndex('by-timestamp', 'timestamp.time');
          opsStore.createIndex('by-entity-type', 'entityType');
        }

        // Sync state store
        if (!db.objectStoreNames.contains('syncState')) {
          db.createObjectStore('syncState', { keyPath: 'id' });
        }
      },
    });
  }

  private ensureDb(): IDBPDatabase<KairosDBSchema> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  // Vocabulary operations
  async getAllVocabulary(): Promise<LWWRegister<KairosDBSchema['vocabulary']['value']['value']>[]> {
    const db = this.ensureDb();
    return db.getAll('vocabulary');
  }

  async getVocabulary(id: string): Promise<LWWRegister<KairosDBSchema['vocabulary']['value']['value']> | undefined> {
    const db = this.ensureDb();
    return db.get('vocabulary', id);
  }

  async putVocabulary(register: LWWRegister<KairosDBSchema['vocabulary']['value']['value']>): Promise<void> {
    const db = this.ensureDb();
    await db.put('vocabulary', register);
  }

  async putVocabularyBatch(registers: LWWRegister<KairosDBSchema['vocabulary']['value']['value']>[]): Promise<void> {
    const db = this.ensureDb();
    const tx = db.transaction('vocabulary', 'readwrite');
    await Promise.all([
      ...registers.map((r) => tx.store.put(r)),
      tx.done,
    ]);
  }

  // Cards operations
  async getAllCards(): Promise<LWWRegister<KairosDBSchema['cards']['value']['value']>[]> {
    const db = this.ensureDb();
    return db.getAll('cards');
  }

  async getCard(id: string): Promise<LWWRegister<KairosDBSchema['cards']['value']['value']> | undefined> {
    const db = this.ensureDb();
    return db.get('cards', id);
  }

  async putCard(register: LWWRegister<KairosDBSchema['cards']['value']['value']>): Promise<void> {
    const db = this.ensureDb();
    await db.put('cards', register);
  }

  async putCardsBatch(registers: LWWRegister<KairosDBSchema['cards']['value']['value']>[]): Promise<void> {
    const db = this.ensureDb();
    const tx = db.transaction('cards', 'readwrite');
    await Promise.all([
      ...registers.map((r) => tx.store.put(r)),
      tx.done,
    ]);
  }

  async getDueCards(): Promise<LWWRegister<KairosDBSchema['cards']['value']['value']>[]> {
    const db = this.ensureDb();
    const now = new Date().toISOString();
    const index = db.transaction('cards').store.index('by-next-review');
    const results: LWWRegister<KairosDBSchema['cards']['value']['value']>[] = [];

    let cursor = await index.openCursor(IDBKeyRange.upperBound(now));
    while (cursor) {
      if (!cursor.value.deleted) {
        results.push(cursor.value);
      }
      cursor = await cursor.continue();
    }

    return results;
  }

  // Pending operations
  async addPendingOp(op: Operation): Promise<void> {
    const db = this.ensureDb();
    await db.put('pendingOps', op);
  }

  async addPendingOpsBatch(ops: Operation[]): Promise<void> {
    const db = this.ensureDb();
    const tx = db.transaction('pendingOps', 'readwrite');
    await Promise.all([
      ...ops.map((op) => tx.store.put(op)),
      tx.done,
    ]);
  }

  async getAllPendingOps(): Promise<Operation[]> {
    const db = this.ensureDb();
    return db.getAll('pendingOps');
  }

  async clearPendingOps(ids: string[]): Promise<void> {
    const db = this.ensureDb();
    const tx = db.transaction('pendingOps', 'readwrite');
    await Promise.all([
      ...ids.map((id) => tx.store.delete(id)),
      tx.done,
    ]);
  }

  async getPendingOpsCount(): Promise<number> {
    const db = this.ensureDb();
    return db.count('pendingOps');
  }

  // Sync state
  async getSyncState(): Promise<KairosDBSchema['syncState']['value'] | undefined> {
    const db = this.ensureDb();
    return db.get('syncState', 'main');
  }

  async setSyncState(state: KairosDBSchema['syncState']['value']): Promise<void> {
    const db = this.ensureDb();
    await db.put('syncState', { ...state, id: 'main' });
  }

  // Utility
  async clear(): Promise<void> {
    const db = this.ensureDb();
    await Promise.all([
      db.clear('vocabulary'),
      db.clear('cards'),
      db.clear('pendingOps'),
      db.clear('syncState'),
    ]);
  }

  close(): void {
    this.db?.close();
    this.db = null;
    this.initPromise = null;
  }
}

// Singleton instance
let storageInstance: SyncStorage | null = null;

export function getSyncStorage(): SyncStorage {
  if (!storageInstance) {
    storageInstance = new SyncStorage();
  }
  return storageInstance;
}
