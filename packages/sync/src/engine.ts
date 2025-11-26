/**
 * Sync Engine - manages synchronization between local and remote
 */

import { v4 as uuid } from 'uuid';
import { HybridLogicalClock, type HLCTimestamp } from './hlc';
import { VocabularyMap, CardsMap, type Operation } from './crdt';
import { getSyncStorage, type SyncStorage } from './storage';

export interface SyncConfig {
  apiUrl: string;
  getAccessToken: () => Promise<string | null>;
  onSyncStart?: () => void;
  onSyncComplete?: (result: SyncResult) => void;
  onSyncError?: (error: Error) => void;
  onConflict?: (local: Operation, remote: Operation) => 'local' | 'remote';
  syncInterval?: number; // milliseconds
  retryDelay?: number;
  maxRetries?: number;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  duration: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export class SyncEngine {
  private config: SyncConfig;
  private clock: HybridLogicalClock;
  private storage: SyncStorage;
  private vocabulary: VocabularyMap;
  private cards: CardsMap;

  private status: SyncStatus = 'idle';
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isOnline: boolean = true;
  private retryCount: number = 0;
  private lastError: Error | null = null;

  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor(config: SyncConfig) {
    this.config = {
      syncInterval: 30000, // 30 seconds
      retryDelay: 5000,
      maxRetries: 3,
      ...config,
    };

    // Generate or load node ID
    const nodeId = this.getOrCreateNodeId();
    this.clock = new HybridLogicalClock(nodeId);
    this.storage = getSyncStorage();
    this.vocabulary = new VocabularyMap(this.clock);
    this.cards = new CardsMap(this.clock);
  }

  private getOrCreateNodeId(): string {
    if (typeof localStorage !== 'undefined') {
      let nodeId = localStorage.getItem('kairos_node_id');
      if (!nodeId) {
        nodeId = uuid().slice(0, 8);
        localStorage.setItem('kairos_node_id', nodeId);
      }
      return nodeId;
    }
    return uuid().slice(0, 8);
  }

  /**
   * Initialize the sync engine
   */
  async init(): Promise<void> {
    await this.storage.init();
    await this.loadFromStorage();

    // Setup online/offline detection
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
      this.isOnline = navigator.onLine;
    }
  }

  private async loadFromStorage(): Promise<void> {
    // Load vocabulary
    const vocabData = await this.storage.getAllVocabulary();
    const vocabMap: Record<string, any> = {};
    for (const item of vocabData) {
      vocabMap[item.value.id] = item;
    }
    this.vocabulary.load(vocabMap);

    // Load cards
    const cardsData = await this.storage.getAllCards();
    const cardsMap: Record<string, any> = {};
    for (const item of cardsData) {
      cardsMap[item.value.id] = item;
    }
    this.cards.load(cardsMap);
  }

