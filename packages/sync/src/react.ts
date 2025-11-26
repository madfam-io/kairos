/**
 * React hooks for sync functionality
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import {
  createSyncEngine,
  getSyncEngine,
  type SyncEngine,
  type SyncConfig,
  type SyncStatus,
  type SyncResult,
} from './engine';

// Context
const SyncContext = createContext<SyncEngine | null>(null);

export interface SyncProviderProps {
  children: ReactNode;
  config: SyncConfig;
  autoSync?: boolean;
}

/**
 * Sync provider component
 */
export function SyncProvider({ children, config, autoSync = true }: SyncProviderProps) {
  const [engine, setEngine] = useState<SyncEngine | null>(null);

  useEffect(() => {
    const syncEngine = createSyncEngine(config);

    syncEngine.init().then(() => {
      setEngine(syncEngine);
      if (autoSync) {
        syncEngine.startAutoSync();
      }
    });

    return () => {
      syncEngine.destroy();
    };
  }, [config, autoSync]);

  return <SyncContext.Provider value={engine}>{children}</SyncContext.Provider>;
}

/**
 * Hook to get the sync engine
 */
export function useSyncEngine(): SyncEngine | null {
  return useContext(SyncContext);
}

/**
 * Hook for sync status
 */
export function useSyncStatus(): {
  status: SyncStatus;
  isOnline: boolean;
  pendingCount: number;
  lastError: Error | null;
} {
  const engine = useSyncEngine();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!engine) return;

    setStatus(engine.getStatus());

    const unsubscribe = engine.onStatusChange(setStatus);

    // Update pending count periodically
    const updatePending = async () => {
      const count = await engine.getPendingCount();
      setPendingCount(count);
    };
    updatePending();
    const interval = setInterval(updatePending, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [engine]);

  return {
    status,
    isOnline: engine?.getIsOnline() ?? true,
    pendingCount,
    lastError: engine?.getLastError() ?? null,
  };
}

/**
 * Hook to trigger manual sync
 */
export function useSync(): {
  sync: () => Promise<SyncResult>;
  isSyncing: boolean;
} {
  const engine = useSyncEngine();
  const [isSyncing, setIsSyncing] = useState(false);

  const sync = useCallback(async () => {
    if (!engine) {
      throw new Error('Sync engine not initialized');
    }

    setIsSyncing(true);
    try {
      return await engine.sync();
    } finally {
      setIsSyncing(false);
    }
  }, [engine]);

  return { sync, isSyncing };
}

/**
 * Hook for vocabulary data with sync
 */
export function useVocabulary() {
  const engine = useSyncEngine();
  const [items, setItems] = useState<ReturnType<typeof engine.getVocabulary>['getAll'] extends () => infer R ? R : never>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!engine) return;

    const vocab = engine.getVocabulary();
    setItems(vocab.getAll());
    setLoading(false);

    // Re-fetch after sync
    const unsubscribe = engine.onStatusChange((status) => {
      if (status === 'idle') {
        setItems(vocab.getAll());
      }
    });

    return unsubscribe;
  }, [engine]);

  const addWord = useCallback(
    async (word: Parameters<SyncEngine['addVocabularyWord']>[0]) => {
      if (!engine) throw new Error('Sync engine not initialized');
      await engine.addVocabularyWord(word);
      setItems(engine.getVocabulary().getAll());
    },
    [engine]
  );

  const deleteWord = useCallback(
    async (id: string) => {
      if (!engine) throw new Error('Sync engine not initialized');
      await engine.deleteVocabularyWord(id);
      setItems(engine.getVocabulary().getAll());
    },
    [engine]
  );

  const getWord = useCallback(
    (id: string) => {
      if (!engine) return undefined;
      return engine.getVocabulary().get(id);
    },
    [engine]
  );

  return {
    items,
    loading,
    addWord,
    deleteWord,
    getWord,
  };
}

/**
 * Hook for cards data with sync
 */
export function useCards() {
  const engine = useSyncEngine();
  const [items, setItems] = useState<ReturnType<typeof engine.getCards>['getAll'] extends () => infer R ? R : never>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!engine) return;

    const cards = engine.getCards();
    setItems(cards.getAll());
    setLoading(false);

    const unsubscribe = engine.onStatusChange((status) => {
      if (status === 'idle') {
        setItems(cards.getAll());
      }
    });

    return unsubscribe;
  }, [engine]);

  const addCard = useCallback(
    async (card: Parameters<SyncEngine['addCard']>[0]) => {
      if (!engine) throw new Error('Sync engine not initialized');
      await engine.addCard(card);
      setItems(engine.getCards().getAll());
    },
    [engine]
  );

  const deleteCard = useCallback(
    async (id: string) => {
      if (!engine) throw new Error('Sync engine not initialized');
      await engine.deleteCard(id);
      setItems(engine.getCards().getAll());
    },
    [engine]
  );

  const getCard = useCallback(
    (id: string) => {
      if (!engine) return undefined;
      return engine.getCards().get(id);
    },
    [engine]
  );

  return {
    items,
    loading,
    addCard,
    deleteCard,
    getCard,
  };
}

/**
 * Hook for due cards (SRS)
 */
export function useDueCards() {
  const engine = useSyncEngine();
  const [dueCards, setDueCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!engine) return;

    const loadDueCards = async () => {
      const storage = await import('./storage').then((m) => m.getSyncStorage());
      const due = await storage.getDueCards();
      setDueCards(due.filter((r) => !r.deleted).map((r) => r.value));
      setLoading(false);
    };

    loadDueCards();

    const unsubscribe = engine.onStatusChange((status) => {
      if (status === 'idle') {
        loadDueCards();
      }
    });

    return unsubscribe;
  }, [engine]);

  return { dueCards, loading };
}

// Re-export types
export type { SyncConfig, SyncResult, SyncStatus } from './engine';
