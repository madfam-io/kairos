/**
 * Kairos Billing Service
 * Multi-provider payments via Janua plugins: Stripe, Conekta, Polar
 *
 * Provider selection:
 * - Stripe: Default for most regions (US, EU, etc.)
 * - Conekta: Mexico and Latin America
 * - Polar: Open source friendly, developer-focused
 */

import { JanuaClient } from '@janua/typescript-sdk';
import { createStripePlugin, type StripePlugin } from '@janua/typescript-sdk/plugins/stripe';
import { createConektaPlugin, type ConektaPlugin } from '@janua/typescript-sdk/plugins/conekta';
import { createPolarPlugin, type PolarPlugin } from '@janua/typescript-sdk/plugins/polar';

// Supported payment providers
export type PaymentProvider = 'stripe' | 'conekta' | 'polar';

// Kairos subscription tiers
export type SubscriptionTier = 'free' | 'learner' | 'immersion';

// Product IDs per provider
export const SUBSCRIPTION_PRODUCTS: Record<PaymentProvider, Record<Exclude<SubscriptionTier, 'free'>, string>> = {
  stripe: {
    learner: process.env.STRIPE_PRODUCT_LEARNER || 'price_learner',
    immersion: process.env.STRIPE_PRODUCT_IMMERSION || 'price_immersion',
  },
  conekta: {
    learner: process.env.CONEKTA_PRODUCT_LEARNER || 'plan_learner',
    immersion: process.env.CONEKTA_PRODUCT_IMMERSION || 'plan_immersion',
  },
  polar: {
    learner: process.env.POLAR_PRODUCT_LEARNER || 'prod_learner',
    immersion: process.env.POLAR_PRODUCT_IMMERSION || 'prod_immersion',
  },
};

// Tier limits (same across all providers)
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

// Pricing per provider (monthly USD equivalent)
export const TIER_PRICING: Record<PaymentProvider, Record<Exclude<SubscriptionTier, 'free'>, { monthly: number; yearly: number; currency: string }>> = {
  stripe: {
    learner: { monthly: 8, yearly: 80, currency: 'USD' },
    immersion: { monthly: 12, yearly: 120, currency: 'USD' },
  },
  conekta: {
    learner: { monthly: 149, yearly: 1490, currency: 'MXN' },
    immersion: { monthly: 229, yearly: 2290, currency: 'MXN' },
  },
  polar: {
    learner: { monthly: 8, yearly: 80, currency: 'USD' },
    immersion: { monthly: 12, yearly: 120, currency: 'USD' },
  },
};

// Country to provider mapping
const COUNTRY_PROVIDER_MAP: Record<string, PaymentProvider> = {
  MX: 'conekta',
  // Add more Latin American countries for Conekta
  AR: 'conekta',
  CO: 'conekta',
  CL: 'conekta',
  PE: 'conekta',
  // Default to Stripe for all others
};

// Singleton instances
let januaClient: JanuaClient | null = null;
let stripePlugin: StripePlugin | null = null;
let conektaPlugin: ConektaPlugin | null = null;
let polarPlugin: PolarPlugin | null = null;

/**
 * Initialize Janua client with all payment plugins
 */
