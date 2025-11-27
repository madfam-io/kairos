/**
 * OpenAPI Specification for Kairos API
 *
 * This module defines the complete OpenAPI 3.0 specification for the Kairos API.
 */

export const openAPISpec = {
  openapi: '3.0.3',
  info: {
    title: 'Kairos API',
    description: `
# Kairos - The Intelligent Chinese Immersion Engine

Kairos is a comprehensive Chinese language learning platform that combines immersion-based learning with spaced repetition and AI-powered simplification.

## Authentication

Most endpoints require authentication via JWT Bearer token:

\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

Obtain tokens through the \`/api/v1/auth\` endpoints.

## Rate Limiting

API requests are rate-limited. Check response headers:
- \`X-RateLimit-Remaining\`: Requests remaining in window
- \`X-RateLimit-Reset\`: Unix timestamp when limit resets

## Response Format

All responses follow this structure:
\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "pagination": { ... }
  }
}
\`\`\`

Error responses:
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  },
  "meta": { "requestId": "uuid" }
}
\`\`\`
    `.trim(),
    version: '1.0.0',
    contact: {
      name: 'Kairos Team',
      email: 'api@kairos.dev',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication and authorization' },
    { name: 'User', description: 'User profile and settings' },
    { name: 'Vocabulary', description: 'Vocabulary management and SRS review' },
    { name: 'Cards', description: 'Flashcard mining and export' },
    { name: 'Shared Decks', description: 'Community vocabulary decks' },
    { name: 'Classroom', description: 'Tutor and classroom management' },
    { name: 'Analytics', description: 'Learning analytics and progress tracking' },
    { name: 'NLP', description: 'Natural language processing (simplification, grammar)' },
    { name: 'Speech', description: 'Speech recognition and synthesis' },
    { name: 'Pitch', description: 'Tone analysis and pitch tracking' },
    { name: 'Sync', description: 'Offline synchronization (CRDT)' },
    { name: 'Offline', description: 'Offline data packs' },
    { name: 'Content', description: 'Content analysis and recommendations' },
    { name: 'Billing', description: 'Subscription and payment management' },
    { name: 'Referrals', description: 'Referral program' },
    { name: 'Enterprise', description: 'Organization and enterprise features' },
    { name: 'Developer', description: 'API keys and OAuth applications' },
    { name: 'LTI', description: 'Learning Tools Interoperability (LMS integration)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication token',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for server-to-server integrations',
      },
    },
    schemas: {
      // Common schemas
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid input data' },
            },
          },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 50 },
          total: { type: 'integer', example: 150 },
          totalPages: { type: 'integer', example: 3 },
          hasMore: { type: 'boolean', example: true },
        },
      },
      // Vocabulary schemas
      Vocabulary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          word: { type: 'string', example: '学习' },
          pinyin: { type: 'string', example: 'xuéxí', nullable: true },
          definition: { type: 'string', example: 'to study, to learn', nullable: true },
          hskLevel: { type: 'integer', minimum: 1, maximum: 6, nullable: true },
          status: { type: 'string', enum: ['new', 'learning', 'known'] },
          easeFactor: { type: 'number', example: 2.5 },
          nextReview: { type: 'string', format: 'date-time', nullable: true },
          reviewCount: { type: 'integer', example: 5 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      VocabularyCreate: {
        type: 'object',
        required: ['word'],
        properties: {
          word: { type: 'string', minLength: 1, example: '学习' },
          pinyin: { type: 'string', example: 'xuéxí' },
          definition: { type: 'string', example: 'to study, to learn' },
          hskLevel: { type: 'integer', minimum: 1, maximum: 6 },
          status: { type: 'string', enum: ['new', 'learning', 'known'], default: 'new' },
        },
      },
      VocabularyUpdate: {
        type: 'object',
        properties: {
          pinyin: { type: 'string' },
          definition: { type: 'string' },
          status: { type: 'string', enum: ['new', 'learning', 'known'] },
          easeFactor: { type: 'number', minimum: 1.3, maximum: 2.5 },
          nextReview: { type: 'string', format: 'date-time' },
        },
      },
      VocabularyStats: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          new: { type: 'integer' },
          learning: { type: 'integer' },
          known: { type: 'integer' },
          dueForReview: { type: 'integer' },
          byHskLevel: {
            type: 'object',
            properties: {
              1: { type: 'integer' },
              2: { type: 'integer' },
              3: { type: 'integer' },
              4: { type: 'integer' },
              5: { type: 'integer' },
              6: { type: 'integer' },
            },
          },
        },
      },
      ReviewResult: {
        type: 'object',
        required: ['quality'],
        properties: {
          quality: {
            type: 'integer',
            minimum: 0,
            maximum: 5,
            description: 'SM-2 quality rating (0=complete blackout, 5=perfect)',
          },
        },
      },
      // Card schemas
      Card: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          word: { type: 'string', example: '电影' },
          sentence: { type: 'string', example: '我想看一部中国电影。', nullable: true },
          simplifiedSentence: { type: 'string', nullable: true },
          audioUrl: { type: 'string', format: 'uri', nullable: true },
          screenshotUrl: { type: 'string', format: 'uri', nullable: true },
          sourceTitle: { type: 'string', nullable: true },
          sourceTimestamp: { type: 'string', nullable: true },
          exportedToAnki: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CardCreate: {
        type: 'object',
        required: ['word'],
        properties: {
          word: { type: 'string', minLength: 1 },
          sentence: { type: 'string' },
          audioUrl: { type: 'string', format: 'uri' },
          screenshotUrl: { type: 'string', format: 'uri' },
          sourceTitle: { type: 'string' },
          sourceTimestamp: { type: 'string' },
        },
      },
      // Shared Deck schemas
      SharedDeck: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          authorId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'HSK 1 Vocabulary' },
          description: { type: 'string', nullable: true },
          isPublic: { type: 'boolean' },
          category: { type: 'string', enum: ['hsk', 'topic', 'media', 'custom'], nullable: true },
          tags: { type: 'array', items: { type: 'string' } },
          wordCount: { type: 'integer' },
          downloadCount: { type: 'integer' },
          likeCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      SharedDeckWord: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          deckId: { type: 'string', format: 'uuid' },
          word: { type: 'string' },
          pinyin: { type: 'string', nullable: true },
          definition: { type: 'string', nullable: true },
          hskLevel: { type: 'integer', nullable: true },
          exampleSentence: { type: 'string', nullable: true },
          order: { type: 'integer' },
        },
      },
      // Classroom schemas
      Classroom: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tutorId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Chinese 101' },
          description: { type: 'string', nullable: true },
          joinCode: { type: 'string', example: 'ABC123XY' },
          maxStudents: { type: 'integer', example: 30 },
          isActive: { type: 'boolean' },
          settings: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ClassroomAssignment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          classroomId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          type: { type: 'string', enum: ['vocabulary', 'deck', 'content'] },
          targetDeckId: { type: 'string', format: 'uuid', nullable: true },
          targetWords: { type: 'array', items: { type: 'string' } },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Organization schemas
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          type: { type: 'string', enum: ['university', 'school', 'company', 'language_school'] },
          logoUrl: { type: 'string', format: 'uri', nullable: true },
          domain: { type: 'string', nullable: true },
          licenseTier: { type: 'string', enum: ['standard', 'premium', 'unlimited'] },
          maxSeats: { type: 'integer' },
          usedSeats: { type: 'integer' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // User schemas
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          subscriptionTier: { type: 'string', enum: ['free', 'learner', 'immersion'] },
          subscriptionExpiresAt: { type: 'string', format: 'date-time', nullable: true },
          settings: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Analytics schemas
      DailyStats: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          wordsLearned: { type: 'integer' },
          wordsReviewed: { type: 'integer' },
          cardsMined: { type: 'integer' },
          studyTimeMinutes: { type: 'integer' },
          sessionsCount: { type: 'integer' },
        },
      },
      // Sync schemas
      SyncChange: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          operation: { type: 'string', enum: ['create', 'update', 'delete'] },
          collection: { type: 'string', enum: ['vocabulary', 'cards', 'settings'] },
          documentId: { type: 'string', format: 'uuid' },
          data: { type: 'object' },
          vectorClock: { type: 'object' },
          timestamp: { type: 'integer' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required or token invalid',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
            },
          },
        },
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      ValidationError: {
        description: 'Invalid request data',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // ==================== VOCABULARY ====================
    '/vocabulary': {
      get: {
        tags: ['Vocabulary'],
        summary: 'List vocabulary',
        description: 'Get paginated list of user vocabulary with filtering and sorting',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['new', 'learning', 'known'] } },
          { name: 'hskLevel', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 6 } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by word' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'nextReview', 'word'] } },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          200: {
            description: 'Vocabulary list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Vocabulary' } },
                    meta: {
                      type: 'object',
                      properties: { pagination: { $ref: '#/components/schemas/Pagination' } },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Vocabulary'],
        summary: 'Add vocabulary word',
        description: 'Add a new word to vocabulary',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VocabularyCreate' },
            },
          },
        },
        responses: {
          201: {
            description: 'Word created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Vocabulary' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/vocabulary/stats': {
      get: {
        tags: ['Vocabulary'],
        summary: 'Get vocabulary statistics',
        description: 'Get aggregated statistics about vocabulary',
        responses: {
          200: {
            description: 'Vocabulary statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/VocabularyStats' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/vocabulary/due': {
      get: {
        tags: ['Vocabulary'],
        summary: 'Get words due for review',
        description: 'Get vocabulary words due for SRS review',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Due words',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Vocabulary' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/vocabulary/batch': {
      post: {
        tags: ['Vocabulary'],
        summary: 'Batch create vocabulary',
        description: 'Add multiple words at once (up to 100)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['words'],
                properties: {
                  words: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/VocabularyCreate' },
                    maxItems: 100,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Batch result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        created: { type: 'integer' },
                        duplicates: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/vocabulary/{id}': {
      get: {
        tags: ['Vocabulary'],
        summary: 'Get vocabulary word',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Vocabulary word',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Vocabulary' },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Vocabulary'],
        summary: 'Update vocabulary word',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VocabularyUpdate' },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated word',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Vocabulary' },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Vocabulary'],
        summary: 'Delete vocabulary word',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object', properties: { deleted: { type: 'boolean' } } },
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/vocabulary/{id}/review': {
      post: {
        tags: ['Vocabulary'],
        summary: 'Submit review result',
        description: 'Submit SRS review result and update scheduling (SM-2 algorithm)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReviewResult' },
            },
          },
        },
        responses: {
          200: {
            description: 'Review processed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        newEaseFactor: { type: 'number' },
                        newInterval: { type: 'integer' },
                        nextReview: { type: 'string', format: 'date-time' },
                        reviewCount: { type: 'integer' },
                        status: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    // ==================== CARDS ====================
    '/cards': {
      get: {
        tags: ['Cards'],
        summary: 'List cards',
        description: 'Get paginated list of mined cards',
        parameters: [
          { name: 'exported', in: 'query', schema: { type: 'boolean' }, description: 'Filter by Anki export status' },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: 'Cards list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Card' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Cards'],
        summary: 'Mine a card',
        description: 'Create a new flashcard from content',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CardCreate' },
            },
          },
        },
        responses: {
          201: {
            description: 'Card created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Card' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/cards/export': {
      post: {
        tags: ['Cards'],
        summary: 'Export cards to Anki',
        description: 'Export cards in Anki format',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  cardIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                  format: { type: 'string', enum: ['anki', 'csv'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Export file' },
        },
      },
    },
    // ==================== SHARED DECKS ====================
    '/decks': {
      get: {
        tags: ['Shared Decks'],
        summary: 'List decks',
        parameters: [
          { name: 'public', in: 'query', schema: { type: 'boolean' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['popular', 'recent', 'name'] } },
        ],
        responses: {
          200: {
            description: 'Decks list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/SharedDeck' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Shared Decks'],
        summary: 'Create deck',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  isPublic: { type: 'boolean', default: false },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Deck created' },
        },
      },
    },
    '/decks/{id}/import': {
      post: {
        tags: ['Shared Decks'],
        summary: 'Import deck to vocabulary',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Import result' },
        },
      },
    },
    '/decks/{id}/like': {
      post: {
        tags: ['Shared Decks'],
        summary: 'Like a deck',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Liked' },
        },
      },
      delete: {
        tags: ['Shared Decks'],
        summary: 'Unlike a deck',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Unliked' },
        },
      },
    },
    // ==================== CLASSROOM ====================
    '/classroom': {
      get: {
        tags: ['Classroom'],
        summary: 'List classrooms',
        description: 'List classrooms (as tutor or student)',
        responses: {
          200: {
            description: 'Classrooms list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Classroom' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Classroom'],
        summary: 'Create classroom',
        description: 'Create a new classroom (tutor only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  maxStudents: { type: 'integer', default: 30 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Classroom created' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/classroom/join': {
      post: {
        tags: ['Classroom'],
        summary: 'Join classroom',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['joinCode'],
                properties: {
                  joinCode: { type: 'string' },
                  displayName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Joined' },
          404: { description: 'Invalid join code' },
        },
      },
    },
    '/classroom/{id}/assignments': {
      get: {
        tags: ['Classroom'],
        summary: 'List assignments',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Assignments list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/ClassroomAssignment' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Classroom'],
        summary: 'Create assignment',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'type'],
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  type: { type: 'string', enum: ['vocabulary', 'deck', 'content'] },
                  targetDeckId: { type: 'string', format: 'uuid' },
                  targetWords: { type: 'array', items: { type: 'string' } },
                  dueDate: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Assignment created' },
        },
      },
    },
    // ==================== ANALYTICS ====================
    '/analytics/summary': {
      get: {
        tags: ['Analytics'],
        summary: 'Get learning summary',
        responses: {
          200: { description: 'Summary stats' },
        },
      },
    },
    '/analytics/progress': {
      get: {
        tags: ['Analytics'],
        summary: 'Get progress data',
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'granularity', in: 'query', schema: { type: 'string', enum: ['day', 'week', 'month'] } },
        ],
        responses: {
          200: { description: 'Progress data' },
        },
      },
    },
    '/analytics/heatmap': {
      get: {
        tags: ['Analytics'],
        summary: 'Get activity heatmap',
        responses: {
          200: { description: 'Heatmap data' },
        },
      },
    },
    // ==================== NLP ====================
    '/nlp/simplify': {
      post: {
        tags: ['NLP'],
        summary: 'Simplify Chinese text',
        description: 'Simplify text to target HSK level',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text', 'targetLevel'],
                properties: {
                  text: { type: 'string' },
                  targetLevel: { type: 'integer', minimum: 1, maximum: 6 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Simplified text',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        original: { type: 'string' },
                        simplified: { type: 'string' },
                        targetLevel: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/nlp/grammar': {
      post: {
        tags: ['NLP'],
        summary: 'Analyze grammar patterns',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Grammar analysis' },
        },
      },
    },
    // ==================== SPEECH ====================
    '/speech/transcribe': {
      post: {
        tags: ['Speech'],
        summary: 'Transcribe audio',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['audio'],
                properties: {
                  audio: { type: 'string', format: 'binary' },
                  language: { type: 'string', default: 'zh' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Transcription result' },
        },
      },
    },
    '/speech/synthesize': {
      post: {
        tags: ['Speech'],
        summary: 'Synthesize speech',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string' },
                  speaker: { type: 'string' },
                  speed: { type: 'number', default: 1.0 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Audio file',
            content: {
              'audio/wav': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
    },
    // ==================== SYNC ====================
    '/sync/push': {
      post: {
        tags: ['Sync'],
        summary: 'Push offline changes',
        description: 'Push local changes to server (CRDT-based)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['changes', 'clientId'],
                properties: {
                  clientId: { type: 'string' },
                  changes: { type: 'array', items: { $ref: '#/components/schemas/SyncChange' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Sync result' },
        },
      },
    },
    '/sync/pull': {
      get: {
        tags: ['Sync'],
        summary: 'Pull server changes',
        parameters: [
          { name: 'since', in: 'query', schema: { type: 'integer' }, description: 'Timestamp to sync from' },
          { name: 'collection', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Server changes' },
        },
      },
    },
    // ==================== BILLING ====================
    '/billing/subscription': {
      get: {
        tags: ['Billing'],
        summary: 'Get subscription status',
        responses: {
          200: { description: 'Subscription details' },
        },
      },
    },
    '/billing/checkout': {
      post: {
        tags: ['Billing'],
        summary: 'Create checkout session',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tier', 'interval'],
                properties: {
                  tier: { type: 'string', enum: ['learner', 'immersion'] },
                  interval: { type: 'string', enum: ['monthly', 'yearly'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Checkout URL' },
        },
      },
    },
    // ==================== DEVELOPER ====================
    '/developer/apps': {
      get: {
        tags: ['Developer'],
        summary: 'List OAuth applications',
        responses: {
          200: { description: 'Applications list' },
        },
      },
      post: {
        tags: ['Developer'],
        summary: 'Create OAuth application',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'redirectUris'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  websiteUrl: { type: 'string', format: 'uri' },
                  redirectUris: { type: 'array', items: { type: 'string', format: 'uri' } },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Application created' },
        },
      },
    },
    '/developer/keys': {
      get: {
        tags: ['Developer'],
        summary: 'List API keys',
        responses: {
          200: { description: 'API keys list' },
        },
      },
      post: {
        tags: ['Developer'],
        summary: 'Create API key',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  scopes: { type: 'array', items: { type: 'string' } },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'API key created (shown only once)' },
        },
      },
    },
  },
} as const;

/**
 * Get OpenAPI spec as JSON
 */
export function getOpenAPISpec() {
  return openAPISpec;
}
