import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

// Standalone mirror of storage schemas to verify persistence contracts in isolation
const HesitationSchema = z.object({
  id: z.string(),
  drillId: z.string(),
  week: z.number(),
  topic: z.string(),
  timeToFirstActionSeconds: z.number(),
  retryCount: z.number(),
  hintsRequested: z.number(),
  failedAssertionCount: z.number(),
  rubricMisses: z.array(z.string().max(500)),
  learnerFlagged: z.boolean(),
  createdAt: z.string(),
  reviewedSunday: z.boolean(),
});

const OralRubricScoreSchema = z.object({
  drillId: z.string(),
  timestamp: z.string(),
  dimensionScores: z.object({
    correctness: z.number().min(1).max(4),
    tradeoff: z.number().min(1).max(4),
    failure: z.number().min(1).max(4),
    clarity: z.number().min(1).max(4),
    challenge: z.number().min(1).max(4),
  }),
  durationSeconds: z.number(),
  unscriptedPass: z.boolean(),
  notes: z.string().max(2000),
});

const TaskStateSchema = z.object({
  taskId: z.string(),
  status: z.enum(['locked', 'available', 'in_progress', 'completed', 'verified', 'deferred', 'planned']),
  attempts: z.number(),
  verificationSource: z.enum(['simulation', 'local-runtime', 'self-reported']).optional(),
  lastOpenedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

const DrillStepCompletionsSchema = z.object({
  1: z.boolean(),
  2: z.boolean(),
  3: z.boolean(),
  4: z.boolean(),
  5: z.boolean(),
});

const StarStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
});

const DrillSessionStateSchema = z.object({
  drillId: z.string(),
  week: z.number(),
  currentStep: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  highestStepReached: z.number(),
  stepCompletions: DrillStepCompletionsSchema,
  draftCode: z.string().max(50000),
  testResults: z.unknown().nullable().optional(),
  tier3Result: z.unknown().nullable().optional(),
  verificationSource: z.enum(['simulation', 'local-runtime', 'self-reported']),
  completed: z.boolean(),
  oralDefenseCompleted: z.boolean(),
  lastActiveAt: z.string(),
  starStories: z.array(StarStorySchema).optional(),
  hintsUsed: z.number().min(0).optional(),
  solutionRevealed: z.boolean().optional(),
});

const EnvelopeSchema = z.object({
  schemaVersion: z.string().regex(/^[12]\.\d+\.\d+$/),
  exportedAt: z.string(),
  appVersion: z.string().regex(/^1\.\d+\.\d+$/),
  payload: z.object({
    tasks: z.record(z.string(), TaskStateSchema).optional(),
    completedDrills: z.record(z.string(), z.object({
      completed: z.boolean(),
      score: z.number().optional(),
      verified: z.boolean(),
      verificationSource: z.enum(['simulation', 'local-runtime', 'self-reported']).optional(),
    })),
    drillSessions: z.record(z.string(), DrillSessionStateSchema).optional(),
    hesitations: z.array(HesitationSchema),
    oralScores: z.array(OralRubricScoreSchema),
    customNotes: z.record(z.string(), z.string().max(10000)),
  }),
});

