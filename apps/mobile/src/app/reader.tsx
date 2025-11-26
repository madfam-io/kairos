import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Settings,
  Volume2,
  Plus,
  BookOpen,
  Minus,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react-native';

import { useSpeech } from '~/hooks/useSpeech';
import { useVocabulary } from '~/hooks/useVocabulary';
import { useSettings } from '~/hooks/useSettings';
import { useReader, type SegmentedWord as APISegmentedWord, type DictionaryEntry } from '~/hooks/useReader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// UI word representation
interface DisplayWord {
  text: string;
  pinyin: string | null;
  definitions: string[];
  hskLevel: number | null;
  isKnown: boolean;
  isPunctuation: boolean;
}

interface ReaderSettings {
  fontSize: number;
  showPinyin: boolean;
  highlightUnknown: boolean;
  theme: 'dark' | 'light' | 'sepia';
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 24,
  showPinyin: true,
  highlightUnknown: true,
  theme: 'dark',
};

const THEMES = {
  dark: {
    background: '#0a0a0a',
    surface: '#1f2937',
    text: '#ffffff',
    textSecondary: '#9ca3af',
    known: '#374151',
    unknown: 'rgba(99, 102, 241, 0.2)',
    unknownBorder: '#6366f1',
  },
  light: {
    background: '#ffffff',
    surface: '#f3f4f6',
    text: '#111827',
    textSecondary: '#6b7280',
    known: '#e5e7eb',
    unknown: 'rgba(99, 102, 241, 0.15)',
    unknownBorder: '#6366f1',
  },
  sepia: {
    background: '#f4ecd8',
    surface: '#e8dcc8',
    text: '#5c4b37',
    textSecondary: '#8b7355',
    known: '#d9ccb8',
    unknown: 'rgba(139, 90, 43, 0.15)',
    unknownBorder: '#8b5a2b',
  },
};

