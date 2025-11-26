import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, Zap, Crown, Sparkles } from 'lucide-react-native';

import { useSubscription, type SubscriptionTier } from '~/hooks/useSubscription';

interface PlanCardProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  current?: boolean;
  onSelect: () => void;
  loading?: boolean;
}

function PlanCard({
  name,
  price,
  period,
  description,
  features,
  highlighted,
  current,
  onSelect,
  loading,
}: PlanCardProps) {
  return (
    <View
      style={[
        styles.planCard,
        highlighted && styles.planCardHighlighted,
        current && styles.planCardCurrent,
      ]}
    >
      {highlighted && (
        <View style={styles.popularBadge}>
          <Sparkles size={12} color="#fff" />
          <Text style={styles.popularBadgeText}>Most Popular</Text>
        </View>
      )}

      <Text style={styles.planName}>{name}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.priceAmount}>{price}</Text>
        <Text style={styles.pricePeriod}>/{period}</Text>
      </View>
      <Text style={styles.planDescription}>{description}</Text>

      <View style={styles.featuresList}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Check size={16} color="#22c55e" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.selectButton,
          highlighted && styles.selectButtonHighlighted,
          current && styles.selectButtonCurrent,
        ]}
        onPress={onSelect}
        disabled={current || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text
            style={[
              styles.selectButtonText,
              current && styles.selectButtonTextCurrent,
            ]}
          >
            {current ? 'Current Plan' : 'Select Plan'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier, subscription, upgrade, openPortal, loading } = useSubscription();
  const [upgrading, setUpgrading] = useState<SubscriptionTier | null>(null);

  const handleSelectPlan = async (planTier: SubscriptionTier) => {
    if (planTier === 'free' || planTier === tier) return;

    setUpgrading(planTier);
    try {
      await upgrade(planTier as 'learner' | 'immersion');
    } catch (error) {
      Alert.alert(
        'Upgrade Failed',
        error instanceof Error ? error.message : 'Please try again'
      );
    } finally {
      setUpgrading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openPortal();
    } catch (error) {
      Alert.alert('Error', 'Failed to open billing portal');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Upgrade Your Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Plan Banner */}
        {subscription && (
          <View style={styles.currentPlanBanner}>
            <View style={styles.currentPlanInfo}>
              <Crown size={20} color="#f59e0b" />
              <Text style={styles.currentPlanText}>
                You're on the {tier.charAt(0).toUpperCase() + tier.slice(1)} plan
              </Text>
            </View>
            <TouchableOpacity onPress={handleManageSubscription}>
              <Text style={styles.manageLink}>Manage</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Plans */}
        <View style={styles.plansContainer}>
          {/* Free Plan */}
          <PlanCard
            name="Free"
            price="$0"
            period="month"
            description="Perfect for getting started with Chinese learning"
            features={[
              '10 new cards per day',
              '50 reviews per day',
              '500 vocabulary limit',
              'Basic SRS flashcards',
              'Browser extension',
            ]}
            current={tier === 'free'}
            onSelect={() => {}}
          />

          {/* Learner Plan */}
          <PlanCard
            name="Learner"
            price="$9"
            period="month"
            description="For dedicated learners ready to accelerate"
            features={[
              '50 new cards per day',
              '200 reviews per day',
              '5,000 vocabulary limit',
              '100 AI simplifications/mo',
              'Anki export',
              'Priority support',
            ]}
            highlighted
            current={tier === 'learner'}
            onSelect={() => handleSelectPlan('learner')}
            loading={upgrading === 'learner'}
          />

          {/* Immersion Plan */}
          <PlanCard
            name="Immersion"
            price="$19"
            period="month"
            description="Unlimited access for serious learners"
            features={[
              'Unlimited cards',
              'Unlimited reviews',
              'Unlimited vocabulary',
              'Unlimited AI simplifications',
              'Anki export',
              'Priority support',
              'Early access to features',
            ]}
            current={tier === 'immersion'}
            onSelect={() => handleSelectPlan('immersion')}
            loading={upgrading === 'immersion'}
          />
        </View>

        {/* FAQ */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I cancel anytime?</Text>
            <Text style={styles.faqAnswer}>
              Yes! You can cancel your subscription at any time. You'll continue
              to have access until the end of your billing period.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What payment methods do you accept?</Text>
            <Text style={styles.faqAnswer}>
              We accept all major credit cards, PayPal, and local payment methods
              through our payment partner Polar.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I switch plans?</Text>
            <Text style={styles.faqAnswer}>
              Yes! You can upgrade or downgrade at any time. When upgrading,
              you'll be charged the prorated difference.
            </Text>
          </View>
        </View>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  currentPlanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  currentPlanInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentPlanText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '500',
  },
  manageLink: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  plansContainer: {
    gap: 16,
    marginBottom: 32,
  },
  planCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  planCardHighlighted: {
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  planCardCurrent: {
    borderColor: '#22c55e',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  planName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  pricePeriod: {
    fontSize: 16,
    color: '#9ca3af',
    marginLeft: 4,
  },
  planDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 20,
  },
  featuresList: {
    gap: 12,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  selectButton: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  selectButtonHighlighted: {
    backgroundColor: '#6366f1',
  },
  selectButtonCurrent: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  selectButtonTextCurrent: {
    color: '#22c55e',
  },
  faqSection: {
    marginTop: 16,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
  },
  faqItem: {
    marginBottom: 20,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 22,
  },
});