function initializeJanuaClient(): JanuaClient {
  if (januaClient) return januaClient;

  januaClient = new JanuaClient({
    apiUrl: process.env.JANUA_API_URL || 'http://localhost:4000',
    publishableKey: process.env.JANUA_PUBLISHABLE_KEY!,
  });

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  // Initialize Stripe plugin
  if (process.env.STRIPE_SECRET_KEY) {
    stripePlugin = createStripePlugin({
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      products: SUBSCRIPTION_PRODUCTS.stripe,
      defaultSuccessUrl: `${appUrl}/settings?upgraded=true&provider=stripe`,
      defaultCancelUrl: `${appUrl}/settings?cancelled=true`,
      onCheckoutSuccess: async (session) => {
        console.log('[Stripe] Checkout successful:', session.id);
      },
      onSubscriptionChange: async (subscription) => {
        console.log('[Stripe] Subscription changed:', subscription.id, subscription.status);
      },
    });
    stripePlugin.install(januaClient);
  }

  // Initialize Conekta plugin
  if (process.env.CONEKTA_API_KEY) {
    conektaPlugin = createConektaPlugin({
      apiKey: process.env.CONEKTA_API_KEY,
      webhookKey: process.env.CONEKTA_WEBHOOK_KEY,
      products: SUBSCRIPTION_PRODUCTS.conekta,
      defaultSuccessUrl: `${appUrl}/settings?upgraded=true&provider=conekta`,
      defaultCancelUrl: `${appUrl}/settings?cancelled=true`,
      onCheckoutSuccess: async (session) => {
        console.log('[Conekta] Checkout successful:', session.id);
      },
      onSubscriptionChange: async (subscription) => {
        console.log('[Conekta] Subscription changed:', subscription.id, subscription.status);
      },
    });
    conektaPlugin.install(januaClient);
  }

  // Initialize Polar plugin
  if (process.env.POLAR_ACCESS_TOKEN) {
    polarPlugin = createPolarPlugin({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      organizationId: process.env.POLAR_ORGANIZATION_ID,
      products: SUBSCRIPTION_PRODUCTS.polar,
      defaultSuccessUrl: `${appUrl}/settings?upgraded=true&provider=polar`,
      defaultCancelUrl: `${appUrl}/settings?cancelled=true`,
      onCheckoutSuccess: async (session) => {
        console.log('[Polar] Checkout successful:', session.id);
      },
      onSubscriptionChange: async (subscription) => {
        console.log('[Polar] Subscription changed:', subscription.id, subscription.status);
      },
    });
    polarPlugin.install(januaClient);
  }

  return januaClient;
}

/**
 * Get the appropriate payment plugin for a provider
 */
function getPlugin(provider: PaymentProvider): StripePlugin | ConektaPlugin | PolarPlugin {
  initializeJanuaClient();

  switch (provider) {
    case 'stripe':
      if (!stripePlugin) throw new BillingError('PROVIDER_NOT_CONFIGURED', 'Stripe is not configured');
      return stripePlugin;
    case 'conekta':
      if (!conektaPlugin) throw new BillingError('PROVIDER_NOT_CONFIGURED', 'Conekta is not configured');
      return conektaPlugin;
    case 'polar':
      if (!polarPlugin) throw new BillingError('PROVIDER_NOT_CONFIGURED', 'Polar is not configured');
      return polarPlugin;
    default:
      throw new BillingError('INVALID_PROVIDER', `Unknown provider: ${provider}`);
  }
}

/**
 * Determine the best payment provider for a user based on their country
 */
export function getProviderForCountry(countryCode: string): PaymentProvider {
  return COUNTRY_PROVIDER_MAP[countryCode.toUpperCase()] || 'stripe';
}

/**
 * Get available payment providers
 */
export function getAvailableProviders(): PaymentProvider[] {
  initializeJanuaClient();
  const providers: PaymentProvider[] = [];
  if (stripePlugin) providers.push('stripe');
  if (conektaPlugin) providers.push('conekta');
  if (polarPlugin) providers.push('polar');
  return providers;
}

/**
 * Get Janua client instance
 */
export function getJanuaClient(): JanuaClient {
  return initializeJanuaClient();
}

/**
 * Create checkout session for a subscription tier
 */
export async function createCheckoutSession(
  organizationId: string,
  tier: 'learner' | 'immersion',
  options: {
    provider?: PaymentProvider;
    email?: string;
    countryCode?: string;
    successUrl?: string;
    cancelUrl?: string;
    yearly?: boolean;
  } = {}
) {
  // Determine provider from explicit choice, country, or default
  const provider = options.provider ||
    (options.countryCode ? getProviderForCountry(options.countryCode) : 'stripe');

  const plugin = getPlugin(provider);

  return plugin.createCheckout({
    plan: tier,
    organizationId,
    email: options.email,
    successUrl: options.successUrl,
    cancelUrl: options.cancelUrl,
    metadata: {
      tier,
      provider,
      source: 'kairos',
      yearly: options.yearly ? 'true' : 'false',
    },
  });
}