export default function ReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    content?: string;
    title?: string;
  }>();

  const { synthesize, playAudio, isPlaying } = useSpeech();
  const { items: knownWords, addWord } = useVocabulary();
  const { settings: appSettings } = useSettings();
  const { segment, segmentedContent: apiSegments, lookup, loading: segmentLoading, error: segmentError } = useReader();

  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedWord, setSelectedWord] = useState<DisplayWord | null>(null);
  const [selectedWordDetails, setSelectedWordDetails] = useState<DictionaryEntry | null>(null);
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Sample content for demo (would come from params or API)
  const content = params.content || `今天天气很好。我和朋友去公园散步。
公园里有很多人在运动。有的人在跑步，有的人在打太极拳。
我们找了一个安静的地方坐下来聊天。
朋友告诉我他最近在学习中文。他说中文很难，但是很有意思。
我鼓励他继续努力，因为学习语言需要时间和耐心。`;

  const title = params.title || '公园散步';

  // Segment content on mount
  useEffect(() => {
    segment(content);
  }, [content]);

  // Transform API segments to display words
  const displayWords: DisplayWord[] = apiSegments.map((seg) => ({
    text: seg.text,
    pinyin: seg.pinyin,
    definitions: seg.definitions,
    hskLevel: seg.hskLevel,
    isKnown: seg.isKnown,
    isPunctuation: seg.isPunctuation,
  }));

  const theme = THEMES[readerSettings.theme];

  const handleWordPress = useCallback(async (word: DisplayWord) => {
    if (word.isPunctuation) return;
    setSelectedWord(word);
    setSelectedWordDetails(null);

    // Fetch additional details from dictionary
    setLoadingDetails(true);
    try {
      const details = await lookup(word.text);
      setSelectedWordDetails(details);
    } catch (err) {
      console.error('Failed to lookup word:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [lookup]);

  const handlePlayWord = useCallback(async (word: string) => {
    try {
      setPlayingWord(word);
      const uri = await synthesize(word, '中文女');
      await playAudio(uri);
    } catch (err) {
      console.error('Failed to play:', err);
    } finally {
      setPlayingWord(null);
    }
  }, [synthesize, playAudio]);

  const handleAddToVocabulary = useCallback(async (word: DisplayWord) => {
    try {
      const details = selectedWordDetails;
      await addWord({
        word: word.text,
        pinyin: details?.pinyin || word.pinyin || undefined,
        definitions: details?.definitions?.length ? details.definitions : word.definitions,
        hskLevel: details?.hskLevel || word.hskLevel || undefined,
        status: 'new',
      });
      setSelectedWord(null);
      setSelectedWordDetails(null);
    } catch (err) {
      console.error('Failed to add word:', err);
    }
  }, [addWord, selectedWordDetails]);

  const handleRefresh = useCallback(() => {
    segment(content);
  }, [segment, content]);

  const adjustFontSize = (delta: number) => {
    setReaderSettings((prev) => ({
      ...prev,
      fontSize: Math.max(16, Math.min(40, prev.fontSize + delta)),
    }));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <X size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerRight}>
          {segmentLoading && <ActivityIndicator size="small" color={theme.textSecondary} />}
          <TouchableOpacity onPress={handleRefresh} style={styles.headerButton}>
            <RefreshCw size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerButton}>
            <Settings size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Banner */}
      {segmentError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Using offline mode: {segmentError}</Text>
        </View>
      )}

      {/* Content */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {segmentLoading && displayWords.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Analyzing text...
            </Text>
          </View>
        ) : (
          <View style={styles.textContainer}>
            {displayWords.map((word, index) => {
              const isNewline = word.text === '\n';

              if (isNewline) {
                return <View key={index} style={styles.lineBreak} />;
              }

              if (word.isPunctuation) {
                return (
                  <Text
                    key={index}
                    style={[styles.punctuation, { fontSize: readerSettings.fontSize, color: theme.text }]}
                  >
                    {word.text}
                  </Text>
                );
              }

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleWordPress(word)}
                  style={[
                    styles.wordContainer,
                    !word.isKnown && readerSettings.highlightUnknown && {
                      backgroundColor: theme.unknown,
                      borderBottomColor: theme.unknownBorder,
                      borderBottomWidth: 2,
                    },
                  ]}
                >
                  {readerSettings.showPinyin && word.pinyin && (
                    <Text style={[styles.pinyin, { color: theme.textSecondary, fontSize: readerSettings.fontSize * 0.45 }]}>
                      {word.pinyin}
                    </Text>
                  )}
                  <Text style={[styles.character, { fontSize: readerSettings.fontSize, color: theme.text }]}>
                    {word.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Word Detail Modal */}
      <Modal
        visible={selectedWord !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setSelectedWord(null); setSelectedWordDetails(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.wordModal, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalWordRow}>
                <Text style={[styles.modalWord, { color: theme.text }]}>{selectedWord?.text}</Text>
                {selectedWordDetails?.traditional && selectedWordDetails.traditional !== selectedWord?.text && (
                  <Text style={[styles.modalTraditional, { color: theme.textSecondary }]}>
                    ({selectedWordDetails.traditional})
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => { setSelectedWord(null); setSelectedWordDetails(null); }}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingDetails ? (
              <ActivityIndicator size="small" color="#6366f1" style={{ marginVertical: 16 }} />
            ) : (
              <>
                {(selectedWordDetails?.pinyin || selectedWord?.pinyin) && (
                  <Text style={[styles.modalPinyin, { color: theme.textSecondary }]}>
                    {selectedWordDetails?.pinyin || selectedWord?.pinyin}
                  </Text>
                )}

                {(selectedWordDetails?.hskLevel || selectedWord?.hskLevel) && (
                  <View style={styles.hskBadge}>
                    <Text style={styles.hskText}>
                      HSK {selectedWordDetails?.hskLevel || selectedWord?.hskLevel}
                    </Text>
                  </View>
                )}

                {((selectedWordDetails?.definitions?.length ?? 0) > 0 || (selectedWord?.definitions?.length ?? 0) > 0) && (
                  <View style={styles.definitions}>
                    {(selectedWordDetails?.definitions || selectedWord?.definitions || []).map((def, i) => (
                      <Text key={i} style={[styles.definition, { color: theme.text }]}>
                        {i + 1}. {def}
                      </Text>
                    ))}
                  </View>
                )}

                {!selectedWordDetails?.found && !loadingDetails && (
                  <Text style={[styles.notFoundText, { color: theme.textSecondary }]}>
                    Word not found in dictionary
                  </Text>
                )}
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#6366f1' }]}
                onPress={() => selectedWord && handlePlayWord(selectedWord.text)}
              >
                {playingWord === selectedWord?.text ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Volume2 size={20} color="#fff" />
                )}
                <Text style={styles.modalButtonText}>Listen</Text>
              </TouchableOpacity>

              {!selectedWord?.isKnown && (
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#22c55e' }]}
                  onPress={() => selectedWord && handleAddToVocabulary(selectedWord)}
                >
                  <Plus size={20} color="#fff" />
                  <Text style={styles.modalButtonText}>Add to Vocab</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.settingsModal, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.settingsTitle, { color: theme.text }]}>Reader Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <X size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Font Size */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Font Size</Text>
              <View style={styles.fontSizeControls}>
                <TouchableOpacity
                  style={[styles.fontButton, { backgroundColor: theme.background }]}
                  onPress={() => adjustFontSize(-2)}
                >
                  <Minus size={20} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.fontSizeValue, { color: theme.text }]}>
                  {readerSettings.fontSize}
                </Text>
                <TouchableOpacity
                  style={[styles.fontButton, { backgroundColor: theme.background }]}
                  onPress={() => adjustFontSize(2)}
                >
                  <Plus size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Show Pinyin */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setReaderSettings((p) => ({ ...p, showPinyin: !p.showPinyin }))}
            >
              <Text style={[styles.settingLabel, { color: theme.text }]}>Show Pinyin</Text>
              <View style={[styles.toggle, readerSettings.showPinyin && styles.toggleActive]}>
                <View style={[styles.toggleThumb, readerSettings.showPinyin && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            {/* Highlight Unknown */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setReaderSettings((p) => ({ ...p, highlightUnknown: !p.highlightUnknown }))}
            >
              <Text style={[styles.settingLabel, { color: theme.text }]}>Highlight Unknown Words</Text>
              <View style={[styles.toggle, readerSettings.highlightUnknown && styles.toggleActive]}>
                <View style={[styles.toggleThumb, readerSettings.highlightUnknown && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            {/* Theme */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Theme</Text>
              <View style={styles.themeButtons}>
                {(['dark', 'light', 'sepia'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.themeButton,
                      { backgroundColor: THEMES[t].background, borderColor: THEMES[t].text },
                      readerSettings.theme === t && styles.themeButtonActive,
                    ]}
                    onPress={() => setReaderSettings((p) => ({ ...p, theme: t }))}
                  >
                    {t === 'dark' && <Moon size={16} color={THEMES[t].text} />}
                    {t === 'light' && <Sun size={16} color={THEMES[t].text} />}
                    {t === 'sepia' && <BookOpen size={16} color={THEMES[t].text} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    padding: 20,
  },
  textContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  wordContainer: {
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  pinyin: {
    marginBottom: 2,
  },
  character: {
    fontWeight: '400',
  },
  punctuation: {
    marginBottom: 8,
  },
  lineBreak: {
    width: '100%',
    height: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  wordModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalWordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  modalWord: {
    fontSize: 48,
    fontWeight: '600',
  },
  modalTraditional: {
    fontSize: 28,
  },
  notFoundText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  modalPinyin: {
    fontSize: 24,
    marginBottom: 12,
  },
  hskBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  hskText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  definitions: {
    marginBottom: 24,
  },
  definition: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  settingLabel: {
    fontSize: 16,
  },
  fontSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fontButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontSizeValue: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#374151',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#6366f1',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  themeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeButtonActive: {
    borderWidth: 3,
    borderColor: '#6366f1',
  },
});
