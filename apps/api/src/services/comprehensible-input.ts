/**
 * Comprehensible Input Engine
 *
 * Analyzes content difficulty and provides personalized recommendations
 * based on the user's vocabulary knowledge (i+1 input hypothesis)
 */

import { getNLPClient } from './nlp-client';

export interface ContentAnalysis {
  // Overall difficulty metrics
  difficulty: 'beginner' | 'elementary' | 'intermediate' | 'upper-intermediate' | 'advanced';
  estimatedHSKLevel: number;
  comprehensibility: number; // 0-100% based on user's known words

  // Vocabulary breakdown
  vocabulary: {
    total: number;
    unique: number;
    knownCount: number;
    unknownCount: number;
    knownPercent: number;
  };

  // HSK distribution
  hskDistribution: {
    level1: number;
    level2: number;
    level3: number;
    level4: number;
    level5: number;
    level6: number;
    beyond: number;
  };

  // Key unknown words (most impactful for comprehension)
  keyUnknownWords: Array<{
    word: string;
    pinyin: string | null;
    hskLevel: number | null;
    frequency: number;
  }>;

  // Estimated reading time (minutes)
  estimatedReadingTime: number;
}

export interface ContentRecommendation {
  id: string;
  title: string;
  description: string;
  type: 'article' | 'video' | 'story' | 'dialogue';
  difficulty: ContentAnalysis['difficulty'];
  hskLevel: number;
  comprehensibility: number;
  duration?: number; // minutes
  thumbnailUrl?: string;
  sourceUrl?: string;
  tags: string[];
}

export interface UserProfile {
  vocabularySize: number;
  averageHSKLevel: number;
  knownWords: string[];
  preferredTopics: string[];
  recentlyViewed: string[];
}

/**
 * Analyze content difficulty for a given text
 */
export async function analyzeContent(
  text: string,
  knownWords: string[]
): Promise<ContentAnalysis> {
  const nlpClient = getNLPClient();
  const segmentResult = await nlpClient.segment(text);

  const knownSet = new Set(knownWords);
  const wordCounts = new Map<string, number>();
  const hskDistribution = {
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    level5: 0,
    level6: 0,
    beyond: 0,
  };

  let totalWords = 0;
  let knownCount = 0;
  let hskSum = 0;
  let hskWordCount = 0;

  // Analyze segments
  for (const seg of segmentResult.segments) {
    if (seg.is_punctuation) continue;

    totalWords++;
    wordCounts.set(seg.text, (wordCounts.get(seg.text) || 0) + 1);

    if (knownSet.has(seg.text)) {
      knownCount++;
    }

    if (seg.hsk_level) {
      hskSum += seg.hsk_level;
      hskWordCount++;
      const levelKey = `level${seg.hsk_level}` as keyof typeof hskDistribution;
      if (levelKey in hskDistribution) {
        hskDistribution[levelKey]++;
      }
    } else {
      hskDistribution.beyond++;
    }
  }

  const uniqueWords = wordCounts.size;
  const unknownCount = totalWords - knownCount;
  const knownPercent = totalWords > 0 ? Math.round((knownCount / totalWords) * 100) : 0;

  // Calculate average HSK level
  const avgHSKLevel = hskWordCount > 0 ? hskSum / hskWordCount : 3;
  const estimatedHSKLevel = Math.round(avgHSKLevel);

  // Determine difficulty
  const difficulty = getDifficultyFromHSK(estimatedHSKLevel);

  // Comprehensibility is based on known word percentage
  // Research suggests 95-98% comprehension for comfortable reading
  const comprehensibility = knownPercent;

  // Find key unknown words (high frequency, lower HSK level)
  const unknownWordsList = Array.from(wordCounts.entries())
    .filter(([word]) => !knownSet.has(word))
    .map(([word, freq]) => {
      const seg = segmentResult.segments.find((s) => s.text === word);
      return {
        word,
        pinyin: seg?.pinyin || null,
        hskLevel: seg?.hsk_level || null,
        frequency: freq,
      };
    })
    .sort((a, b) => {
      // Prioritize: high frequency + lower HSK level
      const aScore = (a.frequency * 10) - (a.hskLevel || 7);
      const bScore = (b.frequency * 10) - (b.hskLevel || 7);
      return bScore - aScore;
    })
    .slice(0, 10);

  // Estimate reading time (average 150-200 characters per minute for Chinese)
  const charactersPerMinute = 175;
  const estimatedReadingTime = Math.ceil(totalWords / charactersPerMinute);

  return {
    difficulty,
    estimatedHSKLevel,
    comprehensibility,
    vocabulary: {
      total: totalWords,
      unique: uniqueWords,
      knownCount,
      unknownCount,
      knownPercent,
    },
    hskDistribution,
    keyUnknownWords: unknownWordsList,
    estimatedReadingTime,
  };
}

