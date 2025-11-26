/**
 * Vocabulary-related type definitions
 */

import type { HSKLevel } from './user';

export interface VocabularyWord {
  id: string;
  userId: string;
  word: string;
  pinyin: string | null;
  definition: string | null;
  hskLevel: HSKLevel | null;
  status: VocabularyStatus;
  easeFactor: number;
  nextReview: Date | null;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type VocabularyStatus = 'new' | 'learning' | 'known';

export interface VocabularyBatchInput {
  words: Array<{
    word: string;
    pinyin?: string;
    definition?: string;
    status?: VocabularyStatus;
  }>;
}

export interface VocabularyUpdateInput {
  pinyin?: string;
  definition?: string;
  status?: VocabularyStatus;
  easeFactor?: number;
  nextReview?: Date;
}

export interface VocabularyQuery {
  status?: VocabularyStatus;
  hskLevel?: HSKLevel;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'nextReview' | 'word';
  sortOrder?: 'asc' | 'desc';
}

export interface VocabularyStats {
  total: number;
  new: number;
  learning: number;
  known: number;
  dueForReview: number;
  byHskLevel: Record<HSKLevel, number>;
}

/**
 * Spaced Repetition Algorithm (SM-2 variant)
 */
export interface SRSReviewResult {
  quality: SRSQuality;
  newEaseFactor: number;
  newInterval: number;
  nextReview: Date;
}

export type SRSQuality = 0 | 1 | 2 | 3 | 4 | 5;
// 0 - Complete blackout
// 1 - Incorrect, but remembered upon seeing answer
// 2 - Incorrect, but easy to recall
// 3 - Correct with difficulty
// 4 - Correct with hesitation
// 5 - Perfect recall
