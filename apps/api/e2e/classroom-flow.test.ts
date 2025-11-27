/**
 * E2E Tests: Classroom Management Flow
 *
 * Tests the complete classroom lifecycle:
 * 1. Create classroom (as tutor)
 * 2. Generate join code
 * 3. Students join classroom
 * 4. Create assignments
 * 5. Track student progress
 * 6. View leaderboard
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanTestData,
  createTestUser,
  createAuthToken,
  createE2ERequestHelpers,
  e2eGenerators,
  canRunE2ETests,
  getTestDb,
} from './setup';
import * as schema from '../src/db/schema';

const describeE2E = canRunE2ETests() ? describe : describe.skip;

describeE2E('E2E: Classroom Management Flow', () => {
  let tutorUser: { id: string; email: string };
  let tutorToken: string;
  let tutorApi: ReturnType<typeof createE2ERequestHelpers>;

  let studentUser: { id: string; email: string };
  let studentToken: string;
  let studentApi: ReturnType<typeof createE2ERequestHelpers>;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestData();

    // Create tutor user (immersion tier for full access)
    tutorUser = await createTestUser({
      email: 'tutor@example.com',
      subscriptionTier: 'immersion',
    });
    tutorToken = await createAuthToken(tutorUser.id, tutorUser.email, 'immersion');
    tutorApi = createE2ERequestHelpers(tutorToken);

    // Create student user
    studentUser = await createTestUser({
      email: 'student@example.com',
      subscriptionTier: 'learner',
    });
    studentToken = await createAuthToken(studentUser.id, studentUser.email, 'learner');
    studentApi = createE2ERequestHelpers(studentToken);
  });

  describe('Complete Classroom Lifecycle', () => {
    it('should create classroom, add students, and manage assignments', async () => {
      // Step 1: Tutor creates a classroom
      const classroomData = {
        name: 'Chinese 101',
        description: 'Introduction to Mandarin Chinese',
        maxStudents: 25,
      };

      const createResult = await tutorApi.post('/api/v1/classrooms', classroomData);
      expect(createResult.status).toBe(201);
      expect(createResult.json.data.name).toBe(classroomData.name);
      expect(createResult.json.data.joinCode).toBeDefined();

      const classroomId = createResult.json.data.id;
      const joinCode = createResult.json.data.joinCode;

      // Step 2: Student joins with code
      const joinResult = await studentApi.post('/api/v1/classrooms/join', {
        joinCode,
        displayName: 'John Doe',
      });
      expect([200, 201]).toContain(joinResult.status);

      // Step 3: Verify student appears in classroom roster
      const rosterResult = await tutorApi.get(`/api/v1/classrooms/${classroomId}/students`);
      expect(rosterResult.status).toBe(200);
      expect(rosterResult.json.data.length).toBe(1);
      expect(rosterResult.json.data[0].displayName).toBe('John Doe');

      // Step 4: Tutor creates an assignment
      const assignmentData = {
        title: 'Week 1: Basic Greetings',
        description: 'Learn essential greeting phrases',
        type: 'vocabulary',
        targetWords: ['你好', '谢谢', '再见', '对不起', '没关系'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const assignmentResult = await tutorApi.post(
        `/api/v1/classrooms/${classroomId}/assignments`,
        assignmentData
      );
      expect(assignmentResult.status).toBe(201);
      const assignmentId = assignmentResult.json.data.id;

      // Step 5: Student views their assignments
      const studentAssignments = await studentApi.get(`/api/v1/classrooms/${classroomId}/assignments`);
      expect(studentAssignments.status).toBe(200);
      expect(studentAssignments.json.data.length).toBe(1);
      expect(studentAssignments.json.data[0].title).toBe(assignmentData.title);

      // Step 6: Student makes progress (simulated by adding words to vocabulary)
      await studentApi.post('/api/v1/vocabulary', { word: '你好', pinyin: 'nǐhǎo', definition: 'hello' });
      await studentApi.post('/api/v1/vocabulary', { word: '谢谢', pinyin: 'xièxiè', definition: 'thank you' });

      // Step 7: Update assignment progress
      const progressResult = await studentApi.post(
        `/api/v1/classrooms/${classroomId}/assignments/${assignmentId}/progress`,
        { wordsCompleted: 2 }
      );
      expect([200, 201]).toContain(progressResult.status);

      // Step 8: Tutor views class progress
      const classProgress = await tutorApi.get(
        `/api/v1/classrooms/${classroomId}/assignments/${assignmentId}/progress`
      );
      expect(classProgress.status).toBe(200);
      expect(classProgress.json.data.length).toBe(1);
      expect(classProgress.json.data[0].wordsCompleted).toBe(2);

      // Step 9: Delete assignment
      const deleteAssignment = await tutorApi.delete(
        `/api/v1/classrooms/${classroomId}/assignments/${assignmentId}`
      );
      expect(deleteAssignment.status).toBe(200);

      // Step 10: Delete classroom
      const deleteClassroom = await tutorApi.delete(`/api/v1/classrooms/${classroomId}`);
      expect(deleteClassroom.status).toBe(200);
    });
  });

  describe('Classroom Access Control', () => {
    it('should prevent non-tutors from creating classrooms', async () => {
      // Student (learner tier) tries to create classroom
      const result = await studentApi.post('/api/v1/classrooms', {
        name: 'Unauthorized Classroom',
      });

      // Should be forbidden or require upgrade
      expect([401, 403]).toContain(result.status);
    });

    it('should prevent non-members from accessing classroom', async () => {
      // Tutor creates classroom
      const createResult = await tutorApi.post('/api/v1/classrooms', {
        name: 'Private Classroom',
      });
      const classroomId = createResult.json.data.id;

      // Create another user who is not a member
      const outsiderUser = await createTestUser({ email: 'outsider@example.com' });
      const outsiderToken = await createAuthToken(outsiderUser.id, outsiderUser.email);
      const outsiderApi = createE2ERequestHelpers(outsiderToken);

      // Outsider tries to access classroom
      const accessResult = await outsiderApi.get(`/api/v1/classrooms/${classroomId}`);
      expect([403, 404]).toContain(accessResult.status);
    });

    it('should allow tutor to remove students', async () => {
      // Create classroom and join
      const createResult = await tutorApi.post('/api/v1/classrooms', { name: 'Test Classroom' });
      const classroomId = createResult.json.data.id;
      const joinCode = createResult.json.data.joinCode;

      await studentApi.post('/api/v1/classrooms/join', { joinCode });

      // Tutor removes student
      const removeResult = await tutorApi.delete(
        `/api/v1/classrooms/${classroomId}/students/${studentUser.id}`
      );
      expect(removeResult.status).toBe(200);

      // Verify student is removed
      const rosterResult = await tutorApi.get(`/api/v1/classrooms/${classroomId}/students`);
      expect(rosterResult.json.data.length).toBe(0);
    });
  });

  describe('Classroom Leaderboard', () => {
    it('should show student rankings by progress', async () => {
      // Create classroom
      const createResult = await tutorApi.post('/api/v1/classrooms', { name: 'Leaderboard Test' });
      const classroomId = createResult.json.data.id;
      const joinCode = createResult.json.data.joinCode;

      // Create multiple students
      const student2 = await createTestUser({ email: 'student2@example.com' });
      const student2Token = await createAuthToken(student2.id, student2.email);
      const student2Api = createE2ERequestHelpers(student2Token);

      // Both students join
      await studentApi.post('/api/v1/classrooms/join', { joinCode, displayName: 'Student 1' });
      await student2Api.post('/api/v1/classrooms/join', { joinCode, displayName: 'Student 2' });

      // Get leaderboard
      const leaderboardResult = await tutorApi.get(`/api/v1/classrooms/${classroomId}/leaderboard`);
      expect(leaderboardResult.status).toBe(200);
      expect(leaderboardResult.json.data.length).toBe(2);
    });
  });

  describe('Assignment with Deck', () => {
    it('should create assignment linked to a shared deck', async () => {
      // Create a deck first
      const deckResult = await tutorApi.post('/api/v1/shared-decks', {
        name: 'Assignment Deck',
        isPublic: false,
      });
      const deckId = deckResult.json.data.id;

      // Add words to deck
      await tutorApi.post(`/api/v1/shared-decks/${deckId}/words`, {
        words: [
          { word: '作业', pinyin: 'zuòyè', definition: 'homework' },
          { word: '练习', pinyin: 'liànxí', definition: 'practice' },
        ],
      });

      // Create classroom
      const classroomResult = await tutorApi.post('/api/v1/classrooms', { name: 'Deck Assignment Test' });
      const classroomId = classroomResult.json.data.id;

      // Create assignment with deck
      const assignmentResult = await tutorApi.post(`/api/v1/classrooms/${classroomId}/assignments`, {
        title: 'Deck-based Assignment',
        type: 'deck',
        targetDeckId: deckId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      expect(assignmentResult.status).toBe(201);
      expect(assignmentResult.json.data.targetDeckId).toBe(deckId);
    });
  });
});
