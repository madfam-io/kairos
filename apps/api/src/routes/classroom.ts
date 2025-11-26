/**
 * Classroom Mode Routes
 * Tutor-managed classrooms with assignments and student progress tracking
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AppEnv } from '../types';
import { requireAuth, requireSubscription } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import {
  db,
  classrooms,
  classroomStudents,
  classroomAssignments,
  assignmentProgress,
  sharedDecks,
  sharedDeckWords,
  vocabulary,
  users,
} from '../db';

export const classroomRoutes = new Hono<AppEnv>();

// Require authentication for all routes
classroomRoutes.use('*', requireAuth());

// Schemas
const createClassroomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxStudents: z.number().int().min(1).max(100).default(30),
  settings: z
    .object({
      allowSelfEnroll: z.boolean().default(true),
      showLeaderboard: z.boolean().default(true),
      requireApproval: z.boolean().default(false),
    })
    .optional(),
});

const updateClassroomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  maxStudents: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  settings: z
    .object({
      allowSelfEnroll: z.boolean().optional(),
      showLeaderboard: z.boolean().optional(),
      requireApproval: z.boolean().optional(),
    })
    .optional(),
});

const createAssignmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['vocabulary', 'deck', 'content']),
  targetDeckId: z.string().uuid().optional(),
  targetWords: z
    .array(
      z.object({
        word: z.string(),
        pinyin: z.string().optional(),
        definition: z.string().optional(),
      })
    )
    .optional(),
  dueDate: z.string().datetime().optional(),
  settings: z
    .object({
      minWordsPerDay: z.number().int().min(1).max(100).optional(),
      requireMastery: z.boolean().optional(),
    })
    .optional(),
});

const updateProgressSchema = z.object({
  wordsCompleted: z.number().int().min(0).optional(),
  score: z.number().min(0).max(100).optional(),
});

// Helper function to generate join code
function generateJoinCode(): string {
  return nanoid(8).toUpperCase();
}

// Helper to check if user is a tutor (paid subscriber)
async function requireTutor(userId: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user || user.subscriptionTier === 'free') {
    throw new AppError('Classroom mode requires a paid subscription', 403);
  }
}

/**
 * GET /api/v1/classroom
 * Get all classrooms (as tutor or student)
 */
classroomRoutes.get('/', async (c) => {
  const user = c.get('user');

  // Get classrooms where user is tutor
  const asTeacher = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.tutorId, user.id))
    .orderBy(desc(classrooms.createdAt));

  // Get classrooms where user is student
  const asStudentEnrollments = await db
    .select({
      enrollment: classroomStudents,
      classroom: classrooms,
    })
    .from(classroomStudents)
    .innerJoin(classrooms, eq(classroomStudents.classroomId, classrooms.id))
    .where(and(eq(classroomStudents.studentId, user.id), eq(classroomStudents.isActive, true)));

  return c.json({
    success: true,
    data: {
      teaching: asTeacher,
      enrolled: asStudentEnrollments.map((e) => ({
        ...e.classroom,
        joinedAt: e.enrollment.joinedAt,
        displayName: e.enrollment.displayName,
      })),
    },
  });
});

/**
 * POST /api/v1/classroom
 * Create a new classroom (tutor only)
 */
classroomRoutes.post('/', zValidator('json', createClassroomSchema), async (c) => {
  const user = c.get('user');
  const { name, description, maxStudents, settings } = c.req.valid('json');

  await requireTutor(user.id);

  // Generate unique join code
  let joinCode: string;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    joinCode = generateJoinCode();
    const [existing] = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.joinCode, joinCode!))
      .limit(1);
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new AppError('Failed to generate join code, please try again', 500);
  }

  const [classroom] = await db
    .insert(classrooms)
    .values({
      tutorId: user.id,
      name,
      description,
      joinCode: joinCode!,
      maxStudents,
      settings: settings || {},
    })
    .returning();

  return c.json({
    success: true,
    data: classroom,
  });
});

/**
 * GET /api/v1/classroom/:id
 * Get classroom details
 */
classroomRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const classroomId = c.req.param('id');

  // Get classroom
  const [classroom] = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);

  if (!classroom) {
    throw new AppError('Classroom not found', 404);
  }

  // Check access (tutor or enrolled student)
  const isTutor = classroom.tutorId === user.id;
  let isStudent = false;

  if (!isTutor) {
    const [enrollment] = await db
      .select()
      .from(classroomStudents)
      .where(
        and(
          eq(classroomStudents.classroomId, classroomId),
          eq(classroomStudents.studentId, user.id),
          eq(classroomStudents.isActive, true)
        )
      )
      .limit(1);
    isStudent = !!enrollment;
  }

  if (!isTutor && !isStudent) {
    throw new AppError('Classroom not found', 404);
  }

  // Get students (for tutors) or just count (for students)
  let students = [];
  let studentCount = 0;

  if (isTutor) {
    const enrollments = await db
      .select({
        enrollment: classroomStudents,
        email: users.email,
      })
      .from(classroomStudents)
      .innerJoin(users, eq(classroomStudents.studentId, users.id))
      .where(
        and(eq(classroomStudents.classroomId, classroomId), eq(classroomStudents.isActive, true))
      );

    students = enrollments.map((e) => ({
      id: e.enrollment.studentId,
      displayName: e.enrollment.displayName || e.email.split('@')[0],
      joinedAt: e.enrollment.joinedAt,
    }));
    studentCount = students.length;
  } else {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classroomStudents)
      .where(
        and(eq(classroomStudents.classroomId, classroomId), eq(classroomStudents.isActive, true))
      );
    studentCount = count;
  }

  // Get assignments
  const assignments = await db
    .select()
    .from(classroomAssignments)
    .where(and(eq(classroomAssignments.classroomId, classroomId), eq(classroomAssignments.isActive, true)))
    .orderBy(desc(classroomAssignments.createdAt));

  return c.json({
    success: true,
    data: {
      ...classroom,
      joinCode: isTutor ? classroom.joinCode : undefined,
      isTutor,
      isStudent,
      studentCount,
      students: isTutor ? students : undefined,
      assignments,
    },
  });
});

/**
 * PATCH /api/v1/classroom/:id
 * Update classroom (tutor only)
 */
classroomRoutes.patch('/:id', zValidator('json', updateClassroomSchema), async (c) => {
  const user = c.get('user');
  const classroomId = c.req.param('id');
  const updates = c.req.valid('json');

  // Verify ownership
  const [classroom] = await db
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.tutorId, user.id)))
    .limit(1);

  if (!classroom) {
    throw new AppError('Classroom not found or unauthorized', 404);
  }

  const [updated] = await db
    .update(classrooms)
    .set({
      ...updates,
      settings: updates.settings ? { ...classroom.settings, ...updates.settings } : classroom.settings,
      updatedAt: new Date(),
    })
    .where(eq(classrooms.id, classroomId))
    .returning();

  return c.json({
    success: true,
    data: updated,
  });
});

/**
 * DELETE /api/v1/classroom/:id
 * Delete classroom (tutor only)
 */
classroomRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const classroomId = c.req.param('id');

  // Verify ownership
  const [classroom] = await db
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.tutorId, user.id)))
    .limit(1);

  if (!classroom) {
    throw new AppError('Classroom not found or unauthorized', 404);
  }

  await db.delete(classrooms).where(eq(classrooms.id, classroomId));

  return c.json({
    success: true,
    data: { deleted: true },
  });
});

/**
 * POST /api/v1/classroom/:id/regenerate-code
 * Regenerate join code (tutor only)
 */
classroomRoutes.post('/:id/regenerate-code', async (c) => {
  const user = c.get('user');
  const classroomId = c.req.param('id');

  // Verify ownership
  const [classroom] = await db
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.tutorId, user.id)))
    .limit(1);

  if (!classroom) {
    throw new AppError('Classroom not found or unauthorized', 404);
  }

  const newCode = generateJoinCode();

  const [updated] = await db
    .update(classrooms)
    .set({ joinCode: newCode, updatedAt: new Date() })
    .where(eq(classrooms.id, classroomId))
    .returning();

  return c.json({
    success: true,
    data: { joinCode: updated.joinCode },
  });
});

