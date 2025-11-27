/**
 * Core Relations - Defined separately to avoid circular dependencies
 */

import { relations } from 'drizzle-orm';
import { users, vocabulary, cards, userStats } from './core';
import { analyticsEvents } from './analytics';

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  vocabulary: many(vocabulary),
  cards: many(cards),
  analyticsEvents: many(analyticsEvents),
}));

// Vocabulary relations
export const vocabularyRelations = relations(vocabulary, ({ one }) => ({
  user: one(users, {
    fields: [vocabulary.userId],
    references: [users.id],
  }),
}));

// Cards relations
export const cardsRelations = relations(cards, ({ one }) => ({
  user: one(users, {
    fields: [cards.userId],
    references: [users.id],
  }),
}));

// User stats relations
export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, {
    fields: [userStats.userId],
    references: [users.id],
  }),
}));
