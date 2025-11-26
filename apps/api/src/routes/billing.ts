import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import {
  createCheckoutSession,
  getSubscription,
  getSubscriptionTier,
  cancelSubscription,
  resumeSubscription,
  getCustomerPortalUrl,
  checkLimit,
  listProducts,
  getAvailableProviders,
  getProviderForCountry,
  getPricing,
  handleWebhook,
  TIER_LIMITS,
  type PaymentProvider,
} from '../services/billing';

const billing = new Hono<AppEnv>();

// Schema for provider parameter
const providerSchema = z.enum(['stripe', 'conekta', 'polar']);

// Get available providers and pricing (public)
billing.get('/providers', async (c) => {
  const providers = getAvailableProviders();
  const pricing = getPricing();

  return c.json({
    providers,
    pricing,
    recommended: 'stripe', // Default recommendation
  });
});

// Get recommended provider for a country (public)
billing.get('/providers/recommend/:countryCode', async (c) => {
  const countryCode = c.req.param('countryCode');
  const provider = getProviderForCountry(countryCode);
  const pricing = getPricing();

  return c.json({
    country: countryCode.toUpperCase(),
    provider,
    pricing: pricing[provider],
  });
});

// All other billing routes require authentication
billing.use('/*', requireAuth());

// Get current subscription status
billing.get('/subscription', async (c) => {
  const user = c.get('user');
  const organizationId = user.id;

  try {
    const [subscription, tier] = await Promise.all([
      getSubscription(organizationId),
      getSubscriptionTier(organizationId),
    ]);

    return c.json({
      subscription,
      tier,
      limits: TIER_LIMITS[tier],
      provider: subscription ? (subscription as any).provider : null,
    });
  } catch (error) {
    // Return free tier if no subscription found
    return c.json({
      subscription: null,
      tier: 'free' as const,
      limits: TIER_LIMITS.free,
      provider: null,
    });
  }
});

// Get available plans for a specific provider
billing.get('/plans', async (c) => {
  const provider = (c.req.query('provider') as PaymentProvider) || 'stripe';

  try {
    const products = await listProducts(provider);
    return c.json({ plans: products, provider });
  } catch (error) {
    return c.json({ error: 'Failed to fetch plans' }, 500);
  }
});

// Create checkout session
const checkoutSchema = z.object({
  tier: z.enum(['learner', 'immersion']),
  provider: providerSchema.optional(),
  countryCode: z.string().length(2).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  yearly: z.boolean().optional(),
});

billing.post('/checkout', zValidator('json', checkoutSchema), async (c) => {
  const user = c.get('user');
  const organizationId = user.id;
  const body = c.req.valid('json');

  try {
    const session = await createCheckoutSession(organizationId, body.tier, {
      provider: body.provider,
      countryCode: body.countryCode,
      email: user.email,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      yearly: body.yearly,
    });

    return c.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      provider: body.provider || getProviderForCountry(body.countryCode || 'US'),
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

// Get customer portal URL
billing.get('/portal', async (c) => {
  const user = c.get('user');
  const organizationId = user.id;
  const provider = (c.req.query('provider') as PaymentProvider) || undefined;

  try {
    // Get subscription to find provider if not specified
    const subscription = await getSubscription(organizationId, provider);
    if (!subscription) {
      return c.json({ error: 'No active subscription found' }, 404);
    }

    const activeProvider = provider || (subscription as any).provider || 'stripe';
    const url = await getCustomerPortalUrl(organizationId, activeProvider);
    return c.json({ portalUrl: url, provider: activeProvider });
  } catch (error) {
    return c.json({ error: 'Failed to get portal URL' }, 500);
  }
});

// Cancel subscription
const cancelSchema = z.object({
  subscriptionId: z.string(),
  provider: providerSchema,
  immediately: z.boolean().optional(),
});

billing.post('/cancel', zValidator('json', cancelSchema), async (c) => {
  const body = c.req.valid('json');

  try {
    const subscription = await cancelSubscription(
      body.subscriptionId,
      body.provider,
      !body.immediately // Cancel at period end by default
    );

    return c.json({ subscription });
  } catch (error) {
    return c.json({ error: 'Failed to cancel subscription' }, 500);
  }
});

// Resume subscription
const resumeSchema = z.object({
  subscriptionId: z.string(),
  provider: providerSchema,
});

billing.post('/resume', zValidator('json', resumeSchema), async (c) => {
  const body = c.req.valid('json');

  try {
    const subscription = await resumeSubscription(body.subscriptionId, body.provider);
    return c.json({ subscription });
  } catch (error) {
    return c.json({ error: 'Failed to resume subscription' }, 500);
  }
});

// Check usage limit
billing.get('/limits/:metric', async (c) => {
  const user = c.get('user');
  const organizationId = user.id;
  const metric = c.req.param('metric') as keyof typeof TIER_LIMITS.free;

  // Get current usage from request (could also fetch from DB)
  const currentUsage = parseInt(c.req.query('usage') || '0', 10);

  try {
    const result = await checkLimit(organizationId, metric, currentUsage);
    return c.json(result);
  } catch (error) {
    return c.json({ error: 'Failed to check limits' }, 500);
  }
});

export default billing;

// Webhook handlers (separate routes, no auth required)
export const billingWebhooks = new Hono();

// Stripe webhook
billingWebhooks.post('/webhooks/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  try {
    const payload = await c.req.text();
    await handleWebhook('stripe', payload, signature);
    return c.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return c.json({ error: 'Webhook handler failed' }, 400);
  }
});

// Conekta webhook
billingWebhooks.post('/webhooks/conekta', async (c) => {
  const signature = c.req.header('x-conekta-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  try {
    const payload = await c.req.text();
    await handleWebhook('conekta', payload, signature);
    return c.json({ received: true });
  } catch (error) {
    console.error('[Conekta Webhook] Error:', error);
    return c.json({ error: 'Webhook handler failed' }, 400);
  }
});

// Polar webhook
billingWebhooks.post('/webhooks/polar', async (c) => {
  const signature = c.req.header('x-polar-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  try {
    const payload = await c.req.text();
    await handleWebhook('polar', payload, signature);
    return c.json({ received: true });
  } catch (error) {
    console.error('[Polar Webhook] Error:', error);
    return c.json({ error: 'Webhook handler failed' }, 400);
  }
});