/**
 * Get active subscription for an organization
 * Checks all configured providers
 */
export async function getSubscription(organizationId: string, provider?: PaymentProvider) {
  if (provider) {
    const plugin = getPlugin(provider);
    return plugin.getSubscription(organizationId);
  }

  // Check all providers
  const providers = getAvailableProviders();
  for (const p of providers) {
    try {
      const plugin = getPlugin(p);
      const subscription = await plugin.getSubscription(organizationId);
      if (subscription) {
        return { ...subscription, provider: p };
      }
    } catch {
      // Continue to next provider
    }
  }

  return null;
}

/**
 * Get subscription tier from subscription data
 */
export async function getSubscriptionTier(organizationId: string): Promise<SubscriptionTier> {
  const providers = getAvailableProviders();

  for (const provider of providers) {
    try {
      const plugin = getPlugin(provider);

      // Check for immersion plan first (higher tier)
      if (await plugin.hasPlan(organizationId, 'immersion')) {
        return 'immersion';
      }

      // Check for learner plan
      if (await plugin.hasPlan(organizationId, 'learner')) {
        return 'learner';
      }
    } catch {
      // Continue to next provider
    }
  }

  return 'free';
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(organizationId: string): Promise<boolean> {
  const providers = getAvailableProviders();

  for (const provider of providers) {
    try {
      const plugin = getPlugin(provider);
      if (await plugin.hasActiveSubscription(organizationId)) {
        return true;
      }
    } catch {
      // Continue to next provider
    }
  }

  return false;
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  provider: PaymentProvider,
  cancelAtPeriodEnd = true
) {
  const plugin = getPlugin(provider);
  return plugin.cancelSubscription(subscriptionId, cancelAtPeriodEnd);
}

/**
 * Resume cancelled subscription
 */
export async function resumeSubscription(subscriptionId: string, provider: PaymentProvider) {
  const plugin = getPlugin(provider);
  return plugin.resumeSubscription(subscriptionId);
}

/**
 * Get customer portal URL
 */
export async function getCustomerPortalUrl(organizationId: string, provider: PaymentProvider) {
  const plugin = getPlugin(provider);
  return plugin.getCustomerPortalUrl(organizationId);
}

/**
 * Track usage for metered billing (AI simplifications)
 */
export async function trackUsage(
  organizationId: string,
  metric: string,
  quantity: number = 1,
  provider?: PaymentProvider
) {
  // Find active subscription provider
  const subscription = await getSubscription(organizationId, provider);
  if (!subscription) return;

  const activeProvider = provider || (subscription as any).provider || 'stripe';
  const plugin = getPlugin(activeProvider);

  return plugin.ingestUsage(organizationId, {
    name: metric,
    value: quantity,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get usage summary for billing period
 */
export async function getUsageSummary(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  provider?: PaymentProvider
) {
  const subscription = await getSubscription(organizationId, provider);
  if (!subscription) return null;

  const activeProvider = provider || (subscription as any).provider || 'stripe';
  const plugin = getPlugin(activeProvider);

  return plugin.getUsageSummary(
    organizationId,
    startDate.toISOString(),
    endDate.toISOString()
  );
}

/**
 * Check if user can perform action based on their tier limits
 */
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

/**
 * List available products/plans for a provider
 */
export async function listProducts(provider: PaymentProvider = 'stripe') {
  const plugin = getPlugin(provider);
  return plugin.listProducts();
}

/**
 * Get pricing information for all tiers and providers
 */
export function getPricing(): typeof TIER_PRICING {
  return TIER_PRICING;
}

/**
 * Handle webhook from any provider
 */
export async function handleWebhook(
  provider: PaymentProvider,
  payload: string | Buffer,
  signature: string
): Promise<void> {
  const plugin = getPlugin(provider);
  return plugin.handleWebhook(payload, signature);
}

/**
 * Billing error class
 */
export class BillingError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BillingError';
    this.code = code;
  }
}
