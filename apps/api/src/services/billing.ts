import { JanuaClient } from '@janua/typescript-sdk';
import { createPolarPlugin, type PolarPlugin } from '@janua/typescript-sdk/plugins/polar';

// Kairos subscription tiers mapped to Polar products
export const SUBSCRIPTION_PRODUCTS = {
  free: null, // No Polar product for free tier
  learner: process.env.POLAR_PRODUCT_LEARNER || 'prod_learner',
  immersion: process.env.POLAR_PRODUCT_IMMERSION || 'prod_immersion',
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_PRODUCTS;

// Tier limits
export const TIER_LIMITS = {
  free: {
    cardsPerDay: 10,
    reviewsPerDay: 50,
    vocabularyLimit: 500,
    aiSimplifications: 0,
    ankiExport: false,
  },
  learner: {
    cardsPerDay: 50,
    reviewsPerDay: 200,
    vocabularyLimit: 5000,
    aiSimplifications: 100,
    ankiExport: true,
  },
  immersion: {
    cardsPerDay: -1, // unlimited
    reviewsPerDay: -1, // unlimited
    vocabularyLimit: -1, // unlimited
    aiSimplifications: -1, // unlimited
    ankiExport: true,
  },
} as const;

let januaClient: JanuaClient | null = null;
let polarPlugin: PolarPlugin | null = null;

export function getJanuaClientWithBilling(): { client: JanuaClient; polar: PolarPlugin } {
  if (!januaClient || !polarPlugin) {
    januaClient = new JanuaClient({
      apiUrl: process.env.JANUA_API_URL || 'https://api.janua.dev',
      publishableKey: process.env.JANUA_PUBLISHABLE_KEY!,
    });

    polarPlugin = createPolarPlugin({
      products: {
        learner: SUBSCRIPTION_PRODUCTS.learner!,
        immersion: SUBSCRIPTION_PRODUCTS.immersion!,
      },
      defaultSuccessUrl: `${process.env.APP_URL}/settings?upgraded=true`,
      defaultCancelUrl: `${process.env.APP_URL}/settings?cancelled=true`,
      onCheckoutSuccess: async (session) => {
        console.log('Checkout successful:', session.id);
      },
      onSubscriptionChange: async (subscription) => {
        console.log('Subscription changed:', subscription.id, subscription.status);
      },
    });

    polarPlugin.install(januaClient);
  }

  return { client: januaClient, polar: polarPlugin };
}

// Create checkout session for a subscription tier
export async function createCheckoutSession(
  organizationId: string,
  tier: 'learner' | 'immersion',
  email?: string,
  successUrl?: string,
  cancelUrl?: string
) {
  const { polar } = getJanuaClientWithBilling();

  return polar.createCheckout({
    plan: tier,
    organizationId,
    email,
    successUrl,
    cancelUrl,
    metadata: {
      tier,
      source: 'kairos',
    },
  });
}

// Get active subscription for an organization
export async function getSubscription(organizationId: string) {
  const { polar } = getJanuaClientWithBilling();
  return polar.getSubscription(organizationId);
}

// Get subscription tier from subscription data
export async function getSubscriptionTier(organizationId: string): Promise<SubscriptionTier> {
  try {
    const { polar } = getJanuaClientWithBilling();

    // Check for immersion plan first (higher tier)
    if (await polar.hasPlan(organizationId, 'immersion')) {
      return 'immersion';
    }

    // Check for learner plan
    if (await polar.hasPlan(organizationId, 'learner')) {
      return 'learner';
    }

    return 'free';
  } catch {
    return 'free';
  }
}

// Check if user has active subscription
export async function hasActiveSubscription(organizationId: string): Promise<boolean> {
  const { polar } = getJanuaClientWithBilling();
  return polar.hasActiveSubscription(organizationId);
}

// Cancel subscription
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd = true
) {
  const { polar } = getJanuaClientWithBilling();
  return polar.cancelSubscription(subscriptionId, cancelAtPeriodEnd);
}

// Resume cancelled subscription
export async function resumeSubscription(subscriptionId: string) {
  const { polar } = getJanuaClientWithBilling();
  return polar.resumeSubscription(subscriptionId);
}

// Get customer portal URL
export async function getCustomerPortalUrl(organizationId: string) {
  const { polar } = getJanuaClientWithBilling();
  return polar.getCustomerPortalUrl(organizationId);
}

// Track usage for metered billing (AI simplifications)
export async function trackUsage(
  organizationId: string,
  metric: string,
  quantity: number = 1
) {
  const { polar } = getJanuaClientWithBilling();
  return polar.ingestUsage(organizationId, {
    name: metric,
    value: quantity,
    timestamp: new Date().toISOString(),
  });
}

// Get usage summary for billing period
export async function getUsageSummary(
  organizationId: string,
  startDate: Date,
  endDate: Date
) {
  const { polar } = getJanuaClientWithBilling();
  return polar.getUsageSummary(
    organizationId,
    startDate.toISOString(),
    endDate.toISOString()
  );
}

// Check if user can perform action based on their tier limits
export async function checkLimit(
  organizationId: string,
  metric: keyof typeof TIER_LIMITS.free,
  currentUsage: number
): Promise<{ allowed: boolean; limit: number; remaining: number; tier: SubscriptionTier }> {
  const tier = await getSubscriptionTier(organizationId);
  const limit = TIER_LIMITS[tier][metric];

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, limit: -1, remaining: -1, tier };
  }

  // Boolean limits (like ankiExport)
  if (typeof limit === 'boolean') {
    return { allowed: limit, limit: limit ? 1 : 0, remaining: limit ? 1 : 0, tier };
  }

  return {
    allowed: currentUsage < limit,
    limit,
    remaining: Math.max(0, limit - currentUsage),
    tier,
  };
}

// List available products/plans
export async function listProducts() {
  const { polar } = getJanuaClientWithBilling();
  return polar.listProducts();
}
