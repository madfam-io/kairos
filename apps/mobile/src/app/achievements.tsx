import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Trophy,
  Flame,
  Star,
  BookOpen,
  Target,
  Users,
  Zap,
  Crown,
  Medal,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
  progress?: number;
  target?: number;
  earnedAt?: string;
  category: string;
}

interface AchievementsData {
  earned: Achievement[];
  available: Achievement[];
  stats: {
    totalEarned: number;
    totalAvailable: number;
    totalXpFromAchievements: number;
  };
}

// Mock hook - replace with actual API hook
function useAchievements() {
  const [data, setData] = useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAchievements = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 500));
    setData({
      earned: [
        {
          id: 'first_word',
          name: 'First Steps',
          description: 'Learn your first word',
          icon: '🎯',
          rarity: 'common',
          xpReward: 10,
          earnedAt: '2025-01-01T10:00:00Z',
          category: 'learning',
        },
        {
          id: 'streak_7',
          name: 'Week Warrior',
          description: 'Maintain a 7-day streak',
          icon: '🔥',
          rarity: 'common',
          xpReward: 50,
          earnedAt: '2025-01-08T10:00:00Z',
          category: 'streaks',
        },
        {
          id: 'vocab_100',
          name: 'Century Club',
          description: 'Learn 100 words',
          icon: '📚',
          rarity: 'uncommon',
          xpReward: 100,
          earnedAt: '2025-01-15T10:00:00Z',
          category: 'learning',
        },
      ],
      available: [
        {
          id: 'streak_30',
          name: 'Monthly Master',
          description: 'Maintain a 30-day streak',
          icon: '🔥',
          rarity: 'rare',
          xpReward: 200,
          progress: 15,
          target: 30,
          category: 'streaks',
        },
        {
          id: 'vocab_500',
          name: 'Word Smith',
          description: 'Learn 500 words',
          icon: '📖',
          rarity: 'rare',
          xpReward: 250,
          progress: 280,
          target: 500,
          category: 'learning',
        },
        {
          id: 'hsk3_complete',
          name: 'HSK 3 Master',
          description: 'Master all HSK 3 vocabulary',
          icon: '🏆',
          rarity: 'epic',
          xpReward: 500,
          progress: 420,
          target: 600,
          category: 'hsk',
        },
        {
          id: 'perfect_week',
          name: 'Perfect Week',
          description: 'Complete all daily goals for 7 days',
          icon: '⭐',
          rarity: 'rare',
          xpReward: 150,
          progress: 3,
          target: 7,
          category: 'goals',
        },
        {
          id: 'social_butterfly',
          name: 'Social Butterfly',
          description: 'Join 3 study groups',
          icon: '🦋',
          rarity: 'uncommon',
          xpReward: 75,
          progress: 1,
          target: 3,
          category: 'social',
        },
      ],
      stats: {
        totalEarned: 3,
        totalAvailable: 45,
        totalXpFromAchievements: 160,
      },
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchAchievements();
  }, []);

  return { data, loading, refresh: fetchAchievements };
}

// Rarity colors
const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

const RARITY_BG_COLORS = {
  common: '#9ca3af20',
  uncommon: '#22c55e20',
  rare: '#3b82f620',
  epic: '#a855f720',
  legendary: '#f59e0b20',
};

export default function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, loading, refresh } = useAchievements();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const categories = ['all', 'learning', 'streaks', 'hsk', 'goals', 'social'];

  const filteredEarned = selectedCategory && selectedCategory !== 'all'
    ? data?.earned.filter((a) => a.category === selectedCategory)
    : data?.earned;

  const filteredAvailable = selectedCategory && selectedCategory !== 'all'
    ? data?.available.filter((a) => a.category === selectedCategory)
    : data?.available;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !data ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : (
          <>
            {/* Stats Summary */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Trophy size={24} color="#f59e0b" />
                <Text style={styles.statValue}>{data?.stats.totalEarned}</Text>
                <Text style={styles.statLabel}>Earned</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Star size={24} color="#6366f1" />
                <Text style={styles.statValue}>{data?.stats.totalAvailable}</Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Zap size={24} color="#22c55e" />
                <Text style={styles.statValue}>{data?.stats.totalXpFromAchievements}</Text>
                <Text style={styles.statLabel}>XP Earned</Text>
              </View>
            </View>

            {/* Category Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryContainer}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    (selectedCategory === cat || (!selectedCategory && cat === 'all')) &&
                      styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCategory(cat === 'all' ? null : cat)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      (selectedCategory === cat || (!selectedCategory && cat === 'all')) &&
                        styles.categoryTextActive,
                    ]}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Earned Achievements */}
            {filteredEarned && filteredEarned.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Earned</Text>
                {filteredEarned.map((achievement) => (
                  <AchievementCard key={achievement.id} achievement={achievement} earned />
                ))}
              </View>
            )}

            {/* Available Achievements */}
            {filteredAvailable && filteredAvailable.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>In Progress</Text>
                {filteredAvailable.map((achievement) => (
                  <AchievementCard key={achievement.id} achievement={achievement} />
                ))}
              </View>
            )}

            <View style={{ height: insets.bottom + 40 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function AchievementCard({ achievement, earned = false }: { achievement: Achievement; earned?: boolean }) {
  const progressPercent = achievement.progress && achievement.target
    ? Math.min(100, (achievement.progress / achievement.target) * 100)
    : 0;

  return (
    <View style={[styles.achievementCard, earned && styles.achievementEarned]}>
      <View
        style={[
          styles.achievementIcon,
          { backgroundColor: RARITY_BG_COLORS[achievement.rarity] },
        ]}
      >
        <Text style={styles.iconEmoji}>{achievement.icon}</Text>
      </View>

      <View style={styles.achievementInfo}>
        <View style={styles.achievementHeader}>
          <Text style={styles.achievementName}>{achievement.name}</Text>
          <View
            style={[
              styles.rarityBadge,
              { backgroundColor: RARITY_BG_COLORS[achievement.rarity] },
            ]}
          >
            <Text
              style={[styles.rarityText, { color: RARITY_COLORS[achievement.rarity] }]}
            >
              {achievement.rarity}
            </Text>
          </View>
        </View>

        <Text style={styles.achievementDescription}>{achievement.description}</Text>

        {!earned && achievement.progress !== undefined && achievement.target && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {achievement.progress}/{achievement.target}
            </Text>
          </View>
        )}

        <View style={styles.xpBadge}>
          <Zap size={12} color="#f59e0b" />
          <Text style={styles.xpText}>{achievement.xpReward} XP</Text>
        </View>
      </View>

      {earned && (
        <View style={styles.earnedCheck}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 16,
    margin: 16,
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#374151',
    marginHorizontal: 12,
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
  },
  categoryButtonActive: {
    backgroundColor: '#6366f1',
  },
  categoryText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  achievementEarned: {
    borderWidth: 1,
    borderColor: '#22c55e40',
  },
  achievementIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 28,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  achievementDescription: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
  progressText: {
    fontSize: 11,
    color: '#6b7280',
    minWidth: 50,
    textAlign: 'right',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  xpText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  earnedCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginLeft: 8,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
