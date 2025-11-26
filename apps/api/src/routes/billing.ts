import { Hono } from 'hono';
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
  TIER_LIMITS,
} from '../services/billing';

const billing = new Hono<AppEnv>();

// All billing routes require authentication
billing.use('/*', requireAuth());

// Get current subscription status
billing.get('/subscription', async (c) => {
  const user = c.get('user');
  const organizationId = user.id; // Using user ID as org ID for individual users

  try {
    const [subscription, tier] = await Promise.all([
      getSubscription(organizationId),
      getSubscriptionTier(organizationId),
    ]);

    return c.json({
      subscription,
      tier,
      limits: TIER_LIMITS[tier],
    });
  } catch (error) {
    // Return free tier if no subscription found
    return c.json({
      subscription: null,
      tier: 'free' as const,
      limits: TIER_LIMITS.free,
    });
  }
});

// Get available plans
billing.get('/plans', async (c) => {
  try {
    const products = await listProducts();
    return c.json({ plans: products });
  } catch (error) {
    return c.json({ error: 'Failed to fetch plans' }, 500);
  }
});

// Create checkout session
billing.post('/checkout', async (c) => {
  const user = c.get('user');
  const organizationId = user.id;

  const body = await c.req.json<{
    tier: 'learner' | 'immersion';
    successUrl?: string;
    cancelUrl?: string;
  }>();

  if (!body.tier || !['learner', 'immersion'].includes(body.tier)) {
    return c.json({ error: 'Invalid tier. Must be "learner" or "immersion"' }, 400);
  }

  try {
    const session = await createCheckoutSession(
      organizationId,
      body.tier,
      user.email,
      body.successUrl,
      body.cancelUrl
    );

    return c.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

// Get customer portal URL
billing.get('/portal', async (c) => {
  const user = c.get('user');
  const organizationId = user.id;

  try {
    const url = await getCustomerPortalUrl(organizationId);
    return c.json({ portalUrl: url });
  } catch (error) {
    return c.json({ error: 'Failed to get portal URL' }, 500);
  }
});

// Cancel subscription
billing.post('/cancel', async (c) => {
  const user = c.get('user');

  const body = await c.req.json<{
    subscriptionId: string;
    immediately?: boolean;
  }>();

  if (!body.subscriptionId) {
    return c.json({ error: 'Subscription ID is required' }, 400);
  }

  try {
    const subscription = await cancelSubscription(
      body.subscriptionId,
      !body.immediately // Cancel at period end by default
    );

    return c.json({ subscription });
  } catch (error) {
    return c.json({ error: 'Failed to cancel subscription' }, 500);
  }
});

// Resume subscription
billing.post('/resume', async (c) => {
  const body = await c.req.json<{ subscriptionId: string }>();

  if (!body.subscriptionId) {
    return c.json({ error: 'Subscription ID is required' }, 400);
  }

  try {
    const subscription = await resumeSubscription(body.subscriptionId);
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
