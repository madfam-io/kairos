import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react-native';

import { useCards } from '~/hooks/useCards';

export default function CardsScreen() {
  const router = useRouter();
  const { items, dueCards, loading, refresh } = useCards();

  return (
    <View style={styles.container}>
      {/* Due Cards Banner */}
      {dueCards.length > 0 && (
        <TouchableOpacity
          style={styles.dueBanner}
          onPress={() => router.push('/review')}
          activeOpacity={0.8}
        >
          <View style={styles.dueIcon}>
            <AlertCircle size={24} color="#f59e0b" />
          </View>
          <View style={styles.dueInfo}>
            <Text style={styles.dueTitle}>{dueCards.length} cards due for review</Text>
            <Text style={styles.dueSubtext}>Tap to start reviewing</Text>
          </View>
          <ChevronRight size={24} color="#f59e0b" />
        </TouchableOpacity>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{items.length}</Text>
          <Text style={styles.statLabel}>Total Cards</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{dueCards.length}</Text>
          <Text style={styles.statLabel}>Due Now</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {items.filter((c) => c.repetitions > 0).length}
          </Text>
          <Text style={styles.statLabel}>Learning</Text>
        </View>
      </View>

      {/* Card List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isDue = item.nextReview && new Date(item.nextReview) <= new Date();

          return (
            <TouchableOpacity style={styles.cardItem} activeOpacity={0.7}>
              <View style={styles.cardMain}>
                <Text style={styles.cardWord}>{item.word}</Text>
                <Text style={styles.cardSentence} numberOfLines={1}>
                  {item.sentence}
                </Text>
              </View>
              <View style={styles.cardMeta}>
                {isDue ? (
                  <View style={styles.dueIndicator}>
                    <Clock size={14} color="#f59e0b" />
                    <Text style={styles.dueText}>Due</Text>
                  </View>
                ) : item.repetitions > 0 ? (
                  <View style={styles.learnedIndicator}>
                    <CheckCircle size={14} color="#22c55e" />
                    <Text style={styles.learnedText}>Reviewed</Text>
                  </View>
                ) : (
                  <Text style={styles.newText}>New</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366f1" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No cards yet</Text>
            <Text style={styles.emptySubtext}>
              Mine words from videos to create flashcards
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 0,
  },
  dueIcon: {
    marginRight: 12,
  },
  dueInfo: {
    flex: 1,
  },
  dueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
  },
  dueSubtext: {
    fontSize: 13,
    color: 'rgba(245, 158, 11, 0.8)',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#374151',
    marginHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  cardMain: {
    flex: 1,
  },
  cardWord: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  cardSentence: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  cardMeta: {
    marginLeft: 12,
  },
  dueIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dueText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  learnedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  learnedText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  newText: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});
