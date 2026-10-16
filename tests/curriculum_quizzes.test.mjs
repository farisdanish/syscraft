import test from 'node:test';
import assert from 'node:assert/strict';

import { WEEK_1_DRILL } from '../dist-test/drills/week1-internals.js';
import { WEEK_2_DRILL } from '../dist-test/drills/week2-api-pagination.js';
import { WEEK_3_DRILL } from '../dist-test/drills/week3-clean-architecture.js';
import { WEEK_4_DRILL } from '../dist-test/drills/week4-performance.js';
import { WEEK_5_DRILL } from '../dist-test/drills/week5-async-processing.js';
import { WEEK_6_DRILL } from '../dist-test/drills/week6-system-design.js';
import { WEEK_7_DRILL } from '../dist-test/drills/week7-security-sprint.js';

const ALL_DRILLS = [
  WEEK_1_DRILL,
  WEEK_2_DRILL,
  WEEK_3_DRILL,
  WEEK_4_DRILL,
  WEEK_5_DRILL,
  WEEK_6_DRILL,
  WEEK_7_DRILL,
];

test('Curriculum Concept Check Quizzes & Invariants (Weeks 1–7)', async (t) => {
  for (const drill of ALL_DRILLS) {
    await t.test(`Week ${drill.week} (${drill.id}) has a valid diagnostic concept quiz`, () => {
      const quiz = drill.conceptBrief?.quiz;
      assert.ok(quiz, `Week ${drill.week} conceptBrief must define a quiz`);
      
      // Question invariant
      assert.equal(typeof quiz.question, 'string', `Week ${drill.week} question must be a string`);
      assert.ok(quiz.question.trim().length >= 15, `Week ${drill.week} question must have meaningful length`);

      // Options array invariant
      assert.ok(Array.isArray(quiz.options), `Week ${drill.week} options must be an array`);
      assert.ok(quiz.options.length >= 3, `Week ${drill.week} options must contain at least 3 choices`);

      // Correctness invariant: Exactly one correct option
      const correctOptions = quiz.options.filter(opt => opt.isCorrect === true);
      assert.equal(correctOptions.length, 1, `Week ${drill.week} must have exactly one correct answer`);

      // Unique option IDs
      const ids = quiz.options.map(opt => opt.id);
      const uniqueIds = new Set(ids);
      assert.equal(uniqueIds.size, ids.length, `Week ${drill.week} option IDs must be unique`);

      // Each option field check
      for (const opt of quiz.options) {
        assert.ok(typeof opt.id === 'string' && opt.id.length > 0, `Option ID must be non-empty in Week ${drill.week}`);
        assert.ok(typeof opt.label === 'string' && opt.label.trim().length >= 10, `Option label must be descriptive in Week ${drill.week}`);
        assert.ok(typeof opt.explanation === 'string' && opt.explanation.trim().length >= 15, `Option explanation must explain real-world mechanics in Week ${drill.week}`);
        assert.equal(typeof opt.isCorrect, 'boolean', `isCorrect must be boolean in Week ${drill.week}`);
      }
    });
  }
});
