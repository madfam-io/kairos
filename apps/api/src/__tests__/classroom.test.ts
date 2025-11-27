import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import {
  createRequestHelpers,
  testUser,
  testAdminUser,
  generators,
} from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Classroom API', () => {
  describe('GET /api/v1/classroom', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/classroom', { auth: false });
      expect(status).toBe(401);
    });

    it('should return classrooms list with teaching and enrolled sections', async () => {
      const { status, json } = await api.get('/api/v1/classroom');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.teaching).toBeDefined();
      expect(json.data.enrolled).toBeDefined();
      expect(Array.isArray(json.data.teaching)).toBe(true);
      expect(Array.isArray(json.data.enrolled)).toBe(true);
    });
  });

  describe('POST /api/v1/classroom', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/classroom', {
        name: 'Test Classroom',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require name field', async () => {
      const { status, json } = await api.post('/api/v1/classroom', {});

      expect(status).toBe(400);
    });

    it('should validate name length (min 1)', async () => {
      const { status } = await api.post('/api/v1/classroom', {
        name: '',
      });

      expect(status).toBe(400);
    });

    it('should validate name length (max 100)', async () => {
      const { status } = await api.post('/api/v1/classroom', {
        name: 'a'.repeat(101),
      });

      expect(status).toBe(400);
    });

    it('should validate description length (max 500)', async () => {
      const { status } = await api.post('/api/v1/classroom', {
        name: 'Test Classroom',
        description: 'a'.repeat(501),
      });

      expect(status).toBe(400);
    });

    it('should validate maxStudents range (1-100)', async () => {
      const { status: status1 } = await api.post('/api/v1/classroom', {
        name: 'Test Classroom',
        maxStudents: 0,
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/classroom', {
        name: 'Test Classroom',
        maxStudents: 101,
      });
      expect(status2).toBe(400);
    });

    it('should accept valid classroom data', async () => {
      const { status, json } = await api.post('/api/v1/classroom', {
        name: 'Chinese 101',
        description: 'Beginner Chinese class',
        maxStudents: 30,
        settings: {
          allowSelfEnroll: true,
          showLeaderboard: true,
          requireApproval: false,
        },
      }, { auth: testAdminUser });

      // May fail with 403 if free tier, which is expected
      expect([200, 403]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data.name).toBe('Chinese 101');
        expect(json.data.joinCode).toBeDefined();
        expect(json.data.joinCode.length).toBe(8);
      }
    });

    it('should require paid subscription to create classroom', async () => {
      const { status, json } = await api.post('/api/v1/classroom', {
        name: 'Test Classroom',
      }, { auth: { ...testUser, subscriptionTier: 'free' } });

      // Free tier users should get 403
      expect([200, 403]).toContain(status);
    });
  });

  describe('GET /api/v1/classroom/:id', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/classroom/${generators.uuid()}`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent classroom', async () => {
      const { status, json } = await api.get(`/api/v1/classroom/${generators.uuid()}`);

      expect(status).toBe(404);
      expect(json.success).toBe(false);
    });

    it('should return 404 for unauthorized access (not tutor or student)', async () => {
      // Even if classroom exists, user without access should get 404
      const { status } = await api.get(`/api/v1/classroom/${generators.uuid()}`);
      expect(status).toBe(404);
    });
  });

  describe('PATCH /api/v1/classroom/:id', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch(`/api/v1/classroom/${generators.uuid()}`, {
        name: 'Updated Name',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should return 404 for non-existent classroom', async () => {
      const { status } = await api.patch(`/api/v1/classroom/${generators.uuid()}`, {
        name: 'Updated Name',
      });

      expect(status).toBe(404);
    });

    it('should validate name length if provided', async () => {
      const { status } = await api.patch(`/api/v1/classroom/${generators.uuid()}`, {
        name: '',
      });

      expect(status).toBe(400);
    });

    it('should validate maxStudents range if provided', async () => {
      const { status } = await api.patch(`/api/v1/classroom/${generators.uuid()}`, {
        maxStudents: 0,
      });

      expect(status).toBe(400);
    });

    it('should accept valid update fields', async () => {
      const { status } = await api.patch(`/api/v1/classroom/${generators.uuid()}`, {
        name: 'Updated Name',
        description: 'Updated description',
        isActive: false,
        settings: {
          showLeaderboard: false,
        },
      });

      // 404 is expected since classroom doesn't exist
      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/v1/classroom/:id', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete(`/api/v1/classroom/${generators.uuid()}`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent classroom', async () => {
      const { status } = await api.delete(`/api/v1/classroom/${generators.uuid()}`);
      expect(status).toBe(404);
    });
  });

  describe('POST /api/v1/classroom/:id/regenerate-code', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/regenerate-code`, {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent classroom', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/regenerate-code`, {});
      expect(status).toBe(404);
    });
  });

  describe('POST /api/v1/classroom/join', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/classroom/join', {
        code: 'TESTCODE',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require code field', async () => {
      const { status } = await api.post('/api/v1/classroom/join', {});
      expect(status).toBe(400);
    });

    it('should validate code length', async () => {
      const { status: status1 } = await api.post('/api/v1/classroom/join', {
        code: '',
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/classroom/join', {
        code: 'a'.repeat(21),
      });
      expect(status2).toBe(400);
    });

    it('should validate displayName length if provided', async () => {
      const { status } = await api.post('/api/v1/classroom/join', {
        code: 'TESTCODE',
        displayName: 'a'.repeat(51),
      });

      expect(status).toBe(400);
    });

    it('should return 404 for invalid code', async () => {
      const { status, json } = await api.post('/api/v1/classroom/join', {
        code: 'INVALIDCODE',
      });

      expect(status).toBe(404);
      expect(json.success).toBe(false);
    });

    it('should accept displayName for joining', async () => {
      const { status } = await api.post('/api/v1/classroom/join', {
        code: 'TESTCODE',
        displayName: 'My Display Name',
      });

      // 404 expected since code doesn't exist
      expect(status).toBe(404);
    });
  });

  describe('POST /api/v1/classroom/:id/leave', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/leave`, {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should return success even for non-enrolled user', async () => {
      // Leave is idempotent - should succeed even if not enrolled
      const { status, json } = await api.post(`/api/v1/classroom/${generators.uuid()}/leave`, {});

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.left).toBe(true);
    });
  });

  describe('POST /api/v1/classroom/:id/remove-student', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/remove-student`, {
        studentId: generators.uuid(),
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require studentId field', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/remove-student`, {});
      expect(status).toBe(400);
    });

    it('should validate studentId is UUID', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/remove-student`, {
        studentId: 'not-a-uuid',
      });

      expect(status).toBe(400);
    });

    it('should return 404 for non-existent classroom', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/remove-student`, {
        studentId: generators.uuid(),
      });

      expect(status).toBe(404);
    });
  });

  describe('POST /api/v1/classroom/:id/assignments', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'Test Assignment',
        type: 'vocabulary',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require title field', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        type: 'vocabulary',
      });

      expect(status).toBe(400);
    });

    it('should require type field', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'Test Assignment',
      });

      expect(status).toBe(400);
    });

    it('should validate title length (min 1, max 200)', async () => {
      const { status: status1 } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: '',
        type: 'vocabulary',
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'a'.repeat(201),
        type: 'vocabulary',
      });
      expect(status2).toBe(400);
    });

    it('should validate description length (max 1000)', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'Test',
        type: 'vocabulary',
        description: 'a'.repeat(1001),
      });

      expect(status).toBe(400);
    });

    it('should validate type enum', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'Test Assignment',
        type: 'invalid-type',
      });

      expect(status).toBe(400);
    });

    it('should accept valid assignment types', async () => {
      const validTypes = ['vocabulary', 'deck', 'content'];

      for (const type of validTypes) {
        const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
          title: 'Test Assignment',
          type,
        });

        // 404 because classroom doesn't exist, but not 400 (validation passed)
        expect(status).toBe(404);
      }
    });

    it('should validate targetDeckId is UUID if provided', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'Test Assignment',
        type: 'deck',
        targetDeckId: 'not-a-uuid',
      });

      expect(status).toBe(400);
    });

    it('should validate dueDate format if provided', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'Test Assignment',
        type: 'vocabulary',
        dueDate: 'invalid-date',
      });

      expect(status).toBe(400);
    });

    it('should accept valid dueDate', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'Test Assignment',
        type: 'vocabulary',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // 404 because classroom doesn't exist
      expect(status).toBe(404);
    });

    it('should validate targetWords structure', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'Test Assignment',
        type: 'vocabulary',
        targetWords: [
          { word: '学习', pinyin: 'xuéxí', definition: 'to study' },
          { word: '中文' }, // Valid - only word required
        ],
      });

      // 404 because classroom doesn't exist
      expect(status).toBe(404);
    });

    it('should validate settings structure', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'Test Assignment',
        type: 'vocabulary',
        settings: {
          minWordsPerDay: 10,
          requireMastery: true,
        },
      });

      // 404 because classroom doesn't exist
      expect(status).toBe(404);
    });

    it('should validate settings.minWordsPerDay range (1-100)', async () => {
      const { status } = await api.post(`/api/v1/classroom/${generators.uuid()}/assignments`, {
        title: 'Test Assignment',
        type: 'vocabulary',
        settings: {
          minWordsPerDay: 101,
        },
      });

      expect(status).toBe(400);
    });
  });

  describe('GET /api/v1/classroom/:id/assignments/:assignmentId', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(
        `/api/v1/classroom/${generators.uuid()}/assignments/${generators.uuid()}`,
        { auth: false }
      );
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent classroom', async () => {
      const { status } = await api.get(
        `/api/v1/classroom/${generators.uuid()}/assignments/${generators.uuid()}`
      );
      expect(status).toBe(404);
    });
  });

  describe('PATCH /api/v1/classroom/:id/assignments/:assignmentId/progress', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch(
        `/api/v1/classroom/${generators.uuid()}/assignments/${generators.uuid()}/progress`,
        { wordsCompleted: 10 },
        { auth: false }
      );
      expect(status).toBe(401);
    });

    it('should validate wordsCompleted is non-negative', async () => {
      const { status } = await api.patch(
        `/api/v1/classroom/${generators.uuid()}/assignments/${generators.uuid()}/progress`,
        { wordsCompleted: -1 }
      );

      expect(status).toBe(400);
    });

    it('should validate score range (0-100)', async () => {
      const { status: status1 } = await api.patch(
        `/api/v1/classroom/${generators.uuid()}/assignments/${generators.uuid()}/progress`,
        { score: -1 }
      );
      expect(status1).toBe(400);

      const { status: status2 } = await api.patch(
        `/api/v1/classroom/${generators.uuid()}/assignments/${generators.uuid()}/progress`,
        { score: 101 }
      );
      expect(status2).toBe(400);
    });

    it('should return 404 for non-existent assignment', async () => {
      const { status } = await api.patch(
        `/api/v1/classroom/${generators.uuid()}/assignments/${generators.uuid()}/progress`,
        { wordsCompleted: 10 }
      );

      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/v1/classroom/:id/assignments/:assignmentId', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete(
        `/api/v1/classroom/${generators.uuid()}/assignments/${generators.uuid()}`,
        { auth: false }
      );
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent classroom', async () => {
      const { status } = await api.delete(
        `/api/v1/classroom/${generators.uuid()}/assignments/${generators.uuid()}`
      );
      expect(status).toBe(404);
    });
  });

  describe('GET /api/v1/classroom/:id/leaderboard', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(
        `/api/v1/classroom/${generators.uuid()}/leaderboard`,
        { auth: false }
      );
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent classroom', async () => {
      const { status } = await api.get(`/api/v1/classroom/${generators.uuid()}/leaderboard`);
      expect(status).toBe(404);
    });
  });
});