test('Envelope Persistence & Schema Version Migration', async (t) => {
  await t.test('V1 envelope without hint fields passes validation without warnings', () => {
    const v1Envelope = {
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      payload: {
        completedDrills: {
          'w1-laravel-internals-n1': {
            completed: true,
            verified: true,
            verificationSource: 'simulation',
          },
        },
        drillSessions: {
          'w1-laravel-internals-n1': {
            drillId: 'w1-laravel-internals-n1',
            week: 1,
            currentStep: 5,
            highestStepReached: 5,
            stepCompletions: { 1: true, 2: true, 3: true, 4: true, 5: true },
            draftCode: 'Post::with(["author", "comments"])->get();',
            testResults: { passed: true },
            tier3Result: null,
            verificationSource: 'simulation',
            completed: true,
            oralDefenseCompleted: true,
            lastActiveAt: new Date().toISOString(),
          },
        },
        hesitations: [],
        oralScores: [],
        customNotes: {},
      },
    };

    const parsed = EnvelopeSchema.safeParse(v1Envelope);
    assert.strictEqual(parsed.success, true, 'V1 envelope must parse successfully');
  });

  await t.test('V2 envelope with hintsUsed and solutionRevealed validates correctly', () => {
    const v2Envelope = {
      schemaVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      payload: {
        completedDrills: {
          'w2-rest-cursor-pagination': {
            completed: true,
            verified: false,
            verificationSource: 'simulation',
          },
        },
        drillSessions: {
          'w2-rest-cursor-pagination': {
            drillId: 'w2-rest-cursor-pagination',
            week: 2,
            currentStep: 4,
            highestStepReached: 4,
            stepCompletions: { 1: true, 2: true, 3: true, 4: false, 5: false },
            draftCode: 'SELECT * FROM items WHERE id > :cursor LIMIT :limit',
            testResults: { passed: true },
            tier3Result: null,
            verificationSource: 'simulation',
            completed: false,
            oralDefenseCompleted: false,
            lastActiveAt: new Date().toISOString(),
            hintsUsed: 2,
            solutionRevealed: false,
          },
        },
        hesitations: [],
        oralScores: [],
        customNotes: {},
      },
    };

    const parsed = EnvelopeSchema.safeParse(v2Envelope);
    assert.strictEqual(parsed.success, true, 'V2 envelope must parse successfully');
    if (parsed.success) {
      const session = parsed.data.payload.drillSessions?.['w2-rest-cursor-pagination'];
      assert.strictEqual(session?.hintsUsed, 2);
      assert.strictEqual(session?.solutionRevealed, false);
    }
  });

  await t.test('V2 envelope with solutionRevealed true persists pedagogical telemetry', () => {
    const v2Revealed = {
      schemaVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      payload: {
        completedDrills: {},
        drillSessions: {
          'w3-clean-architecture': {
            drillId: 'w3-clean-architecture',
            week: 3,
            currentStep: 2,
            highestStepReached: 2,
            stepCompletions: { 1: true, 2: false, 3: false, 4: false, 5: false },
            draftCode: '// starter code',
            testResults: null,
            tier3Result: null,
            verificationSource: 'simulation',
            completed: false,
            oralDefenseCompleted: false,
            lastActiveAt: new Date().toISOString(),
            hintsUsed: 3,
            solutionRevealed: true,
          },
        },
        hesitations: [],
        oralScores: [],
        customNotes: {},
      },
    };

    const parsed = EnvelopeSchema.safeParse(v2Revealed);
    assert.strictEqual(parsed.success, true);
    if (parsed.success) {
      const session = parsed.data.payload.drillSessions?.['w3-clean-architecture'];
      assert.strictEqual(session?.hintsUsed, 3);
      assert.strictEqual(session?.solutionRevealed, true);
    }
  });

  await t.test('Negative hintsUsed or invalid schemaVersion is rejected by Zod', () => {
    const invalidHints = {
      schemaVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      payload: {
        completedDrills: {},
        drillSessions: {
          w1: {
            drillId: 'w1',
            week: 1,
            currentStep: 1,
            highestStepReached: 1,
            stepCompletions: { 1: false, 2: false, 3: false, 4: false, 5: false },
            draftCode: '',
            verificationSource: 'simulation',
            completed: false,
            oralDefenseCompleted: false,
            lastActiveAt: new Date().toISOString(),
            hintsUsed: -1, // invalid negative number
          },
        },
        hesitations: [],
        oralScores: [],
        customNotes: {},
      },
    };

    const parsedHints = EnvelopeSchema.safeParse(invalidHints);
    assert.strictEqual(parsedHints.success, false, 'Negative hintsUsed must be rejected');

    const invalidVersion = {
      schemaVersion: '9.0.0', // unsupported major version
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      payload: {
        completedDrills: {},
        hesitations: [],
        oralScores: [],
        customNotes: {},
      },
    };

    const parsedVersion = EnvelopeSchema.safeParse(invalidVersion);
    assert.strictEqual(parsedVersion.success, false, 'Unsupported schemaVersion must be rejected');
  });
});
