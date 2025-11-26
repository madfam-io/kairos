import { create } from 'zustand';
import { useEffect, useCallback } from 'react';
import { useAuthStore } from './useAuth';

export type VocabularyStatus = 'new' | 'learning' | 'known';

export interface VocabularyItem {
  id: string;
  word: string;
  pinyin?: string;
  definitions: string[];
  hskLevel?: number;
  status: VocabularyStatus;
  sentence?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

interface VocabularyState {
  items: VocabularyItem[];
  loading: boolean;
  error: string | null;

  // Actions
  setItems: (items: VocabularyItem[]) => void;
  addItem: (item: VocabularyItem) => void;
  updateItem: (id: string, updates: Partial<VocabularyItem>) => void;
  removeItem: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const useVocabularyStore = create<VocabularyState>((set) => ({
  items: [],
  loading: false,
  error: null,

  setItems: (items) => set({ items }),

  addItem: (item) => set((state) => ({
    items: [item, ...state.items],
  })),

  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((item) =>
      item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
    ),
  })),

  removeItem: (id) => set((state) => ({
    items: state.items.filter((item) => item.id !== id),
  })),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

export function useVocabulary() {
  const store = useVocabularyStore();
  const authStore = useAuthStore();

  const fetchVocabulary = useCallback(async () => {
    if (!authStore.session?.accessToken) {
      return;
    }

    store.setLoading(true);
    store.setError(null);

    try {
      const response = await fetch(`${API_URL}/api/vocabulary`, {
        headers: {
          Authorization: `Bearer ${authStore.session.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch vocabulary');
      }

      const data = await response.json();
      store.setItems(data.items || []);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to fetch vocabulary');
    } finally {
      store.setLoading(false);
    }
  }, [authStore.session?.accessToken]);

  useEffect(() => {
    if (authStore.isAuthenticated) {
      fetchVocabulary();
    }
  }, [authStore.isAuthenticated, fetchVocabulary]);

  const addWord = useCallback(async (word: Omit<VocabularyItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/vocabulary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.session.accessToken}`,
      },
      body: JSON.stringify(word),
    });

    if (!response.ok) {
      throw new Error('Failed to add word');
    }

    const newItem = await response.json();
    store.addItem(newItem);
    return newItem;
  }, [authStore.session?.accessToken]);

  const updateWord = useCallback(async (id: string, updates: Partial<VocabularyItem>) => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }

    store.updateItem(id, updates);

    try {
      const response = await fetch(`${API_URL}/api/vocabulary/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.session.accessToken}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update word');
      }
    } catch (error) {
      // Revert on error
      await fetchVocabulary();
      throw error;
    }
  }, [authStore.session?.accessToken, fetchVocabulary]);

  const deleteWord = useCallback(async (id: string) => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }

    store.removeItem(id);

    try {
      const response = await fetch(`${API_URL}/api/vocabulary/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authStore.session.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete word');
      }
    } catch (error) {
      await fetchVocabulary();
      throw error;
    }
  }, [authStore.session?.accessToken, fetchVocabulary]);

  return {
    items: store.items,
    loading: store.loading,
    error: store.error,
    refresh: fetchVocabulary,
    addWord,
    updateWord,
    deleteWord,
  };
}
