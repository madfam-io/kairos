/**
 * Subscription and billing type definitions
 */

import type { SubscriptionTier } from './user';

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'trialing'
  | 'unpaid';

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  limits: SubscriptionLimits;
}

export interface SubscriptionLimits {
  cardsPerDay: number | null; // null = unlimited
  aiSentencesPerMonth: number | null;
  cloudSync: boolean;
  mobileApp: boolean;
  priorityProcessing: boolean;
  earlyFeatures: boolean;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    tier: 'free',
    name: 'Free',
    description: 'Get started with basic features',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Core video player',
      'Manual word lookup',
      '5 cards/day export',
      'Basic segmentation',
    ],
    limits: {
      cardsPerDay: 5,
      aiSentencesPerMonth: 0,
      cloudSync: false,
      mobileApp: false,
      priorityProcessing: false,
      earlyFeatures: false,
    },
  },
  learner: {
    tier: 'learner',
    name: 'Learner',
    description: 'Perfect for serious students',
    monthlyPrice: 8,
    yearlyPrice: 80,
    features: [
      'Everything in Free',
      'Unlimited card mining',
      'AI simplification (500/mo)',
      'Pitch visualization',
      'Cloud sync',
    ],
    limits: {
      cardsPerDay: null,
      aiSentencesPerMonth: 500,
      cloudSync: true,
      mobileApp: false,
      priorityProcessing: false,
      earlyFeatures: false,
    },
  },
  immersion: {
    tier: 'immersion',
    name: 'Immersion',
    description: 'For dedicated immersion learners',
    monthlyPrice: 12,
    yearlyPrice: 120,
    features: [
      'Everything in Learner',
      'Unlimited AI simplification',
      'Priority processing',
      'Mobile app access',
      'Early access to new features',
    ],
    limits: {
      cardsPerDay: null,
      aiSentencesPerMonth: null,
      cloudSync: true,
      mobileApp: true,
      priorityProcessing: true,
      earlyFeatures: true,
    },
  },
};

export interface UsageStats {
  cardsMinedToday: number;
  aiSentencesThisMonth: number;
  periodStart: Date;
  periodEnd: Date;
}