/**
 * POST /api/v1/classroom/join
 * Join a classroom by code
 */
classroomRoutes.post(
  '/join',
  zValidator('json', z.object({ code: z.string().min(1).max(20), displayName: z.string().max(50).optional() })),
  async (c) => {
    const user = c.get('user');
    const { code, displayName } = c.req.valid('json');

    // Find classroom
    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.joinCode, code.toUpperCase()), eq(classrooms.isActive, true)))
      .limit(1);

    if (!classroom) {
      throw new AppError('Invalid classroom code', 404);
    }

    // Check if already enrolled
    const [existing] = await db
      .select()
      .from(classroomStudents)
      .where(
        and(eq(classroomStudents.classroomId, classroom.id), eq(classroomStudents.studentId, user.id))
      )
      .limit(1);

    if (existing) {
      if (existing.isActive) {
        throw new AppError('Already enrolled in this classroom', 400);
      }
      // Re-activate
      await db
        .update(classroomStudents)
        .set({ isActive: true, displayName })
        .where(eq(classroomStudents.id, existing.id));

      return c.json({
        success: true,
        data: { joined: true, classroom: { id: classroom.id, name: classroom.name } },
      });
    }

    // Check max students
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classroomStudents)
      .where(
        and(eq(classroomStudents.classroomId, classroom.id), eq(classroomStudents.isActive, true))
      );

    if (count >= classroom.maxStudents) {
      throw new AppError('Classroom is full', 400);
    }

    // Can't join own classroom as student
    if (classroom.tutorId === user.id) {
      throw new AppError('You cannot join your own classroom as a student', 400);
    }

    // Enroll
    await db.insert(classroomStudents).values({
      classroomId: classroom.id,
      studentId: user.id,
      displayName,
    });

    return c.json({
      success: true,
      data: { joined: true, classroom: { id: classroom.id, name: classroom.name } },
    });
  }
);

/**
 * POST /api/v1/classroom/:id/leave
 * Leave a classroom (student only)
 */
classroomRoutes.post('/:id/leave', async (c) => {
  const user = c.get('user');
  const classroomId = c.req.param('id');

  await db
    .update(classroomStudents)
    .set({ isActive: false })
    .where(
      and(eq(classroomStudents.classroomId, classroomId), eq(classroomStudents.studentId, user.id))
    );

  return c.json({
    success: true,
    data: { left: true },
  });
});

/**
 * POST /api/v1/classroom/:id/remove-student
 * Remove a student (tutor only)
 */
classroomRoutes.post(
  '/:id/remove-student',
  zValidator('json', z.object({ studentId: z.string().uuid() })),
  async (c) => {
    const user = c.get('user');
    const classroomId = c.req.param('id');
    const { studentId } = c.req.valid('json');

    // Verify ownership
    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.tutorId, user.id)))
      .limit(1);

    if (!classroom) {
      throw new AppError('Classroom not found or unauthorized', 404);
    }

    await db
      .update(classroomStudents)
      .set({ isActive: false })
      .where(
        and(eq(classroomStudents.classroomId, classroomId), eq(classroomStudents.studentId, studentId))
      );

    return c.json({
      success: true,
      data: { removed: true },
    });
  }
);

// Assignment routes

/**
 * POST /api/v1/classroom/:id/assignments
 * Create an assignment (tutor only)
 */