  /**
   * Start automatic sync
   */
  startAutoSync(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      if (this.isOnline && this.status !== 'syncing') {
        this.sync().catch(console.error);
      }
    }, this.config.syncInterval);

    // Initial sync
    this.sync().catch(console.error);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Perform a sync operation
   */
  async sync(): Promise<SyncResult> {
    if (this.status === 'syncing') {
      throw new Error('Sync already in progress');
    }

    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    const startTime = Date.now();
    this.setStatus('syncing');
    this.config.onSyncStart?.();

    try {
      const token = await this.config.getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Get pending operations
      const pendingOps = await this.storage.getAllPendingOps();

      // Get last sync timestamp
      const syncState = await this.storage.getSyncState();
      const lastSync = syncState?.lastSyncTimestamp ?? null;

      // Push local changes
      let pushed = 0;
      if (pendingOps.length > 0) {
        const pushResult = await this.pushChanges(token, pendingOps);
        pushed = pushResult.accepted;
        await this.storage.clearPendingOps(pushResult.acceptedIds);
      }

      // Pull remote changes
      const pullResult = await this.pullChanges(token, lastSync);
      const pulled = pullResult.applied;
      const conflicts = pullResult.conflicts;

      // Update sync state
      if (pullResult.serverTimestamp) {
        await this.storage.setSyncState({
          id: 'main',
          lastSyncTimestamp: pullResult.serverTimestamp,
          lastSyncTime: Date.now(),
          nodeId: this.clock.getNodeId(),
        });
      }

      // Save updated state to storage
      await this.saveToStorage();

      const result: SyncResult = {
        pushed,
        pulled,
        conflicts,
        duration: Date.now() - startTime,
      };

      this.setStatus('idle');
      this.retryCount = 0;
      this.lastError = null;
      this.config.onSyncComplete?.(result);

      return result;
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));
      this.setStatus('error');
      this.config.onSyncError?.(this.lastError);

      // Retry logic
      if (this.retryCount < (this.config.maxRetries ?? 3)) {
        this.retryCount++;
        setTimeout(() => {
          this.sync().catch(console.error);
        }, this.config.retryDelay);
      }

      throw error;
    }
  }

  private async pushChanges(
    token: string,
    ops: Operation[]
  ): Promise<{ accepted: number; acceptedIds: string[] }> {
    const response = await fetch(`${this.config.apiUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ operations: ops }),
    });

    if (!response.ok) {
      throw new Error(`Push failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      accepted: data.data.accepted,
      acceptedIds: data.data.acceptedIds,
    };
  }

  private async pullChanges(
    token: string,
    since: HLCTimestamp | null
  ): Promise<{ applied: number; conflicts: number; serverTimestamp: HLCTimestamp | null }> {
    const params = new URLSearchParams();
    if (since) {
      params.set('since', HybridLogicalClock.serialize(since));
    }

    const response = await fetch(
      `${this.config.apiUrl}/api/v1/sync/pull?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.status}`);
    }

    const data = await response.json();
    const operations: Operation[] = data.data.operations;
    const serverTimestamp = data.data.timestamp
      ? HybridLogicalClock.parse(data.data.timestamp)
      : null;

    let applied = 0;
    let conflicts = 0;

    // Apply operations
    for (const op of operations) {
      // Parse timestamp if it's serialized
      if (typeof op.timestamp === 'string') {
        op.timestamp = HybridLogicalClock.parse(op.timestamp);
      }

      let success = false;
      if (op.entityType === 'vocabulary') {
        success = this.vocabulary.apply(op as any);
      } else if (op.entityType === 'cards') {
        success = this.cards.apply(op as any);
      }

      if (success) {
        applied++;
      } else {
        conflicts++;
      }
    }

    return { applied, conflicts, serverTimestamp };
  }

  private async saveToStorage(): Promise<void> {
    // Save vocabulary
    const vocabState = this.vocabulary.serialize();
    await this.storage.putVocabularyBatch(Object.values(vocabState));

    // Save cards
    const cardsState = this.cards.serialize();
    await this.storage.putCardsBatch(Object.values(cardsState));
  }

  private handleOnline(): void {
    this.isOnline = true;
    this.setStatus('idle');
    // Trigger sync when coming online
    this.sync().catch(console.error);
  }

  private handleOffline(): void {
    this.isOnline = false;
    this.setStatus('offline');
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.listeners.forEach((fn) => fn(status));
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(fn: (status: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Get current status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Get last error
   */
  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Check if online
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get pending operations count
   */
  async getPendingCount(): Promise<number> {
    return this.storage.getPendingOpsCount();
  }

  // Data access methods
  getVocabulary(): VocabularyMap {
    return this.vocabulary;
  }

  getCards(): CardsMap {
    return this.cards;
  }

  getClock(): HybridLogicalClock {
    return this.clock;
  }

  /**
   * Add vocabulary word
   */
  async addVocabularyWord(word: Parameters<VocabularyMap['set']>[0]): Promise<void> {
    const op = this.vocabulary.set(word);
    await this.storage.addPendingOp(op);
    await this.storage.putVocabulary({
      value: word,
      timestamp: op.timestamp,
      deleted: false,
    });
  }

  /**
   * Delete vocabulary word
   */
  async deleteVocabularyWord(id: string): Promise<void> {
    const op = this.vocabulary.delete(id);
    if (op) {
      await this.storage.addPendingOp(op);
    }
  }

  /**
   * Add card
   */
  async addCard(card: Parameters<CardsMap['set']>[0]): Promise<void> {
    const op = this.cards.set(card);
    await this.storage.addPendingOp(op);
    await this.storage.putCard({
      value: card,
      timestamp: op.timestamp,
      deleted: false,
    });
  }

  /**
   * Delete card
   */
  async deleteCard(id: string): Promise<void> {
    const op = this.cards.delete(id);
    if (op) {
      await this.storage.addPendingOp(op);
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.stopAutoSync();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => this.handleOnline());
      window.removeEventListener('offline', () => this.handleOffline());
    }
    this.listeners.clear();
  }
}

// Singleton instance
let engineInstance: SyncEngine | null = null;

export function createSyncEngine(config: SyncConfig): SyncEngine {
  if (engineInstance) {
    engineInstance.destroy();
  }
  engineInstance = new SyncEngine(config);
  return engineInstance;
}

export function getSyncEngine(): SyncEngine | null {
  return engineInstance;
}
