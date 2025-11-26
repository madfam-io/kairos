import { create } from 'zustand';
import { useCallback, useEffect } from 'react';
import { Linking } from 'react-native';
import { useAuthStore } from './useAuth';

export type SubscriptionTier = 'free' | 'learner' | 'immersion';

export interface Subscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface TierLimits {
  cardsPerDay: number;
  reviewsPerDay: number;
  vocabularyLimit: number;
  aiSimplifications: number;
  ankiExport: boolean;
}

interface SubscriptionState {
  subscription: Subscription | null;
  tier: SubscriptionTier;
  limits: TierLimits;
  loading: boolean;
  error: string | null;

  // Actions
  setSubscription: (subscription: Subscription | null, tier: SubscriptionTier, limits: TierLimits) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const FREE_LIMITS: TierLimits = {
  cardsPerDay: 10,
  reviewsPerDay: 50,
  vocabularyLimit: 500,
  aiSimplifications: 0,
  ankiExport: false,
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  subscription: null,
  tier: 'free',
  limits: FREE_LIMITS,
  loading: false,
  error: null,

  setSubscription: (subscription, tier, limits) => set({ subscription, tier, limits }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

export function useSubscription() {
  const store = useSubscriptionStore();
  const authStore = useAuthStore();

  const fetchSubscription = useCallback(async () => {
    if (!authStore.session?.accessToken) {
      return;
    }

    store.setLoading(true);
    store.setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/billing/subscription`, {
        headers: {
          Authorization: `Bearer ${authStore.session.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }

      const data = await response.json();
      store.setSubscription(
        data.subscription,
        data.tier || 'free',
        data.limits || FREE_LIMITS
      );
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to fetch subscription');
      store.setSubscription(null, 'free', FREE_LIMITS);
    } finally {
      store.setLoading(false);
    }
  }, [authStore.session?.accessToken]);

  useEffect(() => {
    if (authStore.isAuthenticated) {
      fetchSubscription();
    }
  }, [authStore.isAuthenticated, fetchSubscription]);

  const upgrade = useCallback(async (tier: 'learner' | 'immersion') => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/v1/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.session.accessToken}`,
      },
      body: JSON.stringify({
        tier,
        successUrl: 'kairos://settings?upgraded=true',
        cancelUrl: 'kairos://settings?cancelled=true',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout');
    }

    const { checkoutUrl } = await response.json();

    // Open checkout URL in browser
    if (checkoutUrl) {
      await Linking.openURL(checkoutUrl);
    }
  }, [authStore.session?.accessToken]);

  const openPortal = useCallback(async () => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/v1/billing/portal`, {
      headers: {
        Authorization: `Bearer ${authStore.session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get portal URL');
    }

    const { portalUrl } = await response.json();

    if (portalUrl) {
      await Linking.openURL(portalUrl);
    }
  }, [authStore.session?.accessToken]);

  const cancel = useCallback(async () => {
    if (!authStore.session?.accessToken || !store.subscription) {
      throw new Error('No active subscription');
    }

    const response = await fetch(`${API_URL}/api/v1/billing/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.session.accessToken}`,
      },
      body: JSON.stringify({
        subscriptionId: store.subscription.id,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to cancel subscription');
    }

    await fetchSubscription();
  }, [authStore.session?.accessToken, store.subscription, fetchSubscription]);

  const resume = useCallback(async () => {
    if (!authStore.session?.accessToken || !store.subscription) {
      throw new Error('No subscription to resume');
    }

    const response = await fetch(`${API_URL}/api/v1/billing/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.session.accessToken}`,
      },
      body: JSON.stringify({
        subscriptionId: store.subscription.id,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to resume subscription');
    }

    await fetchSubscription();
  }, [authStore.session?.accessToken, store.subscription, fetchSubscription]);

  const checkLimit = useCallback((metric: keyof TierLimits, currentUsage: number) => {
    const limit = store.limits[metric];

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit: -1, remaining: -1 };
    }

    // Boolean limits
    if (typeof limit === 'boolean') {
      return { allowed: limit, limit: limit ? 1 : 0, remaining: limit ? 1 : 0 };
    }

    return {
      allowed: currentUsage < limit,
      limit,
      remaining: Math.max(0, limit - currentUsage),
    };
  }, [store.limits]);

  return {
    subscription: store.subscription,
    tier: store.tier,
    limits: store.limits,
    loading: store.loading,
    error: store.error,
    isPro: store.tier !== 'free',
    refresh: fetchSubscription,
    upgrade,
    openPortal,
    cancel,
    resume,
    checkLimit,
  };
}
