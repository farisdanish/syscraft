import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  computeMasterySummary, 
  DrillMasterySummarySchema 
} from '../dist-test/services/masterySummary.js';

test('Mastery Summary Compilation & Schema Invariants', async (t) => {
  await t.test('Week 1: Unassisted Tier 2 simulation mastery compiles correctly', () => {
    const summary = computeMasterySummary({
      drillId: 'w1-laravel-internals-n1',
      week: 1,
      title: 'Laravel Request Lifecycle & Eloquent N+1 Elimination',
      module: 'Laravel Internals',
      tier: 2,
      verificationSource: 'simulation',
      completedAt: '2026-10-16T10:00:00.000Z',
      testResults: {
        passed: true,
        summary: '3/3 assertions passed',
        assertions: [
          { id: 'a1', name: 'N+1 Query Elimination', passed: true },
          { id: 'a2', name: 'Eager Loading Relation', passed: true },
          { id: 'a3', name: 'Lifecycle Tracer Replay', passed: true }
        ],
        queryCount: 2,
      },
      oralScore: {
        drillId: 'w1-laravel-internals-n1',
        timestamp: '2026-10-16T10:05:00.000Z',
        dimensionScores: {
          correctness: 4,
          tradeoff: 4,
          failure: 3,
          clarity: 4,
          challenge: 3,
        },
        durationSeconds: 120,
        unscriptedPass: true,
        notes: 'Articulated terminating middleware cleanly.',
      },
      hintsUsed: 0,
      solutionRevealed: false,
    });

    // Validate with Zod schema
    const validated = DrillMasterySummarySchema.parse(summary);
    assert.equal(validated.drillId, 'w1-laravel-internals-n1');
    assert.equal(validated.week, 1);
    assert.equal(validated.tier, 2);
    assert.equal(validated.passed, true);
    assert.equal(validated.hintsUsed, 0);
    assert.equal(validated.solutionRevealed, false);
    assert.match(validated.pedagogicalFraming, /Unassisted/i);
    assert.equal(validated.nextWeekNumber, 2);
    assert.equal(validated.nextWeekId, 'w2-rest-cursor-pagination');
    assert.equal(validated.isCurriculumCompleted, false);
    assert.equal(validated.oralScore?.totalPoints, 15);
    assert.equal(validated.oralScore?.maxPoints, 16);
    assert.equal(validated.oralScore?.percentage, 93.75);
    assert.ok(validated.keyInvariants.length >= 2);
  });

  await t.test('Week 4: Scaffolding utilized with hints compiles non-punitive framing', () => {
    const summary = computeMasterySummary({
      drillId: 'w4-btree-indexing',
      week: 4,
      title: 'B-Tree Compound Indexing & EXPLAIN QUERY PLAN Lab',
      module: 'Database Performance',
      tier: 1,
      verificationSource: 'simulation',
      completedAt: '2026-10-16T11:00:00.000Z',
      testResults: {
        passed: true,
        assertions: [
          { id: 'q1', name: 'Compound Index Created', passed: true },
          { id: 'q2', name: 'SEARCH TABLE USING INDEX', passed: true }
        ],
        benchmark: {
          latencyMs: 1.2,
          reductionPercentage: 94.5,
        }
      },
      hintsUsed: 2,
      solutionRevealed: false,
    });

    const validated = DrillMasterySummarySchema.parse(summary);
    assert.equal(validated.hintsUsed, 2);
    assert.equal(validated.solutionRevealed, false);
    assert.match(validated.pedagogicalFraming, /Scaffolding utilized/i);
    assert.equal(validated.nextWeekNumber, 5);
    assert.equal(validated.nextWeekId, 'w5-queue-dlq-pipeline');
    assert.equal(validated.isCurriculumCompleted, false);
  });

  await t.test('Week 7: Final week completion sets isCurriculumCompleted true and nextWeek null', () => {
    const summary = computeMasterySummary({
      drillId: 'w7-crud-auth-sprint',
      week: 7,
      title: 'Timed CRUD, Session Fixation Defense & Policy Authorization',
      module: 'Security & Auth',
      tier: 3,
      verificationSource: 'local-runtime',
      completedAt: '2026-10-16T12:00:00.000Z',
      testResults: {
        passed: true,
        assertions: [
          { id: 'sec1', name: 'Session Regeneration on Auth', passed: true },
          { id: 'sec2', name: 'Policy Ownership Gate', passed: true }
        ],
      },
      hintsUsed: 1,
      solutionRevealed: true,
    });

    const validated = DrillMasterySummarySchema.parse(summary);
    assert.equal(validated.week, 7);
    assert.equal(validated.tier, 3);
    assert.equal(validated.verificationSource, 'local-runtime');
    assert.equal(validated.solutionRevealed, true);
    assert.match(validated.pedagogicalFraming, /Reference solution inspected/i);
    assert.equal(validated.nextWeekNumber, null);
    assert.equal(validated.nextWeekId, null);
    assert.equal(validated.isCurriculumCompleted, true);
  });
});
