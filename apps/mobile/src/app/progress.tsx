import { useState, useEffect, useCallback, useMemo } from 'react';
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
  TrendingUp,
  Flame,
  BookOpen,
  Clock,
  Target,
  Award,
  Calendar,
  ChevronRight,
  BarChart3,
} from 'lucide-react-native';

import {
  useAnalytics,
  type SummaryStats,
  type ProgressData,
  type HeatmapData,
  type Milestone,
} from '~/hooks/useAnalytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEATMAP_CELL_SIZE = 10;
const HEATMAP_CELL_GAP = 2;

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    getSummary,
    getProgress,
    getHeatmap,
    getMilestones,
    summary,
    progress,
    heatmap,
    milestones,
    loading,
  } = useAnalytics();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('week');

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        getSummary(),
        getProgress({ granularity: 'day' }),
        getHeatmap(),
        getMilestones(),
      ]);
    } catch (err) {
      console.error('Failed to load progress data:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  // Calculate chart data based on selected period
  const chartData = useMemo(() => {
    if (!progress?.wordsLearned) return [];

    const data = progress.wordsLearned;
    const days = selectedPeriod === 'week' ? 7 : selectedPeriod === 'month' ? 30 : 365;
    return data.slice(-days);
  }, [progress, selectedPeriod]);

  // Generate heatmap grid
  const heatmapGrid = useMemo(() => {
    if (!heatmap?.days) return [];

    const today = new Date();
    const weeks: Array<Array<{ date: string; level: number }>> = [];
    let currentWeek: Array<{ date: string; level: number }> = [];

    // Generate last 52 weeks
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push({
        date: dateStr,
        level: heatmap.days[dateStr] || 0,
      });
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [heatmap]);

  const getHeatmapColor = (level: number) => {
    const colors = [
      '#1f2937', // 0 - no activity
      '#374151', // 1 - low
      '#6366f1', // 2 - medium
      '#818cf8', // 3 - high
      '#a5b4fc', // 4 - very high
    ];
    return colors[Math.min(level, 4)];
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !summary ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : (
          <>
            {/* Streak Card */}
            <View style={styles.streakCard}>
              <View style={styles.streakMain}>
                <View style={styles.streakIconContainer}>
                  <Flame size={32} color="#f97316" />
                </View>
                <View style={styles.streakInfo}>
                  <Text style={styles.streakValue}>{summary?.streakStatus.current || 0}</Text>
                  <Text style={styles.streakLabel}>Day Streak</Text>
                </View>
              </View>
              <View style={styles.streakMeta}>
                <View style={styles.streakMetaItem}>
                  <Text style={styles.streakMetaValue}>{summary?.streakStatus.longest || 0}</Text>
                  <Text style={styles.streakMetaLabel}>Longest</Text>
                </View>
                <View style={styles.streakDivider} />
                <View style={styles.streakMetaItem}>
                  <Text style={styles.streakMetaValue}>{summary?.streakStatus.nextMilestone || 7}</Text>
                  <Text style={styles.streakMetaLabel}>Next Goal</Text>
                </View>
              </View>
              {summary?.streakStatus.todayCompleted && (
                <View style={styles.todayCompletedBadge}>
                  <Text style={styles.todayCompletedText}>✓ Today Complete</Text>
                </View>
              )}
            </View>

            {/* Stats Overview */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>Today's Progress</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <BookOpen size={20} color="#6366f1" />
                  <Text style={styles.statValue}>{summary?.today.wordsLearned || 0}</Text>
                  <Text style={styles.statLabel}>Words Learned</Text>
                </View>
                <View style={styles.statCard}>
                  <Target size={20} color="#22c55e" />
                  <Text style={styles.statValue}>{summary?.today.wordsReviewed || 0}</Text>
                  <Text style={styles.statLabel}>Reviewed</Text>
                </View>
                <View style={styles.statCard}>
                  <Clock size={20} color="#f59e0b" />
                  <Text style={styles.statValue}>{summary?.today.studyTimeMinutes || 0}</Text>
                  <Text style={styles.statLabel}>Minutes</Text>
                </View>
                <View style={styles.statCard}>
                  <TrendingUp size={20} color="#ec4899" />
                  <Text style={styles.statValue}>{summary?.today.reviewAccuracy || 0}%</Text>
                  <Text style={styles.statLabel}>Accuracy</Text>
                </View>
              </View>
            </View>

            {/* Activity Chart */}
            <View style={styles.chartSection}>
              <View style={styles.chartHeader}>
                <View style={styles.chartTitleRow}>
                  <BarChart3 size={20} color="#6366f1" />
                  <Text style={styles.sectionTitle}>Learning Activity</Text>
                </View>
                <View style={styles.periodSelector}>
                  {(['week', 'month', 'year'] as const).map((period) => (
                    <TouchableOpacity
                      key={period}
                      style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
                      onPress={() => setSelectedPeriod(period)}
                    >
                      <Text style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}>
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Simple bar chart */}
              <View style={styles.chartContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.barChart}>
                    {chartData.map((day, index) => {
                      const maxValue = Math.max(...chartData.map((d) => d.wordsLearned), 1);
                      const height = (day.wordsLearned / maxValue) * 100;
                      return (
                        <View key={day.date} style={styles.barContainer}>
                          <View style={[styles.bar, { height: `${height}%` }]} />
                          {index % (selectedPeriod === 'week' ? 1 : selectedPeriod === 'month' ? 5 : 30) === 0 && (
                            <Text style={styles.barLabel}>
                              {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </View>

            {/* Activity Heatmap */}
            <View style={styles.heatmapSection}>
              <View style={styles.heatmapHeader}>
                <Calendar size={20} color="#6366f1" />
                <Text style={styles.sectionTitle}>Activity Calendar</Text>
                <Text style={styles.heatmapActiveDays}>
                  {heatmap?.totalActiveDays || 0} active days
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.heatmapContainer}>
                  {heatmapGrid.map((week, weekIndex) => (
                    <View key={weekIndex} style={styles.heatmapWeek}>
                      {week.map((day) => (
                        <View
                          key={day.date}
                          style={[
                            styles.heatmapCell,
                            { backgroundColor: getHeatmapColor(day.level) },
                          ]}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.heatmapLegend}>
                <Text style={styles.legendLabel}>Less</Text>
                {[0, 1, 2, 3, 4].map((level) => (
                  <View
                    key={level}
                    style={[styles.legendCell, { backgroundColor: getHeatmapColor(level) }]}
                  />
                ))}
                <Text style={styles.legendLabel}>More</Text>
              </View>
            </View>

            {/* Milestones */}
            <View style={styles.milestonesSection}>
              <View style={styles.milestonesHeader}>
                <Award size={20} color="#6366f1" />
                <Text style={styles.sectionTitle}>Achievements</Text>
              </View>
              {milestones.map((milestone) => (
                <View
                  key={milestone.id}
                  style={[styles.milestoneCard, milestone.achieved && styles.milestoneAchieved]}
                >
                  <Text style={styles.milestoneIcon}>{milestone.icon}</Text>
                  <View style={styles.milestoneInfo}>
                    <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                    <Text style={styles.milestoneDescription}>{milestone.description}</Text>
                    <View style={styles.milestoneProgress}>
                      <View style={styles.milestoneProgressBar}>
                        <View
                          style={[
                            styles.milestoneProgressFill,
                            { width: `${Math.min(100, (milestone.progress / milestone.target) * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.milestoneProgressText}>
                        {milestone.progress}/{milestone.target}
                      </Text>
                    </View>
                  </View>
                  {milestone.achieved && (
                    <View style={styles.achievedBadge}>
                      <Text style={styles.achievedText}>✓</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* All-Time Stats */}
            <View style={styles.allTimeSection}>
              <Text style={styles.sectionTitle}>All-Time Stats</Text>
              <View style={styles.allTimeGrid}>
                <View style={styles.allTimeItem}>
                  <Text style={styles.allTimeValue}>{summary?.allTime.totalWordsLearned || 0}</Text>
                  <Text style={styles.allTimeLabel}>Words Learned</Text>
                </View>
                <View style={styles.allTimeItem}>
                  <Text style={styles.allTimeValue}>{summary?.allTime.totalWordsReviewed || 0}</Text>
                  <Text style={styles.allTimeLabel}>Reviews</Text>
                </View>
                <View style={styles.allTimeItem}>
                  <Text style={styles.allTimeValue}>{summary?.allTime.totalStudyTimeHours || 0}h</Text>
                  <Text style={styles.allTimeLabel}>Study Time</Text>
                </View>
                <View style={styles.allTimeItem}>
                  <Text style={styles.allTimeValue}>{summary?.allTime.accountAgeInDays || 0}</Text>
                  <Text style={styles.allTimeLabel}>Days Learning</Text>
                </View>
              </View>
            </View>

            <View style={{ height: insets.bottom + 40 }} />
          </>
        )}
      </ScrollView>
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
  streakCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    margin: 16,
    padding: 20,
  },
  streakMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  streakIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f9731620',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  streakInfo: {
    flex: 1,
  },
  streakValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  streakLabel: {
    fontSize: 16,
    color: '#9ca3af',
  },
  streakMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakMetaItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  streakMetaValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  streakMetaLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  streakDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#374151',
  },
  todayCompletedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  todayCompletedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  statsSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 48 - 12) / 2,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  chartSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 2,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#6366f1',
  },
  periodText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#fff',
  },
  chartContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    height: 160,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 4,
  },
  barContainer: {
    alignItems: 'center',
    width: 20,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 12,
    backgroundColor: '#6366f1',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 4,
    transform: [{ rotate: '-45deg' }],
  },
  heatmapSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  heatmapActiveDays: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#6b7280',
  },
  heatmapContainer: {
    flexDirection: 'row',
    gap: HEATMAP_CELL_GAP,
  },
  heatmapWeek: {
    flexDirection: 'column',
    gap: HEATMAP_CELL_GAP,
  },
  heatmapCell: {
    width: HEATMAP_CELL_SIZE,
    height: HEATMAP_CELL_SIZE,
    borderRadius: 2,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 12,
  },
  legendLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginHorizontal: 4,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  milestonesSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  milestonesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  milestoneAchieved: {
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  milestoneIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  milestoneDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  milestoneProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  milestoneProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  milestoneProgressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
  milestoneProgressText: {
    fontSize: 11,
    color: '#6b7280',
    minWidth: 50,
    textAlign: 'right',
  },
  achievedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  achievedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  allTimeSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  allTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  allTimeItem: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 48 - 12) / 2,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  allTimeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 4,
  },
  allTimeLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
});
