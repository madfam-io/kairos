import { create } from 'zustand';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { useAuthStore } from './useAuth';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  isOnline: boolean;
  lastSyncTime: number | null;
  error: string | null;

  // Actions
  setOnline: (online: boolean) => void;
  setPendingCount: (count: number) => void;
  startSync: () => void;
  syncComplete: () => void;
  syncError: (error: string) => void;
  triggerSync: () => Promise<void>;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  pendingCount: 0,
  isOnline: true,
  lastSyncTime: null,
  error: null,

  setOnline: (online: boolean) => {
    set({ isOnline: online, status: online ? 'idle' : 'offline' });
  },

  setPendingCount: (count: number) => {
    set({ pendingCount: count });
  },

  startSync: () => {
    set({ status: 'syncing', error: null });
  },

  syncComplete: () => {
    set({ status: 'idle', lastSyncTime: Date.now(), pendingCount: 0 });
  },

  syncError: (error: string) => {
    set({ status: 'error', error });
  },

  triggerSync: async () => {
    const { isOnline, status } = get();
    const authStore = useAuthStore.getState();

    if (!isOnline || status === 'syncing' || !authStore.session?.accessToken) {
      return;
    }

    set({ status: 'syncing', error: null });

    try {
      const response = await fetch(`${API_URL}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.session.accessToken}`,
        },
        body: JSON.stringify({
          changes: [], // Would contain actual changes from local storage
          lastSync: get().lastSyncTime,
        }),
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const data = await response.json();

      set({
        status: 'idle',
        lastSyncTime: Date.now(),
        pendingCount: 0,
      });

      return data;
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  },
}));

export function useSyncStatus() {
  const store = useSyncStore();

  useEffect(() => {
    // Listen for network state changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      store.setOnline(state.isConnected ?? false);
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      store.setOnline(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    status: store.status,
    pendingCount: store.pendingCount,
    isOnline: store.isOnline,
    lastSyncTime: store.lastSyncTime,
    error: store.error,
    triggerSync: store.triggerSync,
  };
}

export function useSync() {
  const store = useSyncStore();

  return {
    ...useSyncStatus(),
    startSync: store.startSync,
    syncComplete: store.syncComplete,
    syncError: store.syncError,
  };
}
