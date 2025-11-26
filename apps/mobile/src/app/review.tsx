import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { X, Volume2, RotateCcw, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCards, Card, ReviewRating } from '~/hooks/useCards';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dueCards, reviewCard } = useCards();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentCard = dueCards[currentIndex];
  const progress = dueCards.length > 0 ? ((currentIndex) / dueCards.length) * 100 : 0;

  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  const handleRate = useCallback(async (rating: ReviewRating) => {
    if (!currentCard || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await reviewCard(currentCard.id, rating);

      // Move to next card
      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setShowAnswer(false);
      } else {
        // All cards reviewed
        router.back();
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentCard, currentIndex, dueCards.length, reviewCard, isSubmitting]);

  const handleClose = () => {
    router.back();
  };

  if (dueCards.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyContainer}>
          <Check size={64} color="#22c55e" />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtext}>No cards due for review right now.</Text>
          <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
            <Text style={styles.doneButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {currentIndex + 1} / {dueCards.length}
          </Text>
        </View>
      </View>

      {/* Card */}
      <View style={styles.cardContainer}>
        <View style={styles.card}>
          {/* Front - Word */}
          <View style={styles.cardFront}>
            <Text style={styles.word}>{currentCard.word}</Text>
            {currentCard.pinyin && (
              <Text style={styles.pinyin}>{currentCard.pinyin}</Text>
            )}
          </View>

          {/* Back - Answer (shown on tap) */}
          {showAnswer && (
            <View style={styles.cardBack}>
              <View style={styles.divider} />
              <View style={styles.definitions}>
                {currentCard.definitions.map((def, index) => (
                  <Text key={index} style={styles.definition}>
                    {index + 1}. {def}
                  </Text>
                ))}
              </View>
              {currentCard.sentence && (
                <View style={styles.sentenceContainer}>
                  <Text style={styles.sentenceLabel}>Example:</Text>
                  <Text style={styles.sentence}>{currentCard.sentence}</Text>
                  {currentCard.translation && (
                    <Text style={styles.translation}>{currentCard.translation}</Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Audio Button */}
        {currentCard.audioUrl && (
          <TouchableOpacity style={styles.audioButton}>
            <Volume2 size={24} color="#6366f1" />
          </TouchableOpacity>
        )}
      </View>

      {/* Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        {!showAnswer ? (
          <TouchableOpacity
            style={styles.showAnswerButton}
            onPress={handleShowAnswer}
          >
            <Text style={styles.showAnswerText}>Show Answer</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.ratingButtons}>
            <TouchableOpacity
              style={[styles.ratingButton, styles.againButton]}
              onPress={() => handleRate('again')}
              disabled={isSubmitting}
            >
              <RotateCcw size={20} color="#ef4444" />
              <Text style={[styles.ratingText, styles.againText]}>Again</Text>
              <Text style={styles.ratingInterval}>&lt;1min</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ratingButton, styles.hardButton]}
              onPress={() => handleRate('hard')}
              disabled={isSubmitting}
            >
              <ChevronLeft size={20} color="#f59e0b" />
              <Text style={[styles.ratingText, styles.hardText]}>Hard</Text>
              <Text style={styles.ratingInterval}>1d</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ratingButton, styles.goodButton]}
              onPress={() => handleRate('good')}
              disabled={isSubmitting}
            >
              <Check size={20} color="#22c55e" />
              <Text style={[styles.ratingText, styles.goodText]}>Good</Text>
              <Text style={styles.ratingInterval}>3d</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ratingButton, styles.easyButton]}
              onPress={() => handleRate('easy')}
              disabled={isSubmitting}
            >
              <ChevronRight size={20} color="#6366f1" />
              <Text style={[styles.ratingText, styles.easyText]}>Easy</Text>
              <Text style={styles.ratingInterval}>7d</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  },
  closeButton: {
    padding: 8,
  },
  progressContainer: {
    flex: 1,
    marginLeft: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#1f2937',
    borderRadius: 20,
    padding: 32,
    minHeight: 300,
  },
  cardFront: {
    alignItems: 'center',
  },
  word: {
    fontSize: 48,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  pinyin: {
    fontSize: 24,
    color: '#9ca3af',
    marginTop: 8,
  },
  cardBack: {
    marginTop: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginBottom: 24,
  },
  definitions: {
    marginBottom: 16,
  },
  definition: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 8,
  },
  sentenceContainer: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
  },
  sentenceLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sentence: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 8,
  },
  translation: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  audioButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    padding: 16,
  },
  showAnswerButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  showAnswerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1f2937',
  },
  againButton: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  hardButton: {
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  goodButton: {
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  easyButton: {
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  againText: {
    color: '#ef4444',
  },
  hardText: {
    color: '#f59e0b',
  },
  goodText: {
    color: '#22c55e',
  },
  easyText: {
    color: '#6366f1',
  },
  ratingInterval: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
  },
  doneButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
