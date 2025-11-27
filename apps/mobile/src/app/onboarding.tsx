import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  BookOpen,
  Target,
  Tv,
  Briefcase,
  Globe,
  Sparkles,
  Clock,
  User,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Step definitions
type OnboardingStep =
  | 'welcome'
  | 'language_background'
  | 'learning_goals'
  | 'daily_commitment'
  | 'interests'
  | 'assessment_intro'
  | 'complete';

interface StepConfig {
  id: OnboardingStep;
  title: string;
  subtitle?: string;
}

const STEPS: StepConfig[] = [
  { id: 'welcome', title: 'Welcome to Kairos', subtitle: 'Your personalized Chinese learning journey' },
  { id: 'language_background', title: 'Your Background', subtitle: 'Tell us about your Chinese experience' },
  { id: 'learning_goals', title: 'Your Goals', subtitle: 'What do you want to achieve?' },
  { id: 'daily_commitment', title: 'Daily Practice', subtitle: 'How much time can you dedicate?' },
  { id: 'interests', title: 'Your Interests', subtitle: 'What topics interest you?' },
  { id: 'assessment_intro', title: 'Quick Assessment', subtitle: "Let's find your level" },
  { id: 'complete', title: 'All Set!', subtitle: "You're ready to start learning" },
];

// Options for selections
const EXPERIENCE_LEVELS = [
  { id: 'none', label: 'Complete Beginner', description: 'No prior Chinese knowledge' },
  { id: 'some', label: 'Some Exposure', description: 'Know a few words or phrases' },
  { id: 'hsk1-2', label: 'HSK 1-2', description: 'Basic vocabulary and sentences' },
  { id: 'hsk3-4', label: 'HSK 3-4', description: 'Intermediate conversations' },
  { id: 'hsk5-6', label: 'HSK 5+', description: 'Advanced proficiency' },
];

const LEARNING_GOALS = [
  { id: 'conversation', label: 'Conversation', icon: User, description: 'Speak with native speakers' },
  { id: 'media', label: 'Media', icon: Tv, description: 'Watch shows without subtitles' },
  { id: 'business', label: 'Business', icon: Briefcase, description: 'Use Chinese at work' },
  { id: 'travel', label: 'Travel', icon: Globe, description: 'Navigate China confidently' },
  { id: 'academic', label: 'Academic', icon: BookOpen, description: 'Pass HSK exams' },
];

const TIME_COMMITMENTS = [
  { id: '5', label: '5 minutes', description: 'Quick daily practice' },
  { id: '15', label: '15 minutes', description: 'Steady progress' },
  { id: '30', label: '30 minutes', description: 'Dedicated learning' },
  { id: '60', label: '1 hour+', description: 'Intensive study' },
];

