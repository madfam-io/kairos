/**
 * Data sync type definitions (CRDT-based offline-first)
 */

/**
 * Sync operation types
 */
export interface SyncPushRequest {
  clientId: string;
  lastSyncTimestamp: Date | null;
  changes: SyncChange[];
}

export interface SyncPullRequest {
  clientId: string;
  lastSyncTimestamp: Date | null;
  collections?: SyncCollection[];
}

export interface SyncPullResponse {
  changes: SyncChange[];
  serverTimestamp: Date;
  hasMore: boolean;
}

export interface SyncPushResponse {
  accepted: string[]; // IDs of accepted changes
  conflicts: SyncConflict[];
  serverTimestamp: Date;
}

export type SyncCollection = 'vocabulary' | 'cards' | 'settings';

export interface SyncChange {
  id: string;
  collection: SyncCollection;
  operation: 'create' | 'update' | 'delete';
  documentId: string;
  data: Record<string, unknown> | null;
  timestamp: Date;
  clientId: string;
  vectorClock: VectorClock;
}

/**
 * Vector clock for conflict detection
 */
export type VectorClock = Record<string, number>;

/**
 * Conflict resolution
 */
export interface SyncConflict {
  changeId: string;
  documentId: string;
  collection: SyncCollection;
  clientVersion: SyncChange;
  serverVersion: SyncChange;
  suggestedResolution: ConflictResolution;
}

export type ConflictResolution =
  | { type: 'use_client' }
  | { type: 'use_server' }
  | { type: 'merge'; mergedData: Record<string, unknown> }
  | { type: 'manual_required' };

export interface SyncResolveRequest {
  resolutions: Array<{
    conflictId: string;
    resolution: ConflictResolution;
  }>;
}

/**
 * Sync state tracking
 */
export interface SyncState {
  lastSyncTimestamp: Date | null;
  pendingChanges: SyncChange[];
  conflicts: SyncConflict[];
  syncStatus: SyncStatus;
}

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'error'
  | 'offline'
  | 'conflict';

export interface SyncProgress {
  status: SyncStatus;
  pendingCount: number;
  conflictCount: number;
  lastSyncAt: Date | null;
  error?: string;
}
