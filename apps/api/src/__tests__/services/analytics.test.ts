import { describe, it, expect } from 'bun:test';
import {
  generateMockProgressData,
  generateMockSummary,
  generateMockHeatmap,
  calculateMilestones,
  type SummaryStats,
} from '../../services/analytics';

describe('Analytics Service', () => {
  describe('generateMockProgressData', () => {
    it('should generate data for the specified date range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');

      const data = generateMockProgressData(startDate, endDate, 'day');

      expect(data.wordsLearned.length).toBe(7);
      expect(data.hskProgress.length).toBe(7);
      expect(data.reviewAccuracy.length).toBe(7);
    });

    it('should include streak history', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');

      const data = generateMockProgressData(startDate, endDate, 'day');

      expect(data.streakHistory).toBeDefined();
      expect(Array.isArray(data.streakHistory)).toBe(true);
      expect(data.streakHistory.length).toBeGreaterThan(0);
    });

    it('should have proper structure for daily stats', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');

      const data = generateMockProgressData(startDate, endDate, 'day');
      const day = data.wordsLearned[0];

      expect(day.date).toBeDefined();
      expect(typeof day.wordsLearned).toBe('number');
      expect(typeof day.wordsReviewed).toBe('number');
      expect(typeof day.cardsMined).toBe('number');
      expect(typeof day.studyTimeMinutes).toBe('number');
      expect(typeof day.sessionsCount).toBe('number');
    });

    it('should have proper structure for HSK progress', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');

      const data = generateMockProgressData(startDate, endDate, 'day');
      const progress = data.hskProgress[0];

      expect(progress.date).toBeDefined();
      expect(typeof progress.level).toBe('number');
      expect(typeof progress.vocabularySize).toBe('number');
    });

    it('should have proper structure for review accuracy', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');

      const data = generateMockProgressData(startDate, endDate, 'day');
      const accuracy = data.reviewAccuracy[0];

      expect(accuracy.date).toBeDefined();
      expect(typeof accuracy.correct).toBe('number');
      expect(typeof accuracy.total).toBe('number');
      expect(typeof accuracy.accuracy).toBe('number');
      expect(accuracy.accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy.accuracy).toBeLessThanOrEqual(100);
    });

    it('should show cumulative vocabulary growth', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10');

      const data = generateMockProgressData(startDate, endDate, 'day');

      // Vocabulary should generally increase over time
      const firstVocab = data.hskProgress[0].vocabularySize;
      const lastVocab = data.hskProgress[data.hskProgress.length - 1].vocabularySize;

      expect(lastVocab).toBeGreaterThanOrEqual(firstVocab);
    });
  });

  describe('generateMockSummary', () => {
    it('should return summary with all required sections', () => {
      const summary = generateMockSummary();

      expect(summary.today).toBeDefined();
      expect(summary.thisWeek).toBeDefined();
      expect(summary.thisMonth).toBeDefined();
      expect(summary.allTime).toBeDefined();
      expect(summary.streakStatus).toBeDefined();
      expect(summary.hskLevel).toBeDefined();
    });

    it('should have proper today stats structure', () => {
      const summary = generateMockSummary();

      expect(typeof summary.today.wordsLearned).toBe('number');
      expect(typeof summary.today.wordsReviewed).toBe('number');
      expect(typeof summary.today.cardsMined).toBe('number');
      expect(typeof summary.today.studyTimeMinutes).toBe('number');
      expect(typeof summary.today.simplificationsUsed).toBe('number');
      expect(typeof summary.today.reviewAccuracy).toBe('number');
    });

    it('should have proper allTime stats structure', () => {
      const summary = generateMockSummary();

      expect(typeof summary.allTime.totalWordsLearned).toBe('number');
      expect(typeof summary.allTime.totalWordsReviewed).toBe('number');
      expect(typeof summary.allTime.totalCardsMined).toBe('number');
      expect(typeof summary.allTime.totalStudyTimeHours).toBe('number');
      expect(typeof summary.allTime.longestStreak).toBe('number');
      expect(typeof summary.allTime.currentStreak).toBe('number');
      expect(typeof summary.allTime.accountAgeInDays).toBe('number');
    });

    it('should have proper streak status structure', () => {
      const summary = generateMockSummary();

      expect(typeof summary.streakStatus.current).toBe('number');
      expect(typeof summary.streakStatus.longest).toBe('number');
      expect(typeof summary.streakStatus.todayCompleted).toBe('boolean');
      expect(typeof summary.streakStatus.nextMilestone).toBe('number');
    });

    it('should have proper HSK level structure', () => {
      const summary = generateMockSummary();

      expect(typeof summary.hskLevel.current).toBe('number');
      expect(typeof summary.hskLevel.progress).toBe('number');
      expect(typeof summary.hskLevel.vocabularySize).toBe('number');
    });

    it('should return positive values', () => {
      const summary = generateMockSummary();

      expect(summary.today.wordsLearned).toBeGreaterThanOrEqual(0);
      expect(summary.thisWeek.wordsLearned).toBeGreaterThanOrEqual(0);
      expect(summary.allTime.totalWordsLearned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateMockHeatmap', () => {
    it('should generate heatmap data for specified days', () => {
      const heatmap = generateMockHeatmap(30);

      expect(heatmap.days).toBeDefined();
      expect(typeof heatmap.maxActivity).toBe('number');
      expect(typeof heatmap.totalActiveDays).toBe('number');
    });

    it('should default to 365 days', () => {
      const heatmap = generateMockHeatmap();

      expect(Object.keys(heatmap.days).length).toBe(365);
    });

    it('should have activity levels between 0 and 4', () => {
      const heatmap = generateMockHeatmap(100);

      for (const level of Object.values(heatmap.days)) {
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(4);
      }
    });

    it('should have max activity between 0 and 4', () => {
      const heatmap = generateMockHeatmap(100);

      expect(heatmap.maxActivity).toBeGreaterThanOrEqual(0);
      expect(heatmap.maxActivity).toBeLessThanOrEqual(4);
    });

    it('should track total active days correctly', () => {
      const heatmap = generateMockHeatmap(30);

      const actualActiveDays = Object.values(heatmap.days).filter((v) => v > 0).length;
      expect(heatmap.totalActiveDays).toBe(actualActiveDays);
    });
  });

  describe('calculateMilestones', () => {
    const createMockStats = (overrides: Partial<SummaryStats> = {}): SummaryStats => ({
      today: {
        wordsLearned: 10,
        wordsReviewed: 30,
        cardsMined: 3,
        studyTimeMinutes: 25,
        simplificationsUsed: 5,
        reviewAccuracy: 85,
      },
      thisWeek: {
        wordsLearned: 50,
        wordsReviewed: 200,
        cardsMined: 15,
        studyTimeMinutes: 150,
        averageSessionMinutes: 20,
        averageAccuracy: 80,
      },
      thisMonth: {
        wordsLearned: 200,
        wordsReviewed: 800,
        cardsMined: 60,
        studyTimeMinutes: 600,
        daysActive: 20,
      },
      allTime: {
        totalWordsLearned: 500,
        totalWordsReviewed: 5000,
        totalCardsMined: 150,
        totalStudyTimeHours: 40,
        longestStreak: 25,
        currentStreak: 10,
        accountAgeInDays: 90,
      },
      streakStatus: {
        current: 10,
        longest: 25,
        todayCompleted: true,
        nextMilestone: 30,
      },
      hskLevel: {
        current: 2.5,
        progress: 50,
        vocabularySize: 450,
      },
      ...overrides,
    });

    it('should return array of milestones', () => {
      const stats = createMockStats();
      const milestones = calculateMilestones(stats);

      expect(Array.isArray(milestones)).toBe(true);
      expect(milestones.length).toBeGreaterThan(0);
    });

    it('should have proper milestone structure', () => {
      const stats = createMockStats();
      const milestones = calculateMilestones(stats);
      const milestone = milestones[0];

      expect(milestone.id).toBeDefined();
      expect(milestone.title).toBeDefined();
      expect(milestone.description).toBeDefined();
      expect(typeof milestone.achieved).toBe('boolean');
      expect(typeof milestone.progress).toBe('number');
      expect(typeof milestone.target).toBe('number');
      expect(milestone.icon).toBeDefined();
    });

    it('should mark first-100-words as achieved when >= 100 words', () => {
      const stats = createMockStats({
        allTime: {
          totalWordsLearned: 150,
          totalWordsReviewed: 5000,
          totalCardsMined: 150,
          totalStudyTimeHours: 40,
          longestStreak: 25,
          currentStreak: 10,
          accountAgeInDays: 90,
        },
      });
      const milestones = calculateMilestones(stats);
      const first100 = milestones.find((m) => m.id === 'first-100-words');

      expect(first100?.achieved).toBe(true);
    });

    it('should mark first-100-words as not achieved when < 100 words', () => {
      const stats = createMockStats({
        allTime: {
          totalWordsLearned: 50,
          totalWordsReviewed: 5000,
          totalCardsMined: 150,
          totalStudyTimeHours: 40,
          longestStreak: 25,
          currentStreak: 10,
          accountAgeInDays: 90,
        },
      });
      const milestones = calculateMilestones(stats);
      const first100 = milestones.find((m) => m.id === 'first-100-words');

      expect(first100?.achieved).toBe(false);
      expect(first100?.progress).toBe(50);
    });

    it('should mark week-streak as achieved when longest >= 7', () => {
      const stats = createMockStats({
        allTime: {
          totalWordsLearned: 500,
          totalWordsReviewed: 5000,
          totalCardsMined: 150,
          totalStudyTimeHours: 40,
          longestStreak: 10,
          currentStreak: 5,
          accountAgeInDays: 90,
        },
      });
      const milestones = calculateMilestones(stats);
      const weekStreak = milestones.find((m) => m.id === 'week-streak');

      expect(weekStreak?.achieved).toBe(true);
    });

    it('should mark month-streak as not achieved when longest < 30', () => {
      const stats = createMockStats({
        allTime: {
          totalWordsLearned: 500,
          totalWordsReviewed: 5000,
          totalCardsMined: 150,
          totalStudyTimeHours: 40,
          longestStreak: 20,
          currentStreak: 15,
          accountAgeInDays: 90,
        },
      });
      const milestones = calculateMilestones(stats);
      const monthStreak = milestones.find((m) => m.id === 'month-streak');

      expect(monthStreak?.achieved).toBe(false);
    });

    it('should track HSK-2 progress correctly', () => {
      const stats = createMockStats({
        hskLevel: {
          current: 2.5,
          progress: 50,
          vocabularySize: 350,
        },
      });
      const milestones = calculateMilestones(stats);
      const hsk2 = milestones.find((m) => m.id === 'hsk-2');

      expect(hsk2?.achieved).toBe(true);
      expect(hsk2?.progress).toBeLessThanOrEqual(hsk2?.target ?? 0);
    });

    it('should track review-master progress correctly', () => {
      const stats = createMockStats({
        allTime: {
          totalWordsLearned: 500,
          totalWordsReviewed: 1500,
          totalCardsMined: 150,
          totalStudyTimeHours: 40,
          longestStreak: 25,
          currentStreak: 10,
          accountAgeInDays: 90,
        },
      });
      const milestones = calculateMilestones(stats);
      const reviewMaster = milestones.find((m) => m.id === 'review-master');

      expect(reviewMaster?.achieved).toBe(true);
    });

    it('should track time-invested milestone correctly', () => {
      const stats = createMockStats({
        allTime: {
          totalWordsLearned: 500,
          totalWordsReviewed: 5000,
          totalCardsMined: 150,
          totalStudyTimeHours: 60,
          longestStreak: 25,
          currentStreak: 10,
          accountAgeInDays: 90,
        },
      });
      const milestones = calculateMilestones(stats);
      const timeInvested = milestones.find((m) => m.id === 'time-invested');

      expect(timeInvested?.achieved).toBe(true);
    });
  });
});