const INTERESTS = [
  { id: 'drama', label: 'C-Drama' },
  { id: 'movies', label: 'Movies' },
  { id: 'music', label: 'Music' },
  { id: 'news', label: 'News' },
  { id: 'tech', label: 'Technology' },
  { id: 'food', label: 'Food & Cooking' },
  { id: 'history', label: 'History' },
  { id: 'travel', label: 'Travel' },
  { id: 'business', label: 'Business' },
  { id: 'sports', label: 'Sports' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'literature', label: 'Literature' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selections, setSelections] = useState({
    experienceLevel: '',
    primaryGoal: '',
    secondaryGoals: [] as string[],
    dailyMinutes: '',
    interests: [] as string[],
  });

  const currentStep = STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const canProceed = () => {
    switch (currentStep.id) {
      case 'welcome':
        return true;
      case 'language_background':
        return !!selections.experienceLevel;
      case 'learning_goals':
        return !!selections.primaryGoal;
      case 'daily_commitment':
        return !!selections.dailyMinutes;
      case 'interests':
        return selections.interests.length >= 2;
      case 'assessment_intro':
        return true;
      case 'complete':
        return true;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (isLastStep) {
      // Complete onboarding
      router.replace('/(tabs)');
      return;
    }

    const nextIndex = currentStepIndex + 1;
    setCurrentStepIndex(nextIndex);
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  };

  const goBack = () => {
    if (isFirstStep) return;

    const prevIndex = currentStepIndex - 1;
    setCurrentStepIndex(prevIndex);
    flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
  };

  const skipOnboarding = () => {
    router.replace('/(tabs)');
  };

  const toggleInterest = (interestId: string) => {
    setSelections((prev) => ({
      ...prev,
      interests: prev.interests.includes(interestId)
        ? prev.interests.filter((i) => i !== interestId)
        : [...prev.interests, interestId],
    }));
  };

  const toggleSecondaryGoal = (goalId: string) => {
    if (goalId === selections.primaryGoal) return;
    setSelections((prev) => ({
      ...prev,
      secondaryGoals: prev.secondaryGoals.includes(goalId)
        ? prev.secondaryGoals.filter((g) => g !== goalId)
        : [...prev.secondaryGoals, goalId],
    }));
  };

  const renderStep = ({ item, index }: { item: StepConfig; index: number }) => {
    return (
      <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
        <ScrollView
          contentContainerStyle={styles.stepContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Step content based on step id */}
          {item.id === 'welcome' && <WelcomeStep />}
          {item.id === 'language_background' && (
            <BackgroundStep
              selected={selections.experienceLevel}
              onSelect={(level) => setSelections((p) => ({ ...p, experienceLevel: level }))}
            />
          )}
          {item.id === 'learning_goals' && (
            <GoalsStep
              primaryGoal={selections.primaryGoal}
              secondaryGoals={selections.secondaryGoals}
              onSelectPrimary={(goal) => setSelections((p) => ({ ...p, primaryGoal: goal }))}
              onToggleSecondary={toggleSecondaryGoal}
            />
          )}
          {item.id === 'daily_commitment' && (
            <TimeStep
              selected={selections.dailyMinutes}
              onSelect={(time) => setSelections((p) => ({ ...p, dailyMinutes: time }))}
            />
          )}
          {item.id === 'interests' && (
            <InterestsStep
              selected={selections.interests}
              onToggle={toggleInterest}
            />
          )}
          {item.id === 'assessment_intro' && <AssessmentIntroStep />}
          {item.id === 'complete' && <CompleteStep />}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {!isFirstStep ? (
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}

        {/* Progress dots */}
        <View style={styles.progressDots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentStepIndex && styles.dotActive,
                i < currentStepIndex && styles.dotCompleted,
              ]}
            />
          ))}
        </View>

        {!isLastStep ? (
          <TouchableOpacity onPress={skipOnboarding} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Step Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{currentStep.title}</Text>
        {currentStep.subtitle && (
          <Text style={styles.subtitle}>{currentStep.subtitle}</Text>
        )}
      </View>

      {/* Step Content */}
      <FlatList
        ref={flatListRef}
        data={STEPS}
        renderItem={renderStep}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
      />

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.continueButton, !canProceed() && styles.continueButtonDisabled]}
          onPress={goNext}
          disabled={!canProceed()}
        >
          <Text style={styles.continueText}>
            {isLastStep ? 'Get Started' : 'Continue'}
          </Text>
          {!isLastStep && <ChevronRight size={20} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Step Components
function WelcomeStep() {
  return (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeIcon}>
        <Sparkles size={64} color="#6366f1" />
      </View>
      <Text style={styles.welcomeTitle}>Learn Chinese Through Content You Love</Text>
      <Text style={styles.welcomeDescription}>
        Mine vocabulary from shows, movies, and podcasts. Build a personalized
        flashcard deck that grows with you.
      </Text>

      <View style={styles.featureList}>
        <FeatureItem icon={<Tv size={20} color="#6366f1" />} text="Learn from native content" />
        <FeatureItem icon={<Target size={20} color="#22c55e" />} text="Personalized to your level" />
        <FeatureItem icon={<Clock size={20} color="#f59e0b" />} text="Spaced repetition for retention" />
      </View>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.featureItem}>
      {icon}
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function BackgroundStep({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (level: string) => void;
}) {
  return (
    <View style={styles.optionsContainer}>
      {EXPERIENCE_LEVELS.map((level) => (
        <TouchableOpacity
          key={level.id}
          style={[styles.optionCard, selected === level.id && styles.optionCardSelected]}
          onPress={() => onSelect(level.id)}
        >
          <View style={styles.optionContent}>
            <Text style={[styles.optionLabel, selected === level.id && styles.optionLabelSelected]}>
              {level.label}
            </Text>
            <Text style={styles.optionDescription}>{level.description}</Text>
          </View>
          {selected === level.id && (
            <View style={styles.checkCircle}>
              <Check size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function GoalsStep({
  primaryGoal,
  secondaryGoals,
  onSelectPrimary,
  onToggleSecondary,
}: {
  primaryGoal: string;
  secondaryGoals: string[];
  onSelectPrimary: (goal: string) => void;
  onToggleSecondary: (goal: string) => void;
}) {
  return (
    <View style={styles.optionsContainer}>
      <Text style={styles.optionGroupLabel}>Primary Goal</Text>
      {LEARNING_GOALS.map((goal) => {
        const Icon = goal.icon;
        const isPrimary = primaryGoal === goal.id;
        const isSecondary = secondaryGoals.includes(goal.id);

        return (
          <TouchableOpacity
            key={goal.id}
            style={[
              styles.goalCard,
              isPrimary && styles.goalCardPrimary,
              isSecondary && styles.goalCardSecondary,
            ]}
            onPress={() => (isPrimary ? null : onSelectPrimary(goal.id))}
            onLongPress={() => onToggleSecondary(goal.id)}
          >
            <View style={[styles.goalIcon, isPrimary && styles.goalIconPrimary]}>
              <Icon size={24} color={isPrimary ? '#fff' : '#6366f1'} />
            </View>
            <View style={styles.goalContent}>
              <Text style={[styles.goalLabel, isPrimary && styles.goalLabelPrimary]}>
                {goal.label}
              </Text>
              <Text style={styles.goalDescription}>{goal.description}</Text>
            </View>
            {isPrimary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>Primary</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      <Text style={styles.hintText}>Long press to add secondary goals</Text>
    </View>
  );
}

function TimeStep({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (time: string) => void;
}) {
  return (
    <View style={styles.optionsContainer}>
      {TIME_COMMITMENTS.map((time) => (
        <TouchableOpacity
          key={time.id}
          style={[styles.timeCard, selected === time.id && styles.timeCardSelected]}
          onPress={() => onSelect(time.id)}
        >
          <Clock size={24} color={selected === time.id ? '#6366f1' : '#6b7280'} />
          <Text style={[styles.timeLabel, selected === time.id && styles.timeLabelSelected]}>
            {time.label}
          </Text>
          <Text style={styles.timeDescription}>{time.description}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function InterestsStep({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (interest: string) => void;
}) {
  return (
    <View style={styles.interestsContainer}>
      <Text style={styles.interestsHint}>Select at least 2 topics you're interested in</Text>
      <View style={styles.interestsGrid}>
        {INTERESTS.map((interest) => {
          const isSelected = selected.includes(interest.id);
          return (
            <TouchableOpacity
              key={interest.id}
              style={[styles.interestChip, isSelected && styles.interestChipSelected]}
              onPress={() => onToggle(interest.id)}
            >
              <Text style={[styles.interestLabel, isSelected && styles.interestLabelSelected]}>
                {interest.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.selectedCount}>
        {selected.length} selected
      </Text>
    </View>
  );
}

function AssessmentIntroStep() {
  return (
    <View style={styles.assessmentIntro}>
      <View style={styles.assessmentIcon}>
        <Target size={64} color="#6366f1" />
      </View>
      <Text style={styles.assessmentTitle}>Quick Level Check</Text>
      <Text style={styles.assessmentDescription}>
        We'll ask you a few questions to determine your current Chinese level.
        This helps us personalize your learning experience.
      </Text>
      <View style={styles.assessmentInfo}>
        <View style={styles.infoItem}>
          <Clock size={16} color="#6b7280" />
          <Text style={styles.infoText}>Takes about 2 minutes</Text>
        </View>
        <View style={styles.infoItem}>
          <Check size={16} color="#6b7280" />
          <Text style={styles.infoText}>10-15 questions</Text>
        </View>
        <View style={styles.infoItem}>
          <Sparkles size={16} color="#6b7280" />
          <Text style={styles.infoText}>Adaptive difficulty</Text>
        </View>
      </View>
    </View>
  );
}

function CompleteStep() {
  return (
    <View style={styles.completeContainer}>
      <View style={styles.completeIcon}>
        <Check size={64} color="#22c55e" />
      </View>
      <Text style={styles.completeTitle}>You're All Set!</Text>
      <Text style={styles.completeDescription}>
        Your personalized learning path is ready. Start exploring content
        and building your vocabulary!
      </Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151',
  },
  dotActive: {
    backgroundColor: '#6366f1',
    width: 24,
  },
  dotCompleted: {
    backgroundColor: '#22c55e',
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    color: '#6b7280',
    fontSize: 14,
  },
  titleContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
  },
  stepContainer: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  continueButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#374151',
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Welcome step
  welcomeContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  welcomeIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6366f120',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  featureList: {
    width: '100%',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  featureText: {
    fontSize: 15,
    color: '#fff',
  },

  // Options container
  optionsContainer: {
    gap: 12,
  },
  optionGroupLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f110',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: '#6366f1',
  },
  optionDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Goals
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalCardPrimary: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f110',
  },
  goalCardSecondary: {
    borderColor: '#6366f150',
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f120',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalIconPrimary: {
    backgroundColor: '#6366f1',
  },
  goalContent: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  goalLabelPrimary: {
    color: '#6366f1',
  },
  goalDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  primaryBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  primaryBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  hintText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },

  // Time
  timeCard: {
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f110',
  },
  timeLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  timeLabelSelected: {
    color: '#6366f1',
  },
  timeDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },

  // Interests
  interestsContainer: {
    gap: 16,
  },
  interestsHint: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  interestChipSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f120',
  },
  interestLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  interestLabelSelected: {
    color: '#6366f1',
  },
  selectedCount: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
  },

  // Assessment intro
  assessmentIntro: {
    alignItems: 'center',
    paddingTop: 40,
  },
  assessmentIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6366f120',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  assessmentTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  assessmentDescription: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  assessmentInfo: {
    gap: 12,
    width: '100%',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#9ca3af',
  },

  // Complete
  completeContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  completeIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#22c55e20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  completeDescription: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },
});
