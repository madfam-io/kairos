/**
 * Webhooks Service
 *
 * Manages webhook endpoints, deliveries, and event dispatching.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db, webhookEndpoints, webhookDeliveries } from '../../db';
import { type WebhookEvent, signWebhookPayload } from './types';

// =============================================================================
// Create Webhook
// =============================================================================

export async function createWebhook(
  userId: string,
  input: {
    url: string;
    description?: string;
    events: WebhookEvent[];
    applicationId?: string;
  }
): Promise<{ webhook: typeof webhookEndpoints.$inferSelect; secret: string }> {
  const secret = randomBytes(32).toString('hex');

  const [webhook] = await db
    .insert(webhookEndpoints)
    .values({
      userId,
      applicationId: input.applicationId,
      url: input.url,
      description: input.description,
      events: input.events,
      secret,
    })
    .returning();

  return { webhook, secret };
}

// =============================================================================
// Get User Webhooks
// =============================================================================

export async function getUserWebhooks(
  userId: string
): Promise<Array<typeof webhookEndpoints.$inferSelect>> {
  return db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.userId, userId))
    .orderBy(desc(webhookEndpoints.createdAt));
}

// =============================================================================
// Update Webhook
// =============================================================================

export async function updateWebhook(
  webhookId: string,
  userId: string,
  updates: Partial<{
    url: string;
    description: string;
    events: WebhookEvent[];
    isActive: boolean;
  }>
): Promise<typeof webhookEndpoints.$inferSelect | null> {
  const [webhook] = await db
    .update(webhookEndpoints)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(webhookEndpoints.id, webhookId), eq(webhookEndpoints.userId, userId)))
    .returning();

  return webhook ?? null;
}

// =============================================================================
// Delete Webhook
// =============================================================================

export async function deleteWebhook(webhookId: string, userId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, webhookId), eq(webhookEndpoints.userId, userId)))
    .returning();

  return !!deleted;
}

// =============================================================================
// Rotate Webhook Secret
// =============================================================================

export async function rotateWebhookSecret(
  webhookId: string,
  userId: string
): Promise<{ secret: string } | null> {
  const secret = randomBytes(32).toString('hex');

  const [webhook] = await db
    .update(webhookEndpoints)
    .set({ secret, updatedAt: new Date() })
    .where(and(eq(webhookEndpoints.id, webhookId), eq(webhookEndpoints.userId, userId)))
    .returning();

  if (!webhook) return null;

  return { secret };
}

// =============================================================================
// Get Webhooks for Event
// =============================================================================

export async function getWebhooksForEvent(
  userId: string,
  event: WebhookEvent
): Promise<Array<typeof webhookEndpoints.$inferSelect>> {
  const webhooks = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.userId, userId),
        eq(webhookEndpoints.isActive, true),
        sql`${webhookEndpoints.disabledAt} IS NULL`
      )
    );

  return webhooks.filter((w) => (w.events as WebhookEvent[]).includes(event));
}

// =============================================================================
// Webhook Deliveries
// =============================================================================

export async function createWebhookDelivery(
  endpointId: string,
  eventType: WebhookEvent,
  payload: Record<string, unknown>
): Promise<typeof webhookDeliveries.$inferSelect> {
  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({
      endpointId,
      eventType,
      payload,
      status: 'pending',
    })
    .returning();

  return delivery;
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: 'success' | 'failed',
  details: {
    responseStatus?: number;
    responseBody?: string;
    responseTimeMs?: number;
    errorMessage?: string;
  }
): Promise<void> {
  await db
    .update(webhookDeliveries)
    .set({
      status,
      responseStatus: details.responseStatus,
      responseBody: details.responseBody?.slice(0, 1000),
      responseTimeMs: details.responseTimeMs,
      errorMessage: details.errorMessage,
      completedAt: new Date(),
    })
    .where(eq(webhookDeliveries.id, deliveryId));

  // Update endpoint status
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);

  if (delivery) {
    if (status === 'success') {
      await db
        .update(webhookEndpoints)
        .set({
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: 'success',
          consecutiveFailures: 0,
        })
        .where(eq(webhookEndpoints.id, delivery.endpointId));
    } else {
      // Increment failures
      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, delivery.endpointId))
        .limit(1);

      if (endpoint) {
        const newFailures = endpoint.consecutiveFailures + 1;
        const shouldDisable = newFailures >= 10;

        await db
          .update(webhookEndpoints)
          .set({
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: 'failed',
            consecutiveFailures: newFailures,
            disabledAt: shouldDisable ? new Date() : null,
          })
          .where(eq(webhookEndpoints.id, delivery.endpointId));
      }
    }
  }
}

export async function getWebhookDeliveries(
  webhookId: string,
  userId: string,
  limit: number = 20
): Promise<Array<typeof webhookDeliveries.$inferSelect>> {
  // Verify ownership
  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, webhookId), eq(webhookEndpoints.userId, userId)))
    .limit(1);

  if (!endpoint) return [];

  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.endpointId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}

// =============================================================================
// Dispatch Webhook Event
// =============================================================================

export async function dispatchWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const webhooks = await getWebhooksForEvent(userId, event);

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  for (const webhook of webhooks) {
    const delivery = await createWebhookDelivery(webhook.id, event, payload);

    // Actually dispatch (would be async/queued in production)
    try {
      const startTime = Date.now();
      const payloadString = JSON.stringify(payload);
      const signature = signWebhookPayload(payloadString, webhook.secret);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kairos-Signature': `sha256=${signature}`,
          'X-Kairos-Event': event,
          'X-Kairos-Delivery-Id': delivery.id,
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const responseTimeMs = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await updateDeliveryStatus(delivery.id, 'success', {
          responseStatus: response.status,
          responseBody,
          responseTimeMs,
        });
      } else {
        await updateDeliveryStatus(delivery.id, 'failed', {
          responseStatus: response.status,
          responseBody,
          responseTimeMs,
          errorMessage: `HTTP ${response.status}`,
        });
      }
    } catch (error) {
      await updateDeliveryStatus(delivery.id, 'failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