classroomRoutes.post(
  '/:id/assignments',
  zValidator('json', createAssignmentSchema),
  async (c) => {
    const user = c.get('user');
    const classroomId = c.req.param('id');
    const { title, description, type, targetDeckId, targetWords, dueDate, settings } = c.req.valid('json');

    // Verify ownership
    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.tutorId, user.id)))
      .limit(1);

    if (!classroom) {
      throw new AppError('Classroom not found or unauthorized', 404);
    }

    // Verify deck exists if specified
    if (targetDeckId) {
      const [deck] = await db.select().from(sharedDecks).where(eq(sharedDecks.id, targetDeckId)).limit(1);
      if (!deck) {
        throw new AppError('Target deck not found', 404);
      }
    }

    const [assignment] = await db
      .insert(classroomAssignments)
      .values({
        classroomId,
        title,
        description,
        type,
        targetDeckId,
        targetWords: targetWords || [],
        dueDate: dueDate ? new Date(dueDate) : null,
        settings: settings || {},
      })
      .returning();

    return c.json({
      success: true,
      data: assignment,
    });
  }
);

/**
 * GET /api/v1/classroom/:id/assignments/:assignmentId
 * Get assignment details with progress
 */
classroomRoutes.get('/:id/assignments/:assignmentId', async (c) => {
  const user = c.get('user');
  const classroomId = c.req.param('id');
  const assignmentId = c.req.param('assignmentId');

  // Get classroom and verify access
  const [classroom] = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);

  if (!classroom) {
    throw new AppError('Classroom not found', 404);
  }

  const isTutor = classroom.tutorId === user.id;

  // Get assignment
  const [assignment] = await db
    .select()
    .from(classroomAssignments)
    .where(and(eq(classroomAssignments.id, assignmentId), eq(classroomAssignments.classroomId, classroomId)))
    .limit(1);

  if (!assignment) {
    throw new AppError('Assignment not found', 404);
  }

  // Get words if deck-based
  let words = [];
  if (assignment.targetDeckId) {
    words = await db
      .select()
      .from(sharedDeckWords)
      .where(eq(sharedDeckWords.deckId, assignment.targetDeckId));
  } else if (assignment.targetWords && Array.isArray(assignment.targetWords)) {
    words = assignment.targetWords;
  }

  // Get progress
  let progress;
  if (isTutor) {
    // Get all students' progress
    const allProgress = await db
      .select({
        progress: assignmentProgress,
        studentEmail: users.email,
      })
      .from(assignmentProgress)
      .innerJoin(users, eq(assignmentProgress.studentId, users.id))
      .where(eq(assignmentProgress.assignmentId, assignmentId));

    progress = allProgress.map((p) => ({
      studentId: p.progress.studentId,
      studentName: p.studentEmail.split('@')[0],
      wordsCompleted: p.progress.wordsCompleted,
      totalWords: p.progress.totalWords,
      completedAt: p.progress.completedAt,
      score: p.progress.score,
    }));
  } else {
    // Get own progress
    const [myProgress] = await db
      .select()
      .from(assignmentProgress)
      .where(and(eq(assignmentProgress.assignmentId, assignmentId), eq(assignmentProgress.studentId, user.id)))
      .limit(1);

    progress = myProgress || { wordsCompleted: 0, totalWords: words.length };
  }

  return c.json({
    success: true,
    data: {
      ...assignment,
      words,
      wordCount: words.length,
      progress,
      isTutor,
    },
  });
});

/**
 * PATCH /api/v1/classroom/:id/assignments/:assignmentId/progress
 * Update assignment progress (student)
 */
