/**
 * CRDT (Conflict-free Replicated Data Types) implementations
 * Using Last-Writer-Wins (LWW) strategy with HLC timestamps
 */

import { HybridLogicalClock, type HLCTimestamp } from './hlc';

/**
 * Operation types for sync
 */
export type OperationType = 'create' | 'update' | 'delete';

/**
 * A single change operation
 */
export interface Operation<T = unknown> {
  id: string;
  entityId: string;
  entityType: string;
  type: OperationType;
  data: T | null;
  timestamp: HLCTimestamp;
  userId: string;
}

/**
 * LWW Register - stores a single value with timestamp
 */
export interface LWWRegister<T> {
  value: T;
  timestamp: HLCTimestamp;
  deleted: boolean;
}

/**
 * LWW Map - a map of LWW registers
 */
export class LWWMap<T extends { id: string }> {
  private items: Map<string, LWWRegister<T>> = new Map();
  private clock: HybridLogicalClock;
  private pendingOps: Operation<T>[] = [];

  constructor(clock: HybridLogicalClock) {
    this.clock = clock;
  }

  /**
   * Get all non-deleted items
   */
  getAll(): T[] {
    const result: T[] = [];
    for (const register of this.items.values()) {
      if (!register.deleted) {
        result.push(register.value);
      }
    }
    return result;
  }

  /**
   * Get a single item by ID
   */
  get(id: string): T | undefined {
    const register = this.items.get(id);
    if (register && !register.deleted) {
      return register.value;
    }
    return undefined;
  }

  /**
   * Check if an item exists
   */
  has(id: string): boolean {
    const register = this.items.get(id);
    return register !== undefined && !register.deleted;
  }

  /**
   * Set/create an item (local operation)
   */
  set(item: T): Operation<T> {
    const timestamp = this.clock.now();
    const existing = this.items.get(item.id);
    const type: OperationType = existing && !existing.deleted ? 'update' : 'create';

    this.items.set(item.id, {
      value: item,
      timestamp,
      deleted: false,
    });

    const op: Operation<T> = {
      id: `${timestamp.time}-${timestamp.counter}-${timestamp.node}`,
      entityId: item.id,
      entityType: this.getEntityType(),
      type,
      data: item,
      timestamp,
      userId: timestamp.node,
    };

    this.pendingOps.push(op);
    return op;
  }

  /**
   * Delete an item (local operation)
   */
  delete(id: string): Operation<T> | null {
    const existing = this.items.get(id);
    if (!existing || existing.deleted) {
      return null;
    }

    const timestamp = this.clock.now();

    this.items.set(id, {
      ...existing,
      timestamp,
      deleted: true,
    });

    const op: Operation<T> = {
      id: `${timestamp.time}-${timestamp.counter}-${timestamp.node}`,
      entityId: id,
      entityType: this.getEntityType(),
      type: 'delete',
      data: null,
      timestamp,
      userId: timestamp.node,
    };

    this.pendingOps.push(op);
    return op;
  }

  /**
   * Apply a remote operation
   */
  apply(op: Operation<T>): boolean {
    const existing = this.items.get(op.entityId);

    // Update clock with remote timestamp
    this.clock.receive(op.timestamp);

    // LWW: only apply if operation is newer
    if (existing && !HybridLogicalClock.isAfter(op.timestamp, existing.timestamp)) {
      return false; // Rejected - existing is newer or equal
    }

    if (op.type === 'delete') {
      if (existing) {
        this.items.set(op.entityId, {
          ...existing,
          timestamp: op.timestamp,
          deleted: true,
        });
      }
    } else if (op.data) {
      this.items.set(op.entityId, {
        value: op.data,
        timestamp: op.timestamp,
        deleted: false,
      });
    }

    return true;
  }

  /**
   * Apply multiple operations
   */
  applyBatch(ops: Operation<T>[]): number {
    // Sort by timestamp to ensure consistent ordering
    const sorted = [...ops].sort((a, b) =>
      HybridLogicalClock.compare(a.timestamp, b.timestamp)
    );

    let applied = 0;
    for (const op of sorted) {
      if (this.apply(op)) {
        applied++;
      }
    }
    return applied;
  }

  /**
   * Get and clear pending operations
   */
  getPendingOps(): Operation<T>[] {
    const ops = this.pendingOps;
    this.pendingOps = [];
    return ops;
  }

  /**
   * Check if there are pending operations
   */
  hasPendingOps(): boolean {
    return this.pendingOps.length > 0;
  }

  /**
   * Get all operations since a timestamp (for sync)
   */
  getOpsSince(since: HLCTimestamp | null): Operation<T>[] {
    const ops: Operation<T>[] = [];

    for (const [id, register] of this.items) {
      if (!since || HybridLogicalClock.isAfter(register.timestamp, since)) {
        ops.push({
          id: HybridLogicalClock.serialize(register.timestamp),
          entityId: id,
          entityType: this.getEntityType(),
          type: register.deleted ? 'delete' : 'update',
          data: register.deleted ? null : register.value,
          timestamp: register.timestamp,
          userId: register.timestamp.node,
        });
      }
    }

    return ops;
  }

  /**
   * Serialize the entire state
   */
  serialize(): Record<string, LWWRegister<T>> {
    const result: Record<string, LWWRegister<T>> = {};
    for (const [id, register] of this.items) {
      result[id] = register;
    }
    return result;
  }

  /**
   * Load state from serialized data
   */
  load(data: Record<string, LWWRegister<T>>): void {
    this.items.clear();
    for (const [id, register] of Object.entries(data)) {
      this.items.set(id, register);
    }
  }

  /**
   * Get the entity type (override in subclasses)
   */
  protected getEntityType(): string {
    return 'unknown';
  }
}

/**
 * Vocabulary-specific LWW Map
 */
export class VocabularyMap extends LWWMap<{
  id: string;
  word: string;
  pinyin: string | null;
  definitions: string[];
  hskLevel: number | null;
  status: 'new' | 'learning' | 'known';
  encounters: number;
  lastSeen: string;
  addedAt: string;
}> {
  protected getEntityType(): string {
    return 'vocabulary';
  }
}

/**
 * Cards-specific LWW Map
 */
export class CardsMap extends LWWMap<{
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
}> {
  protected getEntityType(): string {
    return 'cards';
  }
}
