import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Play, TrendingUp, Calendar, Target, BookOpen } from 'lucide-react-native';

import { useAuth } from '~/hooks/useAuth';
import { useSyncStatus } from '~/hooks/useSync';
import { useStats } from '~/hooks/useStats';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { status, pendingCount, isOnline } = useSyncStatus();
  const { stats, loading } = useStats();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {getGreeting()}, {user?.name?.split(' ')[0] || 'Learner'}
        </Text>
        <View style={styles.syncStatus}>
          <View style={[styles.syncDot, { backgroundColor: isOnline ? '#22c55e' : '#f59e0b' }]} />
          <Text style={styles.syncText}>
            {isOnline ? (pendingCount > 0 ? `${pendingCount} pending` : 'Synced') : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Quick Review Card */}
      <TouchableOpacity
        style={styles.reviewCard}
        onPress={() => router.push('/review')}
        activeOpacity={0.8}
      >
        <View style={styles.reviewCardContent}>
          <View style={styles.reviewIcon}>
            <Play size={32} color="#fff" />
          </View>
          <View style={styles.reviewInfo}>
            <Text style={styles.reviewTitle}>Review Due Cards</Text>
            <Text style={styles.reviewCount}>
              {stats.dueCards} cards ready for review
            </Text>
          </View>
        </View>
        <View style={styles.reviewProgress}>
          <View style={[styles.progressBar, { width: `${Math.min(100, (stats.reviewedToday / 20) * 100)}%` }]} />
        </View>
        <Text style={styles.reviewSubtext}>
          {stats.reviewedToday} of 20 daily reviews completed
        </Text>
      </TouchableOpacity>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon={<Target size={24} color="#6366f1" />}
          label="Streak"
          value={`${stats.streak} days`}
        />
        <StatCard
          icon={<TrendingUp size={24} color="#22c55e" />}
          label="Words Known"
          value={stats.knownWords.toString()}
        />
        <StatCard
          icon={<Calendar size={24} color="#f59e0b" />}
          label="This Week"
          value={`${stats.weeklyCards} cards`}
        />
        <StatCard
          icon={<BookOpen size={24} color="#ec4899" />}
          label="Total Cards"
          value={stats.totalCards.toString()}
        />
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {stats.recentWords.length > 0 ? (
          stats.recentWords.map((word, index) => (
            <View key={index} style={styles.activityItem}>
              <Text style={styles.activityWord}>{word.word}</Text>
              <Text style={styles.activityPinyin}>{word.pinyin}</Text>
              <Text style={styles.activityStatus}>{word.status}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent activity. Start learning!</Text>
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  syncText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  reviewCard: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  reviewCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  reviewCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  reviewProgress: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  reviewSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
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
    color: '#9ca3af',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  activityWord: {
    fontSize: 18,
    color: '#fff',
    flex: 1,
  },
  activityPinyin: {
    fontSize: 14,
    color: '#9ca3af',
    marginRight: 12,
  },
  activityStatus: {
    fontSize: 12,
    color: '#6366f1',
    textTransform: 'capitalize',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
