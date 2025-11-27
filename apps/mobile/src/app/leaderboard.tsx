import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  TrendingDown,
  Minus,
  User,
} from 'lucide-react-native';

// Types
interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  xp: number;
  level: number;
  change: number; // positive = up, negative = down, 0 = same
  isCurrentUser: boolean;
}

interface LeaderboardData {
  type: 'daily' | 'weekly' | 'monthly' | 'allTime';
  entries: LeaderboardEntry[];
  currentUser: {
    rank: number;
    xp: number;
  };
  totalParticipants: number;
}

// Mock hook - replace with actual API hook
function useLeaderboard(type: string) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));

    const mockEntries: LeaderboardEntry[] = [
      { rank: 1, userId: '1', displayName: '学霸王', xp: 2450, level: 18, change: 0, isCurrentUser: false },
      { rank: 2, userId: '2', displayName: 'ChineseMaster', xp: 2180, level: 16, change: 2, isCurrentUser: false },
      { rank: 3, userId: '3', displayName: '汉字迷', xp: 1920, level: 15, change: -1, isCurrentUser: false },
      { rank: 4, userId: '4', displayName: 'LanguageLearner', xp: 1750, level: 14, change: 1, isCurrentUser: false },
      { rank: 5, userId: '5', displayName: '小明', xp: 1680, level: 14, change: -2, isCurrentUser: false },
      { rank: 6, userId: 'current', displayName: 'You', xp: 1450, level: 12, change: 3, isCurrentUser: true },
      { rank: 7, userId: '7', displayName: 'PinyinPro', xp: 1380, level: 12, change: 0, isCurrentUser: false },
      { rank: 8, userId: '8', displayName: '书虫', xp: 1290, level: 11, change: -1, isCurrentUser: false },
      { rank: 9, userId: '9', displayName: 'ToneTrainer', xp: 1150, level: 10, change: 2, isCurrentUser: false },
      { rank: 10, userId: '10', displayName: '学习者', xp: 1080, level: 10, change: 0, isCurrentUser: false },
    ];

    setData({
      type: type as LeaderboardData['type'],
      entries: mockEntries,
      currentUser: { rank: 6, xp: 1450 },
      totalParticipants: 1250,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [type]);

  return { data, loading, refresh: fetchLeaderboard };
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'allTime'>('weekly');
  const { data, loading, refresh } = useLeaderboard(selectedPeriod);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const periods: { key: typeof selectedPeriod; label: string }[] = [
    { key: 'daily', label: 'Today' },
    { key: 'weekly', label: 'Week' },
    { key: 'monthly', label: 'Month' },
    { key: 'allTime', label: 'All Time' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.periodButton,
              selectedPeriod === period.key && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period.key)}
          >
            <Text
              style={[
                styles.periodText,
                selectedPeriod === period.key && styles.periodTextActive,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
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
            {/* Top 3 Podium */}
            {data && data.entries.length >= 3 && (
              <View style={styles.podium}>
                {/* Second Place */}
                <View style={[styles.podiumSpot, styles.podiumSecond]}>
                  <PodiumAvatar entry={data.entries[1]} rank={2} />
                  <View style={[styles.podiumPillar, styles.pillarSecond]}>
                    <Medal size={20} color="#c0c0c0" />
                    <Text style={styles.podiumXp}>{formatXp(data.entries[1].xp)}</Text>
                  </View>
                </View>

                {/* First Place */}
                <View style={[styles.podiumSpot, styles.podiumFirst]}>
                  <PodiumAvatar entry={data.entries[0]} rank={1} />
                  <View style={[styles.podiumPillar, styles.pillarFirst]}>
                    <Crown size={24} color="#f59e0b" />
                    <Text style={styles.podiumXp}>{formatXp(data.entries[0].xp)}</Text>
                  </View>
                </View>

                {/* Third Place */}
                <View style={[styles.podiumSpot, styles.podiumThird]}>
                  <PodiumAvatar entry={data.entries[2]} rank={3} />
                  <View style={[styles.podiumPillar, styles.pillarThird]}>
                    <Medal size={20} color="#cd7f32" />
                    <Text style={styles.podiumXp}>{formatXp(data.entries[2].xp)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Current User Position (if not in top 10) */}
            {data && data.currentUser.rank > 10 && (
              <View style={styles.yourRankCard}>
                <Text style={styles.yourRankLabel}>Your Position</Text>
                <Text style={styles.yourRankValue}>#{data.currentUser.rank}</Text>
                <Text style={styles.yourRankXp}>{formatXp(data.currentUser.xp)} XP</Text>
              </View>
            )}

            {/* Rankings List */}
            <View style={styles.rankingsList}>
              <Text style={styles.sectionTitle}>Rankings</Text>
              <Text style={styles.participantsCount}>
                {data?.totalParticipants.toLocaleString()} learners this {selectedPeriod === 'allTime' ? 'period' : selectedPeriod === 'daily' ? 'day' : selectedPeriod}
              </Text>

              {data?.entries.slice(3).map((entry) => (
                <LeaderboardRow key={entry.userId} entry={entry} />
              ))}
            </View>

            <View style={{ height: insets.bottom + 40 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PodiumAvatar({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const borderColor = rank === 1 ? '#f59e0b' : rank === 2 ? '#c0c0c0' : '#cd7f32';

  return (
    <View style={styles.podiumAvatarContainer}>
      <View style={[styles.podiumAvatar, { borderColor }]}>
        {entry.avatarUrl ? (
          <Image source={{ uri: entry.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <User size={24} color="#6b7280" />
        )}
      </View>
      <Text style={styles.podiumName} numberOfLines={1}>
        {entry.displayName}
      </Text>
      <Text style={styles.podiumLevel}>Lvl {entry.level}</Text>
    </View>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View style={[styles.row, entry.isCurrentUser && styles.rowCurrentUser]}>
      <View style={styles.rowRank}>
        <Text style={[styles.rankText, entry.isCurrentUser && styles.rankTextCurrentUser]}>
          {entry.rank}
        </Text>
      </View>

      <View style={styles.rowAvatar}>
        {entry.avatarUrl ? (
          <Image source={{ uri: entry.avatarUrl }} style={styles.smallAvatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <User size={16} color="#6b7280" />
          </View>
        )}
      </View>

      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, entry.isCurrentUser && styles.rowNameCurrentUser]}>
          {entry.displayName}
        </Text>
        <Text style={styles.rowLevel}>Level {entry.level}</Text>
      </View>

      <View style={styles.rowChange}>
        {entry.change > 0 ? (
          <View style={styles.changeUp}>
            <TrendingUp size={12} color="#22c55e" />
            <Text style={styles.changeTextUp}>{entry.change}</Text>
          </View>
        ) : entry.change < 0 ? (
          <View style={styles.changeDown}>
            <TrendingDown size={12} color="#ef4444" />
            <Text style={styles.changeTextDown}>{Math.abs(entry.change)}</Text>
          </View>
        ) : (
          <Minus size={12} color="#6b7280" />
        )}
      </View>

      <Text style={[styles.rowXp, entry.isCurrentUser && styles.rowXpCurrentUser]}>
        {formatXp(entry.xp)}
      </Text>
    </View>
  );
}

function formatXp(xp: number): string {
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}k`;
  }
  return xp.toString();
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
  periodSelector: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#6366f1',
  },
  periodText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#fff',
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  podiumSpot: {
    alignItems: 'center',
    flex: 1,
  },
  podiumFirst: {
    marginBottom: 20,
  },
  podiumSecond: {
    marginBottom: 0,
  },
  podiumThird: {
    marginBottom: 0,
  },
  podiumAvatarContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f2937',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    maxWidth: 80,
    textAlign: 'center',
  },
  podiumLevel: {
    fontSize: 10,
    color: '#6b7280',
  },
  podiumPillar: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 12,
  },
  pillarFirst: {
    height: 100,
    backgroundColor: '#f59e0b30',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#f59e0b50',
  },
  pillarSecond: {
    height: 70,
    backgroundColor: '#c0c0c030',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#c0c0c050',
  },
  pillarThird: {
    height: 50,
    backgroundColor: '#cd7f3230',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#cd7f3250',
  },
  podiumXp: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  yourRankCard: {
    backgroundColor: '#6366f120',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#6366f140',
  },
  yourRankLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  yourRankValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6366f1',
  },
  yourRankXp: {
    fontSize: 14,
    color: '#6b7280',
  },
  rankingsList: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  participantsCount: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowCurrentUser: {
    backgroundColor: '#6366f120',
    borderWidth: 1,
    borderColor: '#6366f140',
  },
  rowRank: {
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  rankTextCurrentUser: {
    color: '#6366f1',
  },
  rowAvatar: {
    marginHorizontal: 12,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  rowNameCurrentUser: {
    color: '#6366f1',
  },
  rowLevel: {
    fontSize: 11,
    color: '#6b7280',
  },
  rowChange: {
    marginHorizontal: 8,
  },
  changeUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  changeDown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  changeTextUp: {
    fontSize: 10,
    color: '#22c55e',
    fontWeight: '600',
  },
  changeTextDown: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '600',
  },
  rowXp: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
    minWidth: 50,
    textAlign: 'right',
  },
  rowXpCurrentUser: {
    color: '#6366f1',
  },
});
