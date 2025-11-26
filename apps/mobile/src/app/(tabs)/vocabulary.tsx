import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Volume2, Mic, ChevronRight } from 'lucide-react-native';

import { useVocabulary, type VocabularyItem } from '~/hooks/useVocabulary';
import { useSpeech } from '~/hooks/useSpeech';

type StatusFilter = 'all' | 'new' | 'learning' | 'known';

export default function VocabularyScreen() {
  const router = useRouter();
  const { items, loading, refresh } = useVocabulary();
  const { synthesize, playAudio, isPlaying, stopAudio } = useSpeech();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredItems = useMemo(() => {
    let result = items;

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.word.includes(query) ||
          item.pinyin?.toLowerCase().includes(query) ||
          item.definitions.some((d) => d.toLowerCase().includes(query))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }

    return result;
  }, [items, search, statusFilter]);

  const stats = useMemo(() => ({
    total: items.length,
    new: items.filter((i) => i.status === 'new').length,
    learning: items.filter((i) => i.status === 'learning').length,
    known: items.filter((i) => i.status === 'known').length,
  }), [items]);

  const [playingWordId, setPlayingWordId] = useState<string | null>(null);

  const handlePlayAudio = useCallback(async (item: VocabularyItem) => {
    try {
      if (playingWordId === item.id && isPlaying) {
        await stopAudio();
        setPlayingWordId(null);
        return;
      }

      setPlayingWordId(item.id);
      const audioUri = await synthesize(item.word, '中文女');
      await playAudio(audioUri);
      setPlayingWordId(null);
    } catch (err) {
      console.error('Failed to play audio:', err);
      setPlayingWordId(null);
    }
  }, [playingWordId, isPlaying, synthesize, playAudio, stopAudio]);

  const handlePractice = useCallback((item: VocabularyItem) => {
    router.push({
      pathname: '/shadowing',
      params: {
        word: item.word,
        pinyin: item.pinyin || '',
      },
    });
  }, [router]);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search words..."
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'new', 'learning', 'known'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterTab, statusFilter === status && styles.filterTabActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[styles.filterText, statusFilter === status && styles.filterTextActive]}>
              {status === 'all' ? `All (${stats.total})` : `${status} (${stats[status]})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Word List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.wordItem}>
            <View style={styles.wordMain}>
              <Text style={styles.wordText}>{item.word}</Text>
              {item.pinyin && <Text style={styles.pinyinText}>{item.pinyin}</Text>}
              {item.definitions.length > 0 && (
                <Text style={styles.definitionText} numberOfLines={1}>
                  {item.definitions[0]}
                </Text>
              )}
            </View>
            <View style={styles.wordActions}>
              {/* Audio Button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handlePlayAudio(item)}
              >
                {playingWordId === item.id ? (
                  <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                  <Volume2 size={20} color="#6366f1" />
                )}
              </TouchableOpacity>
              {/* Practice Button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handlePractice(item)}
              >
                <Mic size={20} color="#22c55e" />
              </TouchableOpacity>
            </View>
            <View style={styles.wordMeta}>
              {item.hskLevel && (
                <View style={styles.hskBadge}>
                  <Text style={styles.hskText}>HSK {item.hskLevel}</Text>
                </View>
              )}
              <View style={[styles.statusBadge, styles[`status_${item.status}`]]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366f1" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {search ? 'No words match your search' : 'No vocabulary yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              Start watching videos to build your vocabulary
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
  searchContainer: {
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
  },
  filterTabActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  wordMain: {
    flex: 1,
  },
  wordText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '500',
  },
  pinyinText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  definitionText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  wordActions: {
    flexDirection: 'row',
    marginRight: 12,
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordMeta: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  hskBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  hskText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  status_new: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
  },
  status_learning: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
  },
  status_known: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
    color: '#fff',
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
