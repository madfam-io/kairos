/**
 * Organization Decks Service
 *
 * Private content library management.
 */

import { eq, and, sql } from 'drizzle-orm';
import {
  db,
  organizationDecks,
  sharedDecks,
} from '../../db';
import { logAuditEvent } from './audit';

// =============================================================================
// Add Deck to Organization
// =============================================================================

export async function addOrgDeck(
  orgId: string,
  deckId: string,
  actorId: string,
  options?: { departmentId?: string; isRequired?: boolean }
): Promise<{ success: boolean; error?: string }> {
  // Verify deck exists
  const [deck] = await db.select().from(sharedDecks).where(eq(sharedDecks.id, deckId)).limit(1);

  if (!deck) {
    return { success: false, error: 'Deck not found' };
  }

  try {
    await db.insert(organizationDecks).values({
      organizationId: orgId,
      deckId,
      departmentId: options?.departmentId,
      isRequired: options?.isRequired ?? false,
      addedById: actorId,
    });

    await logAuditEvent(orgId, actorId, 'deck_added', 'deck', deckId, {
      deckName: deck.name,
      isRequired: options?.isRequired,
    });

    return { success: true };
  } catch {
    return { success: false, error: 'Deck already added' };
  }
}

// =============================================================================
// Get Organization Decks
// =============================================================================

export async function getOrgDecks(
  orgId: string,
  departmentId?: string
): Promise<Array<typeof sharedDecks.$inferSelect & { isRequired: boolean; addedAt: Date }>> {
  let query = db
    .select({
      deck: sharedDecks,
      isRequired: organizationDecks.isRequired,
      addedAt: organizationDecks.createdAt,
    })
    .from(organizationDecks)
    .innerJoin(sharedDecks, eq(organizationDecks.deckId, sharedDecks.id))
    .where(eq(organizationDecks.organizationId, orgId))
    .$dynamic();

  if (departmentId) {
    query = query.where(
      sql`(${organizationDecks.departmentId} = ${departmentId} OR ${organizationDecks.departmentId} IS NULL)`
    );
  }

  const decks = await query;

  return decks.map((d) => ({
    ...d.deck,
    isRequired: d.isRequired,
    addedAt: d.addedAt,
  }));
}

// =============================================================================
// Remove Deck from Organization
// =============================================================================

export async function removeOrgDeck(
  orgId: string,
  deckId: string,
  actorId: string
): Promise<{ success: boolean }> {
  const [removed] = await db
    .delete(organizationDecks)
    .where(and(eq(organizationDecks.organizationId, orgId), eq(organizationDecks.deckId, deckId)))
    .returning();

  if (removed) {
    await logAuditEvent(orgId, actorId, 'deck_removed', 'deck', deckId, {});
  }

  return { success: !!removed };
}
