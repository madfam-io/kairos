import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Compass,
  TrendingUp,
  BookOpen,
  Video,
  MessageCircle,
  FileText,
  ChevronRight,
  Star,
  Clock,
  Target,
} from 'lucide-react-native';

import { useContent, type ContentRecommendation, type LevelInfo } from '~/hooks/useContent';
import { useVocabulary } from '~/hooks/useVocabulary';

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#22c55e',
  elementary: '#84cc16',
  intermediate: '#eab308',
  'upper-intermediate': '#f97316',
  advanced: '#ef4444',
};

const TYPE_ICONS = {
  article: FileText,
  video: Video,
  story: BookOpen,
  dialogue: MessageCircle,
};

export default function DiscoverScreen() {
  const router = useRouter();
  const { getRecommendations, getLevel, recommendations, levelInfo, loading, error } = useContent();
  const { items: vocabulary } = useVocabulary();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<ContentRecommendation['type'] | 'all'>('all');

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        getLevel(),
        getRecommendations({ limit: 20 }),
      ]);
    } catch (err) {
      console.error('Failed to load discover data:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleContentPress = (item: ContentRecommendation) => {
    // Navigate to reader with content
    router.push({
      pathname: '/reader',
      params: {
        title: item.title,
        // In production, would fetch full content by ID
        content: item.description,
      },
    });
  };

  const filteredRecommendations = selectedType === 'all'
    ? recommendations
    : recommendations.filter((r) => r.type === selectedType);

  const vocabCount = vocabulary.length;
  const knownCount = vocabulary.filter((v) => v.status === 'known').length;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Level Progress Card */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={styles.levelIconContainer}>
              <Target size={24} color="#6366f1" />
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>Your Level</Text>
              <Text style={styles.levelValue}>
                HSK {levelInfo?.currentLevel?.toFixed(1) || '—'}
              </Text>
            </View>
            <View style={styles.targetContainer}>
              <Text style={styles.targetLabel}>Target</Text>
              <Text style={styles.targetValue}>
                HSK {levelInfo?.targetLevel?.toFixed(1) || '—'}
              </Text>
            </View>
          </View>

          {/* Progress to next level */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progress to next level</Text>
              {levelInfo?.readyForNextLevel ? (
                <View style={styles.readyBadge}>
                  <Star size={12} color="#fff" />
                  <Text style={styles.readyText}>Ready!</Text>
                </View>
              ) : (
                <Text style={styles.progressValue}>
                  {levelInfo?.vocabularyNeeded || 0} words needed
                </Text>
              )}
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: levelInfo?.readyForNextLevel
                      ? '100%'
                      : `${Math.min(100, (vocabCount / (vocabCount + (levelInfo?.vocabularyNeeded || 100))) * 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{vocabCount}</Text>
              <Text style={styles.statLabel}>Words</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{knownCount}</Text>
              <Text style={styles.statLabel}>Mastered</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {Math.round((knownCount / Math.max(vocabCount, 1)) * 100)}%
              </Text>
              <Text style={styles.statLabel}>Retention</Text>
            </View>
          </View>
        </View>

        {/* Content Type Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Discover Content</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, selectedType === 'all' && styles.filterChipActive]}
              onPress={() => setSelectedType('all')}
            >
              <Compass size={16} color={selectedType === 'all' ? '#fff' : '#9ca3af'} />
              <Text style={[styles.filterText, selectedType === 'all' && styles.filterTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {(['article', 'video', 'story', 'dialogue'] as const).map((type) => {
              const Icon = TYPE_ICONS[type];
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterChip, selectedType === type && styles.filterChipActive]}
                  onPress={() => setSelectedType(type)}
                >
                  <Icon size={16} color={selectedType === type ? '#fff' : '#9ca3af'} />
                  <Text style={[styles.filterText, selectedType === type && styles.filterTextActive]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}s
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Recommendations */}
        <View style={styles.recommendationsSection}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={20} color="#6366f1" />
            <Text style={styles.sectionTitle}>Recommended for You</Text>
          </View>

          {loading && filteredRecommendations.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          ) : filteredRecommendations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recommendations yet</Text>
              <Text style={styles.emptySubtext}>
                Build your vocabulary to get personalized content
              </Text>
            </View>
          ) : (
            filteredRecommendations.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.contentCard}
                onPress={() => handleContentPress(item)}
              >
                <View style={styles.contentMain}>
                  <View style={styles.contentHeader}>
                    {(() => {
                      const TypeIcon = TYPE_ICONS[item.type];
                      return (
                        <View style={styles.typeIcon}>
                          <TypeIcon size={16} color="#6366f1" />
                        </View>
                      );
                    })()}
                    <Text style={styles.contentTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                  <Text style={styles.contentDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <View style={styles.contentMeta}>
                    <View
                      style={[
                        styles.difficultyBadge,
                        { backgroundColor: `${DIFFICULTY_COLORS[item.difficulty]}20` },
                      ]}
                    >
                      <Text
                        style={[styles.difficultyText, { color: DIFFICULTY_COLORS[item.difficulty] }]}
                      >
                        HSK {item.hskLevel}
                      </Text>
                    </View>
                    <View style={styles.comprehensibilityBadge}>
                      <Text style={styles.comprehensibilityText}>
                        {item.comprehensibility}% match
                      </Text>
                    </View>
                    {item.duration && (
                      <View style={styles.durationBadge}>
                        <Clock size={12} color="#6b7280" />
                        <Text style={styles.durationText}>{item.duration} min</Text>
                      </View>
                    )}
                  </View>
                </View>
                <ChevronRight size={20} color="#6b7280" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Start Section */}
        <View style={styles.quickStartSection}>
          <Text style={styles.sectionTitle}>Quick Start</Text>
          <View style={styles.quickStartGrid}>
            <TouchableOpacity
              style={styles.quickStartCard}
              onPress={() => router.push('/reader')}
            >
              <View style={[styles.quickStartIcon, { backgroundColor: '#6366f120' }]}>
                <BookOpen size={24} color="#6366f1" />
              </View>
              <Text style={styles.quickStartTitle}>Read</Text>
              <Text style={styles.quickStartSubtitle}>Practice reading</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickStartCard}
              onPress={() => router.push('/shadowing')}
            >
              <View style={[styles.quickStartIcon, { backgroundColor: '#22c55e20' }]}>
                <MessageCircle size={24} color="#22c55e" />
              </View>
              <Text style={styles.quickStartTitle}>Speak</Text>
              <Text style={styles.quickStartSubtitle}>Shadowing practice</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  levelCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    margin: 16,
    padding: 20,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f120',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
  },
  levelValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  targetContainer: {
    alignItems: 'flex-end',
  },
  targetLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  targetValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6366f1',
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  progressValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  readyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#374151',
  },
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  filterScroll: {
    marginBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  recommendationsSection: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  contentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  contentMain: {
    flex: 1,
    marginRight: 12,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#6366f120',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  contentTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  contentDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
    marginBottom: 12,
  },
  contentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  comprehensibilityBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  comprehensibilityText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    color: '#6b7280',
  },
  quickStartSection: {
    padding: 16,
  },
  quickStartGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickStartCard: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  quickStartIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickStartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  quickStartSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
});
