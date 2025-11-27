/**
 * Database Seed Script
 * Seeds initial data for achievements, topics, and other reference data
 */

import { db } from './db';
import {
  achievementDefinitions,
  contentTopics,
  challengeDefinitions,
} from './db/schema';
import { log } from './lib/logger';

/**
 * Seed achievement definitions
 */
async function seedAchievements() {
  const achievements = [
    // Learning achievements
    { id: 'first_word', name: 'First Step', description: 'Learn your first word', category: 'learning', icon: '🌱', rarity: 'common', xpReward: 10, sortOrder: 1 },
    { id: 'words_10', name: 'Vocabulary Builder', description: 'Learn 10 words', category: 'learning', icon: '📚', rarity: 'common', xpReward: 25, sortOrder: 2 },
    { id: 'words_50', name: 'Word Collector', description: 'Learn 50 words', category: 'learning', icon: '📖', rarity: 'uncommon', xpReward: 50, sortOrder: 3 },
    { id: 'words_100', name: 'Century Club', description: 'Learn 100 words', category: 'learning', icon: '💯', rarity: 'uncommon', xpReward: 100, sortOrder: 4 },
    { id: 'words_500', name: 'Word Master', description: 'Learn 500 words', category: 'learning', icon: '🎓', rarity: 'rare', xpReward: 250, sortOrder: 5 },
    { id: 'words_1000', name: 'Vocabulary Champion', description: 'Learn 1000 words', category: 'learning', icon: '🏆', rarity: 'epic', xpReward: 500, sortOrder: 6 },
    { id: 'words_2500', name: 'Linguist', description: 'Learn 2500 words', category: 'learning', icon: '👑', rarity: 'legendary', xpReward: 1000, sortOrder: 7 },

    // Mastery achievements
    { id: 'master_10', name: 'Quick Learner', description: 'Master 10 words', category: 'mastery', icon: '⭐', rarity: 'common', xpReward: 30, sortOrder: 10 },
    { id: 'master_50', name: 'Memory Expert', description: 'Master 50 words', category: 'mastery', icon: '🧠', rarity: 'uncommon', xpReward: 75, sortOrder: 11 },
    { id: 'master_100', name: 'Knowledge Keeper', description: 'Master 100 words', category: 'mastery', icon: '💎', rarity: 'rare', xpReward: 150, sortOrder: 12 },
    { id: 'master_500', name: 'Memory Master', description: 'Master 500 words', category: 'mastery', icon: '🌟', rarity: 'epic', xpReward: 400, sortOrder: 13 },

    // Streak achievements
    { id: 'streak_3', name: 'Getting Started', description: '3-day study streak', category: 'consistency', icon: '🔥', rarity: 'common', xpReward: 20, sortOrder: 20 },
    { id: 'streak_7', name: 'Week Warrior', description: '7-day study streak', category: 'consistency', icon: '🔥', rarity: 'uncommon', xpReward: 50, sortOrder: 21 },
    { id: 'streak_14', name: 'Fortnight Fighter', description: '14-day study streak', category: 'consistency', icon: '🔥', rarity: 'uncommon', xpReward: 100, sortOrder: 22 },
    { id: 'streak_30', name: 'Monthly Master', description: '30-day study streak', category: 'consistency', icon: '🔥', rarity: 'rare', xpReward: 200, sortOrder: 23 },
    { id: 'streak_60', name: 'Two Month Titan', description: '60-day study streak', category: 'consistency', icon: '🔥', rarity: 'epic', xpReward: 400, sortOrder: 24 },
    { id: 'streak_100', name: 'Dedication Legend', description: '100-day study streak', category: 'consistency', icon: '🔥', rarity: 'legendary', xpReward: 1000, sortOrder: 25 },
    { id: 'streak_365', name: 'Year of Learning', description: '365-day study streak', category: 'consistency', icon: '🏅', rarity: 'legendary', xpReward: 5000, sortOrder: 26, isHidden: true },

    // HSK achievements
    { id: 'hsk1_complete', name: 'HSK 1 Graduate', description: 'Learn all HSK 1 vocabulary', category: 'mastery', icon: '1️⃣', rarity: 'uncommon', xpReward: 100, sortOrder: 30 },
    { id: 'hsk2_complete', name: 'HSK 2 Graduate', description: 'Learn all HSK 2 vocabulary', category: 'mastery', icon: '2️⃣', rarity: 'uncommon', xpReward: 150, sortOrder: 31 },
    { id: 'hsk3_complete', name: 'HSK 3 Graduate', description: 'Learn all HSK 3 vocabulary', category: 'mastery', icon: '3️⃣', rarity: 'rare', xpReward: 300, sortOrder: 32 },
    { id: 'hsk4_complete', name: 'HSK 4 Graduate', description: 'Learn all HSK 4 vocabulary', category: 'mastery', icon: '4️⃣', rarity: 'rare', xpReward: 500, sortOrder: 33 },
    { id: 'hsk5_complete', name: 'HSK 5 Graduate', description: 'Learn all HSK 5 vocabulary', category: 'mastery', icon: '5️⃣', rarity: 'epic', xpReward: 1000, sortOrder: 34 },
    { id: 'hsk6_complete', name: 'HSK 6 Graduate', description: 'Learn all HSK 6 vocabulary', category: 'mastery', icon: '6️⃣', rarity: 'legendary', xpReward: 2000, sortOrder: 35 },

    // Review achievements
    { id: 'reviews_100', name: 'Reviewer', description: 'Complete 100 reviews', category: 'learning', icon: '✏️', rarity: 'common', xpReward: 30, sortOrder: 40 },
    { id: 'reviews_500', name: 'Dedicated Reviewer', description: 'Complete 500 reviews', category: 'learning', icon: '✏️', rarity: 'uncommon', xpReward: 75, sortOrder: 41 },
    { id: 'reviews_1000', name: 'Review Master', description: 'Complete 1000 reviews', category: 'learning', icon: '✏️', rarity: 'rare', xpReward: 150, sortOrder: 42 },
    { id: 'perfect_session', name: 'Perfect Session', description: 'Complete a review session with 100% accuracy', category: 'mastery', icon: '💫', rarity: 'uncommon', xpReward: 50, sortOrder: 43 },
    { id: 'perfect_week', name: 'Perfect Week', description: 'Maintain 100% accuracy for 7 days', category: 'mastery', icon: '🌈', rarity: 'rare', xpReward: 200, sortOrder: 44, isHidden: true },

    // Social achievements
    { id: 'first_share', name: 'Sharing is Caring', description: 'Share your first deck', category: 'social', icon: '🤝', rarity: 'common', xpReward: 25, sortOrder: 50 },
    { id: 'deck_liked', name: 'Appreciated', description: 'Receive your first like on a shared deck', category: 'social', icon: '❤️', rarity: 'common', xpReward: 30, sortOrder: 51 },
    { id: 'deck_downloaded_10', name: 'Helpful', description: 'Have your deck downloaded 10 times', category: 'social', icon: '📥', rarity: 'uncommon', xpReward: 50, sortOrder: 52 },
    { id: 'join_group', name: 'Team Player', description: 'Join your first study group', category: 'social', icon: '👥', rarity: 'common', xpReward: 20, sortOrder: 53 },
    { id: 'create_group', name: 'Leader', description: 'Create a study group', category: 'social', icon: '👑', rarity: 'uncommon', xpReward: 50, sortOrder: 54 },

    // Special achievements
    { id: 'early_bird', name: 'Early Bird', description: 'Study before 7 AM', category: 'special', icon: '🌅', rarity: 'uncommon', xpReward: 30, sortOrder: 60 },
    { id: 'night_owl', name: 'Night Owl', description: 'Study after 11 PM', category: 'special', icon: '🦉', rarity: 'uncommon', xpReward: 30, sortOrder: 61 },
    { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Study on both Saturday and Sunday', category: 'special', icon: '💪', rarity: 'uncommon', xpReward: 40, sortOrder: 62 },
    { id: 'speed_demon', name: 'Speed Demon', description: 'Complete 50 reviews in under 5 minutes', category: 'special', icon: '⚡', rarity: 'rare', xpReward: 75, sortOrder: 63 },
    { id: 'comeback_kid', name: 'Comeback Kid', description: 'Return after 30 days away', category: 'special', icon: '🔄', rarity: 'uncommon', xpReward: 50, sortOrder: 64 },
    { id: 'completionist', name: 'Completionist', description: 'Earn all other achievements', category: 'special', icon: '🎯', rarity: 'legendary', xpReward: 10000, sortOrder: 99, isHidden: true },
  ];

  let inserted = 0;
  for (const achievement of achievements) {
    try {
      await db
        .insert(achievementDefinitions)
        .values({
          ...achievement,
          requirements: {},
          badgeColor: getBadgeColor(achievement.rarity),
          isHidden: achievement.isHidden || false,
          isActive: true,
        })
        .onConflictDoNothing();
      inserted++;
    } catch (error) {
      // Ignore duplicates
    }
  }

  log.info('Achievements seeded', { total: achievements.length, inserted });
  return inserted;
}

function getBadgeColor(rarity: string): string {
  switch (rarity) {
    case 'common': return '#9E9E9E';
    case 'uncommon': return '#4CAF50';
    case 'rare': return '#2196F3';
    case 'epic': return '#9C27B0';
    case 'legendary': return '#FF9800';
    default: return '#9E9E9E';
  }
}

/**
 * Seed content topics
 */
async function seedTopics() {
  const topics = [
    // Top-level topics
    { id: 'entertainment', name: 'Entertainment', nameZh: '娱乐', icon: '🎬', color: '#E91E63', sortOrder: 1 },
    { id: 'daily-life', name: 'Daily Life', nameZh: '日常生活', icon: '🏠', color: '#4CAF50', sortOrder: 2 },
    { id: 'travel', name: 'Travel', nameZh: '旅行', icon: '✈️', color: '#00BCD4', sortOrder: 3 },
    { id: 'food', name: 'Food & Cooking', nameZh: '美食', icon: '🍜', color: '#FF5722', sortOrder: 4 },
    { id: 'business', name: 'Business', nameZh: '商务', icon: '💼', color: '#607D8B', sortOrder: 5 },
    { id: 'technology', name: 'Technology', nameZh: '科技', icon: '💻', color: '#3F51B5', sortOrder: 6 },
    { id: 'culture', name: 'Culture & History', nameZh: '文化历史', icon: '🏛️', color: '#795548', sortOrder: 7 },
    { id: 'sports', name: 'Sports', nameZh: '体育', icon: '⚽', color: '#8BC34A', sortOrder: 8 },
    { id: 'news', name: 'News & Current Events', nameZh: '新闻', icon: '📰', color: '#9E9E9E', sortOrder: 9 },
    { id: 'education', name: 'Education', nameZh: '教育', icon: '📚', color: '#673AB7', sortOrder: 10 },
    { id: 'health', name: 'Health & Wellness', nameZh: '健康', icon: '🏥', color: '#F44336', sortOrder: 11 },
    { id: 'nature', name: 'Nature & Environment', nameZh: '自然环境', icon: '🌿', color: '#4CAF50', sortOrder: 12 },

    // Entertainment subtopics
    { id: 'drama', name: 'Drama', nameZh: '电视剧', icon: '📺', parentId: 'entertainment', sortOrder: 1 },
    { id: 'comedy', name: 'Comedy', nameZh: '喜剧', icon: '😂', parentId: 'entertainment', sortOrder: 2 },
    { id: 'action', name: 'Action', nameZh: '动作', icon: '💥', parentId: 'entertainment', sortOrder: 3 },
    { id: 'romance', name: 'Romance', nameZh: '爱情', icon: '💕', parentId: 'entertainment', sortOrder: 4 },
    { id: 'variety', name: 'Variety Shows', nameZh: '综艺', icon: '🎤', parentId: 'entertainment', sortOrder: 5 },
    { id: 'animation', name: 'Animation', nameZh: '动画', icon: '🎨', parentId: 'entertainment', sortOrder: 6 },

    // Food subtopics
    { id: 'cooking', name: 'Cooking', nameZh: '烹饪', icon: '👨‍🍳', parentId: 'food', sortOrder: 1 },
    { id: 'restaurants', name: 'Restaurants', nameZh: '餐厅', icon: '🍽️', parentId: 'food', sortOrder: 2 },
    { id: 'street-food', name: 'Street Food', nameZh: '小吃', icon: '🥟', parentId: 'food', sortOrder: 3 },
    { id: 'drinks', name: 'Drinks', nameZh: '饮品', icon: '🧋', parentId: 'food', sortOrder: 4 },

    // Business subtopics
    { id: 'marketing', name: 'Marketing', nameZh: '营销', icon: '📈', parentId: 'business', sortOrder: 1 },
    { id: 'finance', name: 'Finance', nameZh: '金融', icon: '💰', parentId: 'business', sortOrder: 2 },
    { id: 'startup', name: 'Startups', nameZh: '创业', icon: '🚀', parentId: 'business', sortOrder: 3 },

    // Technology subtopics
    { id: 'programming', name: 'Programming', nameZh: '编程', icon: '👨‍💻', parentId: 'technology', sortOrder: 1 },
    { id: 'ai', name: 'AI & Machine Learning', nameZh: '人工智能', icon: '🤖', parentId: 'technology', sortOrder: 2 },
    { id: 'mobile', name: 'Mobile Apps', nameZh: '移动应用', icon: '📱', parentId: 'technology', sortOrder: 3 },
  ];

  let inserted = 0;
  for (const topic of topics) {
    try {
      await db
        .insert(contentTopics)
        .values({
          ...topic,
          isActive: true,
          contentCount: 0,
        })
        .onConflictDoNothing();
      inserted++;
    } catch (error) {
      // Ignore duplicates
    }
  }

  log.info('Topics seeded', { total: topics.length, inserted });
  return inserted;
}

/**
 * Seed default challenges
 */
async function seedChallenges() {
  const challenges = [
    // Daily challenges
    {
      name: 'Daily Word Goal',
      description: 'Learn 10 new words today',
      type: 'daily',
      goal: 'words_learned',
      targetValue: 10,
      xpReward: 25,
      isRecurring: true,
      recurringDays: 1,
    },
    {
      name: 'Daily Review',
      description: 'Complete 20 reviews today',
      type: 'daily',
      goal: 'reviews_completed',
      targetValue: 20,
      xpReward: 20,
      isRecurring: true,
      recurringDays: 1,
    },
    {
      name: 'Study Time',
      description: 'Study for 15 minutes today',
      type: 'daily',
      goal: 'study_minutes',
      targetValue: 15,
      xpReward: 15,
      isRecurring: true,
      recurringDays: 1,
    },

    // Weekly challenges
    {
      name: 'Weekly Word Goal',
      description: 'Learn 50 new words this week',
      type: 'weekly',
      goal: 'words_learned',
      targetValue: 50,
      xpReward: 100,
      isRecurring: true,
      recurringDays: 7,
    },
    {
      name: 'Weekly Streak',
      description: 'Maintain a 7-day streak this week',
      type: 'weekly',
      goal: 'streak_days',
      targetValue: 7,
      xpReward: 75,
      isRecurring: true,
      recurringDays: 7,
    },
    {
      name: 'Review Master',
      description: 'Complete 100 reviews this week',
      type: 'weekly',
      goal: 'reviews_completed',
      targetValue: 100,
      xpReward: 80,
      isRecurring: true,
      recurringDays: 7,
    },
  ];

  let inserted = 0;
  for (const challenge of challenges) {
    try {
      await db
        .insert(challengeDefinitions)
        .values({
          ...challenge,
          isActive: true,
        })
        .onConflictDoNothing();
      inserted++;
    } catch (error) {
      // Ignore duplicates
    }
  }

  log.info('Challenges seeded', { total: challenges.length, inserted });
  return inserted;
}

/**
 * Run all seeds
 */
export async function seed() {
  log.info('Starting database seed...');

  try {
    const achievementCount = await seedAchievements();
    const topicCount = await seedTopics();
    const challengeCount = await seedChallenges();

    log.info('Database seed completed', {
      achievements: achievementCount,
      topics: topicCount,
      challenges: challengeCount,
    });

    return {
      achievements: achievementCount,
      topics: topicCount,
      challenges: challengeCount,
    };
  } catch (error) {
    log.error('Database seed failed', error as Error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.main) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
