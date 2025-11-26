import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Mic,
  MicOff,
  Play,
  Square,
  RotateCcw,
  Volume2,
  Check,
  AlertCircle,
} from 'lucide-react-native';

import { useSpeech } from '~/hooks/useSpeech';
import { usePitch, type PitchComparison } from '~/hooks/usePitch';
import { PitchContourGraph } from '~/components/PitchContourGraph';

// Tone names in Chinese
const TONE_NAMES: Record<number, string> = {
  1: '一声 (高平)',
  2: '二声 (上升)',
  3: '三声 (降升)',
  4: '四声 (下降)',
  5: '轻声',
};

export default function ShadowingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    word?: string;
    pinyin?: string;
    tone?: string;
    referenceUrl?: string;
  }>();

  const {
    isRecording,
    recordingUri,
    startRecording,
    stopRecording,
    isPlaying,
    playAudio,
    stopAudio,
    synthesize,
    loading: speechLoading,
  } = useSpeech();

  const {
    comparePitch,
    analyzeTone,
    loading: pitchLoading,
  } = usePitch();

  const [referenceUri, setReferenceUri] = useState<string | null>(null);
  const [comparison, setComparison] = useState<PitchComparison | null>(null);
  const [toneResult, setToneResult] = useState<{
    detected: number;
    expected: number;
    isCorrect: boolean;
    confidence: number;
  } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  const word = params.word || '你好';
  const pinyin = params.pinyin || 'nǐ hǎo';
  const expectedTone = params.tone ? parseInt(params.tone, 10) : undefined;

  // Generate reference audio on mount
  useEffect(() => {
    const generateReference = async () => {
      try {
        if (params.referenceUrl) {
          setReferenceUri(params.referenceUrl);
        } else {
          const uri = await synthesize(word, '中文女');
          setReferenceUri(uri);
        }
      } catch (err) {
        console.error('Failed to generate reference:', err);
      }
    };

    generateReference();
  }, [word, params.referenceUrl, synthesize]);

  const handlePlayReference = useCallback(async () => {
    if (!referenceUri) return;

    if (isPlaying) {
      await stopAudio();
    } else {
      await playAudio(referenceUri);
    }
  }, [referenceUri, isPlaying, playAudio, stopAudio]);

  const handleRecord = useCallback(async () => {
    if (isRecording) {
      const uri = await stopRecording();
      setAttempts((prev) => prev + 1);

      // Analyze the recording
      try {
        // Compare pitch contours
        if (referenceUri) {
          const pitchResult = await comparePitch(referenceUri, uri);
          setComparison(pitchResult);

          if (pitchResult.similarity > bestScore) {
            setBestScore(pitchResult.similarity);
          }
        }

        // Analyze tone if expected tone is provided
        if (expectedTone) {
          const toneAnalysis = await analyzeTone(uri, expectedTone);
          setToneResult({
            detected: toneAnalysis.detected_tone,
            expected: expectedTone,
            isCorrect: toneAnalysis.is_correct || false,
            confidence: toneAnalysis.confidence,
          });
        }
      } catch (err) {
        console.error('Analysis failed:', err);
      }
    } else {
      setComparison(null);
      setToneResult(null);
      await startRecording();
    }
  }, [
    isRecording,
    referenceUri,
    expectedTone,
    stopRecording,
    startRecording,
    comparePitch,
    analyzeTone,
    bestScore,
  ]);

  const handlePlayRecording = useCallback(async () => {
    if (!recordingUri) return;

    if (isPlaying) {
      await stopAudio();
    } else {
      await playAudio(recordingUri);
    }
  }, [recordingUri, isPlaying, playAudio, stopAudio]);

  const handleReset = useCallback(() => {
    setComparison(null);
    setToneResult(null);
  }, []);

  const getSimilarityColor = (score: number) => {
    if (score >= 0.8) return '#22c55e';
    if (score >= 0.6) return '#f59e0b';
    return '#ef4444';
  };

  const getSimilarityLabel = (score: number) => {
    if (score >= 0.9) return 'Excellent!';
    if (score >= 0.8) return 'Great!';
    if (score >= 0.7) return 'Good';
    if (score >= 0.6) return 'Getting there';
    return 'Keep practicing';
  };

  const isLoading = speechLoading || pitchLoading;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Shadowing Practice</Text>
        <View style={styles.statsContainer}>
          <Text style={styles.statText}>Attempts: {attempts}</Text>
          <Text style={styles.statText}>Best: {Math.round(bestScore * 100)}%</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Word Display */}
        <View style={styles.wordCard}>
          <Text style={styles.word}>{word}</Text>
          <Text style={styles.pinyin}>{pinyin}</Text>
          {expectedTone && (
            <Text style={styles.toneHint}>
              Target: {TONE_NAMES[expectedTone]}
            </Text>
          )}
        </View>

        {/* Reference Audio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reference Audio</Text>
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayReference}
            disabled={!referenceUri || isLoading}
          >
            {isPlaying && referenceUri ? (
              <Square size={24} color="#fff" />
            ) : (
              <Volume2 size={24} color="#fff" />
            )}
            <Text style={styles.playButtonText}>
              {isPlaying ? 'Stop' : 'Listen'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recording Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Recording</Text>
          <View style={styles.recordingControls}>
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
              ]}
              onPress={handleRecord}
              disabled={isLoading}
            >
              {isRecording ? (
                <MicOff size={32} color="#fff" />
              ) : (
                <Mic size={32} color="#fff" />
              )}
            </TouchableOpacity>
            <Text style={styles.recordHint}>
              {isRecording ? 'Tap to stop' : 'Tap to record'}
            </Text>
          </View>

          {recordingUri && !isRecording && (
            <TouchableOpacity
              style={styles.playRecordingButton}
              onPress={handlePlayRecording}
            >
              <Play size={20} color="#6366f1" />
              <Text style={styles.playRecordingText}>Play your recording</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Analyzing...</Text>
          </View>
        )}

        {/* Results */}
        {comparison && !isLoading && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Results</Text>

            {/* Similarity Score */}
            <View style={styles.scoreCard}>
              <View
                style={[
                  styles.scoreCircle,
                  { borderColor: getSimilarityColor(comparison.similarity) },
                ]}
              >
                <Text
                  style={[
                    styles.scoreText,
                    { color: getSimilarityColor(comparison.similarity) },
                  ]}
                >
                  {Math.round(comparison.similarity * 100)}%
                </Text>
              </View>
              <Text style={styles.scoreLabel}>
                {getSimilarityLabel(comparison.similarity)}
              </Text>
            </View>

            {/* Tone Result */}
            {toneResult && (
              <View style={styles.toneResult}>
                <View style={styles.toneResultHeader}>
                  {toneResult.isCorrect ? (
                    <Check size={20} color="#22c55e" />
                  ) : (
                    <AlertCircle size={20} color="#f59e0b" />
                  )}
                  <Text style={styles.toneResultText}>
                    {toneResult.isCorrect
                      ? 'Correct tone!'
                      : `Detected: ${TONE_NAMES[toneResult.detected]}`}
                  </Text>
                </View>
                <Text style={styles.toneConfidence}>
                  Confidence: {Math.round(toneResult.confidence * 100)}%
                </Text>
              </View>
            )}

            {/* Pitch Contour Graph */}
            <View style={styles.graphContainer}>
              <Text style={styles.graphTitle}>Pitch Comparison</Text>
              <PitchContourGraph
                referenceContour={comparison.reference_contour}
                userContour={comparison.user_contour}
                segmentScores={comparison.segment_scores}
              />
              <View style={styles.graphLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine, { borderStyle: 'dashed' }]} />
                  <Text style={styles.legendText}>Reference</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine, { backgroundColor: '#6366f1' }]} />
                  <Text style={styles.legendText}>Your voice</Text>
                </View>
              </View>
            </View>

            {/* Segment Scores */}
            <View style={styles.segmentScores}>
              <Text style={styles.segmentTitle}>Segment Accuracy</Text>
              <View style={styles.segmentBars}>
                {comparison.segment_scores.map((score, index) => (
                  <View key={index} style={styles.segmentBar}>
                    <View
                      style={[
                        styles.segmentFill,
                        {
                          height: `${score * 100}%`,
                          backgroundColor: getSimilarityColor(score),
                        },
                      ]}
                    />
                    <Text style={styles.segmentLabel}>{index + 1}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Try Again */}
            <TouchableOpacity style={styles.tryAgainButton} onPress={handleReset}>
              <RotateCcw size={20} color="#fff" />
              <Text style={styles.tryAgainText}>Try Again</Text>
            </TouchableOpacity>
          </View>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  content: {
    padding: 20,
  },
  wordCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  word: {
    fontSize: 48,
    fontWeight: '600',
    color: '#fff',
  },
  pinyin: {
    fontSize: 24,
    color: '#9ca3af',
    marginTop: 8,
  },
  toneHint: {
    fontSize: 14,
    color: '#6366f1',
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  playButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  recordingControls: {
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: {
    backgroundColor: '#ef4444',
  },
  recordHint: {
    marginTop: 12,
    fontSize: 14,
    color: '#9ca3af',
  },
  playRecordingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  playRecordingText: {
    fontSize: 14,
    color: '#6366f1',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9ca3af',
  },
  resultsSection: {
    marginTop: 8,
  },
  scoreCard: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
  },
  scoreText: {
    fontSize: 36,
    fontWeight: '700',
  },
  scoreLabel: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  toneResult: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  toneResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toneResultText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  toneConfidence: {
    marginTop: 8,
    fontSize: 14,
    color: '#9ca3af',
  },
  graphContainer: {
    marginBottom: 24,
  },
  graphTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
    marginBottom: 12,
  },
  graphLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendLine: {
    width: 24,
    height: 3,
    backgroundColor: '#6b7280',
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  segmentScores: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  segmentTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
    marginBottom: 12,
  },
  segmentBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 80,
    alignItems: 'flex-end',
  },
  segmentBar: {
    width: 40,
    height: '100%',
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  segmentFill: {
    width: '100%',
    borderRadius: 4,
  },
  segmentLabel: {
    position: 'absolute',
    bottom: -20,
    width: '100%',
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
  },
  tryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  tryAgainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
