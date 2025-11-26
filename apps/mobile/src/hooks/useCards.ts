import { create } from 'zustand';
import { useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from './useAuth';

export interface Card {
  id: string;
  word: string;
  pinyin?: string;
  definitions: string[];
  sentence?: string;
  translation?: string;
  audioUrl?: string;

  // SRS fields
  repetitions: number;
  easeFactor: number;
  interval: number;
  nextReview: string | null;
  lastReview: string | null;

  createdAt: string;
  updatedAt: string;
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

interface CardsState {
  items: Card[];
  loading: boolean;
  error: string | null;

  // Actions
  setItems: (items: Card[]) => void;
  addItem: (item: Card) => void;
  updateItem: (id: string, updates: Partial<Card>) => void;
  removeItem: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const useCardsStore = create<CardsState>((set) => ({
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

export function useCards() {
  const store = useCardsStore();
  const authStore = useAuthStore();

  const fetchCards = useCallback(async () => {
    if (!authStore.session?.accessToken) {
      return;
    }

    store.setLoading(true);
    store.setError(null);

    try {
      const response = await fetch(`${API_URL}/api/cards`, {
        headers: {
          Authorization: `Bearer ${authStore.session.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cards');
      }

      const data = await response.json();
      store.setItems(data.items || []);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to fetch cards');
    } finally {
      store.setLoading(false);
    }
  }, [authStore.session?.accessToken]);

  useEffect(() => {
    if (authStore.isAuthenticated) {
      fetchCards();
    }
  }, [authStore.isAuthenticated, fetchCards]);

  const dueCards = useMemo(() => {
    const now = new Date();
    return store.items.filter((card) => {
      if (!card.nextReview) return true; // New cards
      return new Date(card.nextReview) <= now;
    });
  }, [store.items]);

  const reviewCard = useCallback(async (cardId: string, rating: ReviewRating) => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/cards/${cardId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.session.accessToken}`,
      },
      body: JSON.stringify({ rating }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit review');
    }

    const updatedCard = await response.json();
    store.updateItem(cardId, updatedCard);
    return updatedCard;
  }, [authStore.session?.accessToken]);

  const createCard = useCallback(async (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt' | 'repetitions' | 'easeFactor' | 'interval' | 'nextReview' | 'lastReview'>) => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.session.accessToken}`,
      },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      throw new Error('Failed to create card');
    }

    const newCard = await response.json();
    store.addItem(newCard);
    return newCard;
  }, [authStore.session?.accessToken]);

  const deleteCard = useCallback(async (id: string) => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }

    store.removeItem(id);

    try {
      const response = await fetch(`${API_URL}/api/cards/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authStore.session.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete card');
      }
    } catch (error) {
      await fetchCards();
      throw error;
    }
  }, [authStore.session?.accessToken, fetchCards]);

  return {
    items: store.items,
    dueCards,
    loading: store.loading,
    error: store.error,
    refresh: fetchCards,
    reviewCard,
    createCard,
    deleteCard,
  };
}
