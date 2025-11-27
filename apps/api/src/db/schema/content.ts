/**
 * Content Schema - Simplification Cache, Show Simplifications, Grammar Patterns
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Simplification cache - reduces LLM costs
 */
export const simplificationCache = pgTable(
  'simplification_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    originalText: text('original_text').notNull(),
    hskLevel: integer('hsk_level').notNull(),
    simplifiedText: text('simplified_text').notNull(),
    modelVersion: text('model_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    hitCount: integer('hit_count').default(1).notNull(),
  },
  (table) => ({
    originalLevelUnique: uniqueIndex('cache_original_level_idx').on(
      table.originalText,
      table.hskLevel
    ),
  })
);

/**
 * Pre-computed show simplifications
 */
export const showSimplifications = pgTable(
  'show_simplifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    showId: text('show_id').notNull(),
    episode: integer('episode').notNull(),
    subtitleIndex: integer('subtitle_index').notNull(),
    originalText: text('original_text').notNull(),
    hsk3Text: text('hsk3_text'),
    hsk4Text: text('hsk4_text'),
    hsk5Text: text('hsk5_text'),
    verified: boolean('verified').default(false).notNull(),
  },
  (table) => ({
    showEpisodeSubtitleUnique: uniqueIndex('show_episode_subtitle_idx').on(
      table.showId,
      table.episode,
      table.subtitleIndex
    ),
  })
);

/**
 * Grammar patterns - pre-computed grammar explanations
 */
export const grammarPatterns = pgTable(
  'grammar_patterns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pattern: text('pattern').notNull(),
    patternZh: text('pattern_zh').notNull(),
    name: text('name').notNull(),
    nameZh: text('name_zh').notNull(),
    explanation: text('explanation').notNull(),
    explanationZh: text('explanation_zh'),
    structure: text('structure').notNull(),
    hskLevel: integer('hsk_level'),
    examples: jsonb('examples').notNull().default([]),
    relatedPatterns: jsonb('related_patterns').default([]),
    tags: jsonb('tags').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    patternIdx: uniqueIndex('grammar_pattern_idx').on(table.pattern),
    hskLevelIdx: index('grammar_hsk_level_idx').on(table.hskLevel),
  })
);
