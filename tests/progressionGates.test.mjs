import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isConceptGateSatisfied,
  isOralAssessmentComplete,
  computeOralScore,
  canAdvanceToStep,
  canCompleteMastery,
} from '../dist-test/services/progressionGates.js';

test('Progression Gates: Step 1 Verified Concept Gate', async (t) => {
  await t.test('Unverified quiz blocks Step 1 when quiz is required', () => {
    assert.strictEqual(isConceptGateSatisfied(false, false, true), false);
  });

  await t.test('Passing the micro-quiz satisfies the gate', () => {
    assert.strictEqual(isConceptGateSatisfied(false, true, true), true);
  });

  await t.test('Already completed concept step satisfies the gate (legacy grandfathering)', () => {
    assert.strictEqual(isConceptGateSatisfied(true, false, true), true);
  });

  await t.test('Drill without a quiz (requiresQuiz: false) satisfies the gate immediately', () => {
    assert.strictEqual(isConceptGateSatisfied(false, false, false), true);
  });
});

test('Progression Gates: Step 4 Oral Rubric Completeness & Score Calculation', async (t) => {
  await t.test('Empty rubric is incomplete', () => {
    assert.strictEqual(isOralAssessmentComplete({}), false);
  });

  await t.test('Partially scored rubric (4 of 5 dimensions) is incomplete', () => {
    const partial = {
      correctness: 3,
      tradeoff: 3,
      failure: 3,
      clarity: 3,
    };
    assert.strictEqual(isOralAssessmentComplete(partial), false);
    const score = computeOralScore(partial);
    assert.strictEqual(score.passed, false);
    assert.deepStrictEqual(score.missingDimensions, ['challenge']);
  });

  await t.test('Rubric with out-of-range score is incomplete and fails', () => {
    const invalid = {
      correctness: 0,
      tradeoff: 3,
      failure: 3,
      clarity: 3,
      challenge: 3,
    };
    assert.strictEqual(isOralAssessmentComplete(invalid), false);
    const score = computeOralScore(invalid);
    assert.strictEqual(score.passed, false);
    assert.deepStrictEqual(score.missingDimensions, ['correctness']);
  });

  await t.test('Exactly 13 points (below 14 threshold) fails assessment', () => {
    const failing = {
      correctness: 3,
      tradeoff: 3,
      failure: 3,
      clarity: 2,
      challenge: 2,
    };
    assert.strictEqual(isOralAssessmentComplete(failing), true);
    const score = computeOralScore(failing);
    assert.strictEqual(score.total, 13);
    assert.strictEqual(score.passed, false);
    assert.strictEqual(score.missingDimensions.length, 0);
  });

  await t.test('Exactly 14 points (passing threshold) passes assessment', () => {
    const passing = {
      correctness: 3,
      tradeoff: 3,
      failure: 3,
      clarity: 3,
      challenge: 2,
    };
    assert.strictEqual(isOralAssessmentComplete(passing), true);
    const score = computeOralScore(passing);
    assert.strictEqual(score.total, 14);
    assert.strictEqual(score.passed, true);
  });

  await t.test('Perfect 20 points passes assessment', () => {
    const perfect = {
      correctness: 4,
      tradeoff: 4,
      failure: 4,
      clarity: 4,
      challenge: 4,
    };
    assert.strictEqual(isOralAssessmentComplete(perfect), true);
    const score = computeOralScore(perfect);
    assert.strictEqual(score.total, 20);
    assert.strictEqual(score.passed, true);
  });
});

test('Progression Gates: Sequential Step Advancement', async (t) => {
  const freshCompletions = { 1: false, 2: false, 3: false, 4: false, 5: false };

  await t.test('Step 1 is always unlocked', () => {
    assert.strictEqual(canAdvanceToStep(1, freshCompletions), true);
  });

  await t.test('Step 2 is locked when Step 1 is incomplete', () => {
    assert.strictEqual(canAdvanceToStep(2, freshCompletions), false);
  });

  await t.test('Step 2 unlocks when Step 1 is complete', () => {
    assert.strictEqual(canAdvanceToStep(2, { ...freshCompletions, 1: true }), true);
  });

  await t.test('Step 5 is locked if Step 4 (oral defense) is incomplete even if 1-3 are complete', () => {
    const step4Incomplete = { 1: true, 2: true, 3: true, 4: false, 5: false };
    assert.strictEqual(canAdvanceToStep(5, step4Incomplete), false);
  });

  await t.test('Step 5 unlocks when Steps 1 through 4 are all complete', () => {
    const step4Complete = { 1: true, 2: true, 3: true, 4: true, 5: false };
    assert.strictEqual(canAdvanceToStep(5, step4Complete), true);
  });
});

test('Progression Gates: Mastery Prerequisite Guard', async (t) => {
  await t.test('Mastery succeeds when Steps 1 through 4 are true and Step 5 is false', () => {
    const readyForMastery = { 1: true, 2: true, 3: true, 4: true, 5: false };
    assert.strictEqual(canCompleteMastery(readyForMastery), true);
  });

  await t.test('Mastery is rejected if Step 4 (oral defense) is false', () => {
    const oralMissing = { 1: true, 2: true, 3: true, 4: false, 5: false };
    assert.strictEqual(canCompleteMastery(oralMissing), false);
  });

  await t.test('Mastery is rejected if any earlier step (e.g. Step 2) is false', () => {
    const drillMissing = { 1: true, 2: false, 3: true, 4: true, 5: false };
    assert.strictEqual(canCompleteMastery(drillMissing), false);
  });

  await t.test('Mastery check remains true for already completed drills (idempotent pass)', () => {
    const alreadyMastered = { 1: true, 2: true, 3: true, 4: true, 5: true };
    assert.strictEqual(canCompleteMastery(alreadyMastered), true);
  });
});
