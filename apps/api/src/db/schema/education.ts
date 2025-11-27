/**
 * Education Schema - Classrooms, Students, Assignments, Progress
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './core';
import { sharedDecks } from './community';

/**
 * Classrooms - for tutors to manage student groups
 */
export const classrooms = pgTable(
  'classrooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tutorId: uuid('tutor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    joinCode: text('join_code').notNull().unique(),
    maxStudents: integer('max_students').default(30).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    settings: jsonb('settings').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tutorIdx: index('classrooms_tutor_idx').on(table.tutorId),
    joinCodeIdx: uniqueIndex('classrooms_join_code_idx').on(table.joinCode),
  })
);

/**
 * Classroom students - students enrolled in a classroom
 */
export const classroomStudents = pgTable(
  'classroom_students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classroomId: uuid('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => ({
    classroomStudentUnique: uniqueIndex('classroom_student_unique_idx').on(
      table.classroomId,
      table.studentId
    ),
    classroomIdx: index('classroom_students_classroom_idx').on(table.classroomId),
    studentIdx: index('classroom_students_student_idx').on(table.studentId),
  })
);

/**
 * Classroom assignments - vocabulary or content assignments
 */
export const classroomAssignments = pgTable(
  'classroom_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classroomId: uuid('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type').notNull(), // 'vocabulary', 'deck', 'content'
    targetDeckId: uuid('target_deck_id').references(() => sharedDecks.id),
    targetWords: jsonb('target_words').default([]), // For custom word lists
    dueDate: timestamp('due_date', { withTimezone: true }),
    settings: jsonb('settings').default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    classroomIdx: index('assignments_classroom_idx').on(table.classroomId),
    dueDateIdx: index('assignments_due_date_idx').on(table.dueDate),
  })
);

/**
 * Assignment progress - track student progress on assignments
 */
export const assignmentProgress = pgTable(
  'assignment_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => classroomAssignments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    wordsCompleted: integer('words_completed').default(0).notNull(),
    totalWords: integer('total_words').default(0).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    score: real('score'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assignmentStudentUnique: uniqueIndex('assignment_student_unique_idx').on(
      table.assignmentId,
      table.studentId
    ),
    assignmentIdx: index('progress_assignment_idx').on(table.assignmentId),
    studentIdx: index('progress_student_idx').on(table.studentId),
  })
);

// Relations
export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  tutor: one(users, {
    fields: [classrooms.tutorId],
    references: [users.id],
  }),
  students: many(classroomStudents),
  assignments: many(classroomAssignments),
}));

export const classroomStudentsRelations = relations(classroomStudents, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomStudents.classroomId],
    references: [classrooms.id],
  }),
  student: one(users, {
    fields: [classroomStudents.studentId],
    references: [users.id],
  }),
}));

export const classroomAssignmentsRelations = relations(classroomAssignments, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [classroomAssignments.classroomId],
    references: [classrooms.id],
  }),
  targetDeck: one(sharedDecks, {
    fields: [classroomAssignments.targetDeckId],
    references: [sharedDecks.id],
  }),
  progress: many(assignmentProgress),
}));

export const assignmentProgressRelations = relations(assignmentProgress, ({ one }) => ({
  assignment: one(classroomAssignments, {
    fields: [assignmentProgress.assignmentId],
    references: [classroomAssignments.id],
  }),
  student: one(users, {
    fields: [assignmentProgress.studentId],
    references: [users.id],
  }),
}));