classroomRoutes.patch(
  '/:id/assignments/:assignmentId/progress',
  zValidator('json', updateProgressSchema),
  async (c) => {
    const user = c.get('user');
    const classroomId = c.req.param('id');
    const assignmentId = c.req.param('assignmentId');
    const { wordsCompleted, score } = c.req.valid('json');

    // Verify assignment exists
    const [assignment] = await db
      .select()
      .from(classroomAssignments)
      .where(and(eq(classroomAssignments.id, assignmentId), eq(classroomAssignments.classroomId, classroomId)))
      .limit(1);

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    // Get total words
    let totalWords = 0;
    if (assignment.targetDeckId) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sharedDeckWords)
        .where(eq(sharedDeckWords.deckId, assignment.targetDeckId));
      totalWords = count;
    } else if (assignment.targetWords && Array.isArray(assignment.targetWords)) {
      totalWords = assignment.targetWords.length;
    }

    // Upsert progress
    const [progress] = await db
      .insert(assignmentProgress)
      .values({
        assignmentId,
        studentId: user.id,
        wordsCompleted: wordsCompleted || 0,
        totalWords,
        score,
        completedAt: wordsCompleted && wordsCompleted >= totalWords ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [assignmentProgress.assignmentId, assignmentProgress.studentId],
        set: {
          wordsCompleted: wordsCompleted || sql`${assignmentProgress.wordsCompleted}`,
          score: score !== undefined ? score : sql`${assignmentProgress.score}`,
          completedAt:
            wordsCompleted && wordsCompleted >= totalWords
              ? new Date()
              : sql`${assignmentProgress.completedAt}`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return c.json({
      success: true,
      data: progress,
    });
  }
);

/**
 * DELETE /api/v1/classroom/:id/assignments/:assignmentId
 * Delete assignment (tutor only)
 */
classroomRoutes.delete('/:id/assignments/:assignmentId', async (c) => {
  const user = c.get('user');
  const classroomId = c.req.param('id');
  const assignmentId = c.req.param('assignmentId');

  // Verify ownership
  const [classroom] = await db
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.tutorId, user.id)))
    .limit(1);

  if (!classroom) {
    throw new AppError('Classroom not found or unauthorized', 404);
  }

  await db.delete(classroomAssignments).where(eq(classroomAssignments.id, assignmentId));

  return c.json({
    success: true,
    data: { deleted: true },
  });
});

/**
 * GET /api/v1/classroom/:id/leaderboard
 * Get classroom leaderboard
 */
classroomRoutes.get('/:id/leaderboard', async (c) => {
  const user = c.get('user');
  const classroomId = c.req.param('id');

  // Verify classroom exists and get settings
  const [classroom] = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);

  if (!classroom) {
    throw new AppError('Classroom not found', 404);
  }

  const settings = classroom.settings as { showLeaderboard?: boolean };
  if (!settings.showLeaderboard && classroom.tutorId !== user.id) {
    throw new AppError('Leaderboard is disabled for this classroom', 403);
  }

  // Get aggregated progress per student
  const leaderboard = await db
    .select({
      studentId: assignmentProgress.studentId,
      totalCompleted: sql<number>`sum(${assignmentProgress.wordsCompleted})::int`,
      avgScore: sql<number>`avg(${assignmentProgress.score})`,
      assignmentsCompleted: sql<number>`count(case when ${assignmentProgress.completedAt} is not null then 1 end)::int`,
    })
    .from(assignmentProgress)
    .innerJoin(classroomAssignments, eq(assignmentProgress.assignmentId, classroomAssignments.id))
    .where(eq(classroomAssignments.classroomId, classroomId))
    .groupBy(assignmentProgress.studentId)
    .orderBy(desc(sql`sum(${assignmentProgress.wordsCompleted})`))
    .limit(20);

  // Get student names
  const studentIds = leaderboard.map((l) => l.studentId);
  const studentMap = new Map<string, string>();

  if (studentIds.length > 0) {
    const enrollments = await db
      .select({
        studentId: classroomStudents.studentId,
        displayName: classroomStudents.displayName,
        email: users.email,
      })
      .from(classroomStudents)
      .innerJoin(users, eq(classroomStudents.studentId, users.id))
      .where(
        and(
          eq(classroomStudents.classroomId, classroomId),
          inArray(classroomStudents.studentId, studentIds)
        )
      );

    for (const e of enrollments) {
      studentMap.set(e.studentId, e.displayName || e.email.split('@')[0]);
    }
  }

  return c.json({
    success: true,
    data: leaderboard.map((l, index) => ({
      rank: index + 1,
      studentName: studentMap.get(l.studentId) || 'Unknown',
      wordsLearned: l.totalCompleted || 0,
      avgScore: l.avgScore ? Math.round(l.avgScore * 10) / 10 : null,
      assignmentsCompleted: l.assignmentsCompleted || 0,
    })),
  });
});
