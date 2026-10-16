import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacySession } from '../dist-test/services/sessionMigration.js';

test('Session Migration: Legacy Drill Progress Adapter', async (t) => {
  await t.test('Completed legacy progress with local-runtime source restores full 5/5 mastery state', () => {
    const result = migrateLegacySession({
      completed: true,
      verificationSource: 'local-runtime',
    });

    assert.ok(result, 'Result must be non-null for completed: true');
    assert.strictEqual(result.currentStep, 5);
    assert.strictEqual(result.highestStepReached, 5);
    assert.deepStrictEqual(result.stepCompletions, {
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
    });
    assert.strictEqual(result.drillCompleted, true);
    assert.strictEqual(result.verificationSource, 'local-runtime');
  });

  await t.test('Completed legacy progress without explicit source defaults to simulation', () => {
    const result = migrateLegacySession({
      completed: true,
    });

    assert.ok(result);
    assert.strictEqual(result.currentStep, 5);
    assert.strictEqual(result.highestStepReached, 5);
    assert.deepStrictEqual(result.stepCompletions, {
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
    });
    assert.strictEqual(result.drillCompleted, true);
    assert.strictEqual(result.verificationSource, 'simulation');
  });

  await t.test('Non-completed legacy progress ({ completed: false }) returns null', () => {
    const result = migrateLegacySession({ completed: false });
    assert.strictEqual(result, null);
  });

  await t.test('Empty legacy object ({}) returns null', () => {
    const result = migrateLegacySession({});
    assert.strictEqual(result, null);
  });

  await t.test('Null legacy progress returns null', () => {
    const result = migrateLegacySession(null);
    assert.strictEqual(result, null);
  });

  await t.test('Undefined legacy progress returns null', () => {
    const result = migrateLegacySession(undefined);
    assert.strictEqual(result, null);
  });
});