/**
 * Get content recommendations based on user profile
 */
export async function getRecommendations(
  userProfile: UserProfile,
  options: {
    limit?: number;
    type?: ContentRecommendation['type'];
    minComprehensibility?: number;
    maxComprehensibility?: number;
  } = {}
): Promise<ContentRecommendation[]> {
  const {
    limit = 10,
    minComprehensibility = 70,
    maxComprehensibility = 95,
  } = options;

  // Calculate target HSK level (i+1)
  const targetHSKLevel = Math.min(userProfile.averageHSKLevel + 0.5, 6);

  // In a real implementation, this would query a content database
  // For now, return sample recommendations based on the profile
  const recommendations: ContentRecommendation[] = [
    {
      id: 'sample-1',
      title: '我的第一天',
      description: 'A simple story about a first day at school',
      type: 'story',
      difficulty: getDifficultyFromHSK(Math.round(targetHSKLevel)),
      hskLevel: Math.round(targetHSKLevel),
      comprehensibility: 85,
      duration: 5,
      tags: ['daily-life', 'school', 'beginner-friendly'],
    },
    {
      id: 'sample-2',
      title: '在咖啡店',
      description: 'A dialogue at a coffee shop',
      type: 'dialogue',
      difficulty: getDifficultyFromHSK(Math.round(targetHSKLevel)),
      hskLevel: Math.round(targetHSKLevel),
      comprehensibility: 80,
      duration: 3,
      tags: ['conversation', 'food', 'practical'],
    },
    {
      id: 'sample-3',
      title: '中国的四季',
      description: 'An article about the four seasons in China',
      type: 'article',
      difficulty: getDifficultyFromHSK(Math.round(targetHSKLevel) + 1),
      hskLevel: Math.round(targetHSKLevel) + 1,
      comprehensibility: 75,
      duration: 8,
      tags: ['culture', 'nature', 'intermediate'],
    },
  ];

  // Filter and sort by relevance
  return recommendations
    .filter((r) => {
      if (options.type && r.type !== options.type) return false;
      if (r.comprehensibility < minComprehensibility) return false;
      if (r.comprehensibility > maxComprehensibility) return false;
      return true;
    })
    .slice(0, limit);
}

/**
 * Calculate the optimal learning zone (i+1) for a user
 */
export function calculateOptimalLevel(userProfile: UserProfile): {
  currentLevel: number;
  targetLevel: number;
  readyForNextLevel: boolean;
  vocabularyNeeded: number;
} {
  const currentLevel = userProfile.averageHSKLevel;
  const targetLevel = Math.min(currentLevel + 1, 6);

  // HSK vocabulary requirements
  const hskVocabTargets: Record<number, number> = {
    1: 150,
    2: 300,
    3: 600,
    4: 1200,
    5: 2500,
    6: 5000,
  };

  const targetVocab = hskVocabTargets[Math.ceil(targetLevel)] || 5000;
  const vocabularyNeeded = Math.max(0, targetVocab - userProfile.vocabularySize);
  const readyForNextLevel = vocabularyNeeded === 0;

  return {
    currentLevel: Math.round(currentLevel * 10) / 10,
    targetLevel: Math.round(targetLevel * 10) / 10,
    readyForNextLevel,
    vocabularyNeeded,
  };
}

/**
 * Map HSK level to difficulty category
 */
function getDifficultyFromHSK(hskLevel: number): ContentAnalysis['difficulty'] {
  if (hskLevel <= 1) return 'beginner';
  if (hskLevel <= 2) return 'elementary';
  if (hskLevel <= 3) return 'intermediate';
  if (hskLevel <= 4) return 'upper-intermediate';
  return 'advanced';
}

export default {
  analyzeContent,
  getRecommendations,
  calculateOptimalLevel,
};
