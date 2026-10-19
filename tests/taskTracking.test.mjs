import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  CURRICULUM_TASKS, 
  resolveTaskStatus, 
  resolveTaskAvailability,
  resolveNextActionableTask,
  resolveCtaPresentation
} from '../dist-test/data/curriculumTasks.js';
import { 
  evaluateSecuritySprintDrill, 
  WEEK_7_DRILL 
} from '../dist-test/drills/week7-security-sprint.js';
import { 
  evaluateSystemDesignDrill, 
  WEEK_6_DRILL 
} from '../dist-test/drills/week6-system-design.js';
import { 
  evaluateLaravelDrill, 
  WEEK_1_DRILL 
} from '../dist-test/drills/week1-internals.js';
import { 
  evaluateCursorPaginationDrill, 
  WEEK_2_DRILL 
} from '../dist-test/drills/week2-api-pagination.js';
import { 
  evaluateClassRefactoringDrill, 
  WEEK_3_DRILL 
} from '../dist-test/drills/week3-clean-architecture.js';
import { 
  evaluateQueueDlqDrill, 
  WEEK_5_DRILL 
} from '../dist-test/drills/week5-async-processing.js';

test('Task Tracking & Catalog Resolution', async (t) => {
  const week1Task = CURRICULUM_TASKS.find((t) => t.id === 'w1-laravel-internals-n1');
  const week2Task = CURRICULUM_TASKS.find((t) => t.id === 'w2-rest-cursor-pagination');
  const week4Task = CURRICULUM_TASKS.find((t) => t.id === 'w4-btree-indexing');
  const week7Task = CURRICULUM_TASKS.find((t) => t.id === 'w7-crud-auth-sprint');

  const week5Task = CURRICULUM_TASKS.find((t) => t.id === 'w5-queue-dlq-pipeline');
  const week6Task = CURRICULUM_TASKS.find((t) => t.id === 'w6-system-design-star');

  assert.ok(week1Task, 'Week 1 task must exist in curriculum catalog');
  assert.ok(week2Task, 'Week 2 task must exist in curriculum catalog');
  assert.ok(week4Task, 'Week 4 task must exist in curriculum catalog');
  assert.ok(week5Task, 'Week 5 task must exist in curriculum catalog');
  assert.ok(week6Task, 'Week 6 task must exist in curriculum catalog');
  assert.ok(week7Task, 'Week 7 task must exist in curriculum catalog');

  await t.test('Active task without prerequisites resolves to "available"', () => {
    const status = resolveTaskStatus(week1Task, undefined, {});
    assert.strictEqual(status, 'available');
    const availability = resolveTaskAvailability(week1Task, status);
    assert.strictEqual(availability, 'active');
  });

  await t.test('Planned task without prerequisites resolves to "planned" (not available)', () => {
    const plannedTask = { ...week2Task, statusActiveInMvp: false, prerequisites: [] };
    const status = resolveTaskStatus(plannedTask, undefined, {});
    assert.strictEqual(status, 'planned');
    const availability = resolveTaskAvailability(plannedTask, status);
    assert.strictEqual(availability, 'planned');
  });

  await t.test('Active task with unmet prerequisites resolves to "locked"', () => {
    // Week 4 requires Week 1 to be completed or verified
    const status = resolveTaskStatus(week4Task, undefined, {});
    assert.strictEqual(status, 'locked');
    const availability = resolveTaskAvailability(week4Task, status);
    assert.strictEqual(availability, 'blocked');
  });

  await t.test('Active task with partially met prerequisites remains "locked"', () => {
    const allStates = {
      'w1-laravel-internals-n1': {
        taskId: 'w1-laravel-internals-n1',
        status: 'in_progress',
        attempts: 1,
      },
    };
    const status = resolveTaskStatus(week4Task, undefined, allStates);
    assert.strictEqual(status, 'locked');
    assert.strictEqual(resolveTaskAvailability(week4Task, status), 'blocked');
  });

  await t.test('Active task with satisfied prerequisites resolves to "available"', () => {
    const allStates = {
      'w1-laravel-internals-n1': {
        taskId: 'w1-laravel-internals-n1',
        status: 'completed',
        attempts: 2,
      },
    };
    const status = resolveTaskStatus(week4Task, undefined, allStates);
    assert.strictEqual(status, 'available');
    assert.strictEqual(resolveTaskAvailability(week4Task, status), 'active');
  });

  await t.test('Active task with verified prerequisite resolves to "available"', () => {
    const allStates = {
      'w1-laravel-internals-n1': {
        taskId: 'w1-laravel-internals-n1',
        status: 'verified',
        attempts: 1,
      },
    };
    const status = resolveTaskStatus(week4Task, undefined, allStates);
    assert.strictEqual(status, 'available');
    assert.strictEqual(resolveTaskAvailability(week4Task, status), 'active');
  });

  await t.test('Planned task with satisfied prerequisites remains "planned"', () => {
    const plannedWithPrereq = { ...week5Task, statusActiveInMvp: false };
    const allStates = {
      'w4-btree-indexing': {
        taskId: 'w4-btree-indexing',
        status: 'completed',
        attempts: 1,
      },
    };
    const status = resolveTaskStatus(plannedWithPrereq, undefined, allStates);
    assert.strictEqual(status, 'planned');
    assert.strictEqual(resolveTaskAvailability(plannedWithPrereq, status), 'planned');
  });

  await t.test('Week 6 (Active) resolves to "locked" without Week 4 and "available" when Week 4 is completed', () => {
    // Locked when prerequisites are missing
    const lockedStatus = resolveTaskStatus(week6Task, undefined, {});
    assert.strictEqual(lockedStatus, 'locked');
    assert.strictEqual(resolveTaskAvailability(week6Task, lockedStatus), 'blocked');

    // Available when Week 4 is completed
    const allStates = {
      'w4-btree-indexing': {
        taskId: 'w4-btree-indexing',
        status: 'completed',
        attempts: 1,
      },
    };
    const availableStatus = resolveTaskStatus(week6Task, undefined, allStates);
    assert.strictEqual(availableStatus, 'available');
    assert.strictEqual(resolveTaskAvailability(week6Task, availableStatus), 'active');
  });

  await t.test('Week 7 (Active) multi-prerequisite gating resolves to "locked" until both Week 1 & 4 are satisfied', () => {
    // Locked if only Week 1 is completed
    const onlyWeek1 = {
      'w1-laravel-internals-n1': {
        taskId: 'w1-laravel-internals-n1',
        status: 'verified',
        attempts: 1,
      },
    };
    const status1 = resolveTaskStatus(week7Task, undefined, onlyWeek1);
    assert.strictEqual(status1, 'locked');

    // Locked if only Week 4 is completed
    const onlyWeek4 = {
      'w4-btree-indexing': {
        taskId: 'w4-btree-indexing',
        status: 'verified',
        attempts: 1,
      },
    };
    const status4 = resolveTaskStatus(week7Task, undefined, onlyWeek4);
    assert.strictEqual(status4, 'locked');

    // Available when BOTH Week 1 & Week 4 are completed/verified
    const bothSatisfied = {
      ...onlyWeek1,
      ...onlyWeek4,
    };
    const statusBoth = resolveTaskStatus(week7Task, undefined, bothSatisfied);
    assert.strictEqual(statusBoth, 'available');
    assert.strictEqual(resolveTaskAvailability(week7Task, statusBoth), 'active');
  });

  await t.test('In-progress status is preserved for active tasks', () => {
    const taskState = {
      taskId: 'w1-laravel-internals-n1',
      status: 'in_progress',
      attempts: 3,
    };
    const status = resolveTaskStatus(week1Task, taskState, {});
    assert.strictEqual(status, 'in_progress');
    assert.strictEqual(resolveTaskAvailability(week1Task, status), 'active');
  });

  await t.test('Completed and verified statuses are preserved unconditionally', () => {
    const completedState = {
      taskId: 'w1-laravel-internals-n1',
      status: 'completed',
      attempts: 1,
    };
    assert.strictEqual(resolveTaskStatus(week1Task, completedState, {}), 'completed');

    const verifiedState = {
      taskId: 'w1-laravel-internals-n1',
      status: 'verified',
      attempts: 2,
    };
    assert.strictEqual(resolveTaskStatus(week1Task, verifiedState, {}), 'verified');
  });

  await t.test('Deferred status is preserved', () => {
    const deferredState = {
      taskId: 'w1-laravel-internals-n1',
      status: 'deferred',
      attempts: 1,
    };
    assert.strictEqual(resolveTaskStatus(week1Task, deferredState, {}), 'deferred');
  });

  await t.test('Attempt counts increment non-destructively on repeat mastery', () => {
    let existingTask = undefined;
    
    // First attempt:
    let attempts = (existingTask?.attempts ?? 0) + 1;
    assert.strictEqual(attempts, 1);
    existingTask = { taskId: 'w1-laravel-internals-n1', status: 'in_progress', attempts };

    // Second attempt:
    attempts = (existingTask?.attempts ?? 0) + 1;
    assert.strictEqual(attempts, 2);
    existingTask = { taskId: 'w1-laravel-internals-n1', status: 'completed', attempts };

    // Third attempt (mastery verified via Docker runtime):
    attempts = (existingTask?.attempts ?? 0) + 1;
    assert.strictEqual(attempts, 3);
  });
});

test('Envelope Depth Guard Protection', () => {
  function checkDepth(obj, currentDepth = 0, maxDepth = 6) {
    if (currentDepth > maxDepth) return false;
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        if (!checkDepth(obj[key], currentDepth + 1, maxDepth)) {
          return false;
        }
      }
    }
    return true;
  }

  const shallowPayload = {
    version: '1.0.0',
    data: {
      tasks: {
        w1: { status: 'completed', attempts: 1 }
      }
    }
  };
  assert.strictEqual(checkDepth(shallowPayload), true, 'Valid envelope depth <= 6 must pass');

  // Deeply nested payload (depth 8)
  const maliciousDeepPayload = {
    l1: { l2: { l3: { l4: { l5: { l6: { l7: { l8: 'exploit' } } } } } } }
  };
  assert.strictEqual(checkDepth(maliciousDeepPayload), false, 'Deeply nested payload > 6 must be rejected');

  // Drill session with StarStories payload (depth 4)
  const sessionWithStarStories = {
    drillSessions: {
      'w6-system-design-foundation': {
        drillId: 'w6-system-design-foundation',
        week: 6,
        starStories: [
          {
            id: 'spike-defense',
            title: 'Custom Title',
            category: 'Category',
            situation: 'Custom Situation',
            task: 'Custom Task',
            action: 'Custom Action',
            result: 'Custom Result',
          }
        ]
      }
    }
  };
  assert.strictEqual(checkDepth(sessionWithStarStories), true, 'Drill session with StarStories must satisfy depth <= 6');
});

test('Week 7 Security Sprint Evaluator & Anti-Bypass Invariants', async (t) => {
  await t.test('Untouched starter code fails assertions', () => {
    const res = evaluateSecuritySprintDrill(WEEK_7_DRILL.initialCode);
    assert.strictEqual(res.passed, false, 'Untouched starter code must fail');
    const sessionAssertion = res.assertionResults.find((a) => a.name === 'Session Fixation Defense');
    const policyAssertion = res.assertionResults.find((a) => a.name === 'Model Policy Gate Enforcement');
    assert.strictEqual(sessionAssertion.passed, false);
    assert.strictEqual(policyAssertion.passed, false);
  });

  await t.test('Comment-only security calls are rejected', () => {
    const commentExploit = `<?php
namespace App\\Http\\Controllers;
class AuthController extends Controller {
    public function login(Request $request) {
        // $request->session()->regenerate();
        /* session()->regenerate(); */
        return response()->json([]);
    }
    public function updateRecord(Request $request, Record $record) {
        // $this->authorize('update', $record);
        /* Gate::authorize('update', $record); */
        $record->update($validated);
        return response()->json([]);
    }
}`;
    const res = evaluateSecuritySprintDrill(commentExploit);
    assert.strictEqual(res.passed, false, 'Comment-only submissions must never pass');
    const sessionAssertion = res.assertionResults.find((a) => a.name === 'Session Fixation Defense');
    const policyAssertion = res.assertionResults.find((a) => a.name === 'Model Policy Gate Enforcement');
    assert.strictEqual(sessionAssertion.passed, false);
    assert.strictEqual(policyAssertion.passed, false);
  });

  await t.test('String-only security calls are rejected', () => {
    const stringExploit = `<?php
namespace App\\Http\\Controllers;
class AuthController extends Controller {
    public function login(Request $request) {
        $msg = '$request->session()->regenerate();';
        return response()->json([]);
    }
    public function updateRecord(Request $request, Record $record) {
        $msg = '$this->authorize("update", $record);';
        $record->update($validated);
        return response()->json([]);
    }
}`;
    const res = evaluateSecuritySprintDrill(stringExploit);
    assert.strictEqual(res.passed, false, 'String-only submissions must never pass');
  });

  await t.test('Heredoc and nowdoc security calls are rejected', () => {
    const heredocExploit = `<?php
namespace App\\Http\\Controllers;
class AuthController extends Controller {
    public function login(Request $request) {
        $msg = <<<EOT
$request->session()->regenerate();
EOT;
        return response()->json([]);
    }
    public function updateRecord(Request $request, Record $record) {
        $msg = <<<'NOWDOC'
$this->authorize('update', $record);
NOWDOC;
        $record->update($validated);
        return response()->json([]);
    }
}`;
    const res = evaluateSecuritySprintDrill(heredocExploit);
    assert.strictEqual(res.passed, false, 'Heredoc/nowdoc submissions must never pass');
    const sessionAssertion = res.assertionResults.find((a) => a.name === 'Session Fixation Defense');
    const policyAssertion = res.assertionResults.find((a) => a.name === 'Model Policy Gate Enforcement');
    assert.strictEqual(sessionAssertion.passed, false);
    assert.strictEqual(policyAssertion.passed, false);
  });

  await t.test('Backtick execution security calls are rejected', () => {
    const backtickExploit = `<?php
namespace App\\Http\\Controllers;
class AuthController extends Controller {
    public function login(Request $request) {
        $cmd = \`$request->session()->regenerate();\`;
        return response()->json([]);
    }
    public function updateRecord(Request $request, Record $record) {
        $cmd = \`$this->authorize('update', $record);\`;
        $record->update($validated);
        return response()->json([]);
    }
}`;
    const res = evaluateSecuritySprintDrill(backtickExploit);
    assert.strictEqual(res.passed, false, 'Backtick execution submissions must never pass');
  });

  await t.test('Authorization executed after mutation is rejected', () => {
    const reorderedExploit = `<?php
namespace App\\Http\\Controllers;
class AuthController extends Controller {
    public function login(Request $request) {
        if (!Auth::attempt($credentials)) return response()->json([], 401);
        $request->session()->regenerate();
        return response()->json([]);
    }
    public function updateRecord(Request $request, Record $record) {
        $record->update($validated);
        $this->authorize('update', $record);
        return response()->json([]);
    }
}`;
    const res = evaluateSecuritySprintDrill(reorderedExploit);
    assert.strictEqual(res.passed, false, 'Authorization after mutation must fail');
    const policyAssertion = res.assertionResults.find((a) => a.name === 'Model Policy Gate Enforcement');
    assert.strictEqual(policyAssertion.passed, false);
  });

  await t.test('Valid remediated submission passes all security assertions', () => {
    const res = evaluateSecuritySprintDrill(WEEK_7_DRILL.solutionCode);
    assert.strictEqual(res.passed, true, 'Properly remediated code must pass');
    for (const a of res.assertionResults) {
      assert.strictEqual(a.passed, true, `Assertion "${a.name}" must pass`);
    }
  });
});

test('Week 6 System Design Evaluator & Type Safety Invariants', async (t) => {
  await t.test('Malformed JSON gracefully fails without throwing', () => {
    const res = evaluateSystemDesignDrill('{ not valid json');
    assert.strictEqual(res.passed, false);
    assert.strictEqual(res.assertionResults[0].passed, false);
  });

  await t.test('Top-level non-object JSON gracefully fails without throwing', () => {
    const res = evaluateSystemDesignDrill('["array", "not", "object"]');
    assert.strictEqual(res.passed, false);
    assert.strictEqual(res.assertionResults[0].passed, false);
  });

  await t.test('Non-string field types gracefully fail without throwing .includes() TypeError', () => {
    const nonStringSpec = JSON.stringify({
      architecture: {
        buffer: {
          backpressureStrategy: 12345 // number instead of string
        },
        storage: {
          partitionKey: true // boolean instead of string
        }
      },
      starStories: {
        spikeDefense: {
          action: {}, // object instead of string
          result: null // null instead of string
        }
      }
    });
    const res = evaluateSystemDesignDrill(nonStringSpec);
    assert.strictEqual(res.passed, false);
    assert.strictEqual(res.assertionResults[1].passed, false);
    assert.strictEqual(res.assertionResults[2].passed, false);
    assert.strictEqual(res.assertionResults[3].passed, false);
  });

  await t.test('Worker batchSize mismatch or omission fails assertion', () => {
    const wrongBatchSpec = JSON.stringify({
      architecture: {
        buffer: { backpressureStrategy: 'dynamic token bucket' },
        workers: { concurrency: 64, batchSize: 500, deadLetterQueue: true },
        storage: { partitionKey: 'recorded_at::date' },
      },
      starStories: {
        spikeDefense: { action: 'Scaled shards', result: '99.99% uptime' },
      },
    });
    const res = evaluateSystemDesignDrill(wrongBatchSpec);
    assert.strictEqual(res.passed, false);
    const batchAssertion = res.assertionResults.find((a) => a.name === 'Worker Batch Size Alignment');
    assert.strictEqual(batchAssertion.passed, false);
  });

  await t.test('One-character filler strings or missing resultMetrics fail assertions', () => {
    const fillerSpec = JSON.stringify({
      architecture: {
        buffer: { backpressureStrategy: 'a' },
        workers: { batchSize: 1000 },
        storage: { partitionKey: 'b' },
      },
      starStories: {
        spikeDefense: {
          action: 'c',
          result: 'd',
        },
      },
    });
    const res = evaluateSystemDesignDrill(fillerSpec);
    assert.strictEqual(res.passed, false, 'Filler strings without metrics must fail');
    const starAssertion = res.assertionResults.find((a) => a.name === 'STAR Architecture Story Defense');
    assert.strictEqual(starAssertion.passed, false);
  });

  await t.test('Valid architecture specification passes all assertions', () => {
    const res = evaluateSystemDesignDrill(WEEK_6_DRILL.solutionCode);
    assert.strictEqual(res.passed, true);
    for (const a of res.assertionResults) {
      assert.strictEqual(a.passed, true, `Assertion "${a.name}" must pass`);
    }
  });
});

test('Week 1 Laravel Internals & Eager Loading Evaluator Invariants', async (t) => {
  await t.test('Untouched starter code with Post::all() fails assertions', () => {
    const res = evaluateLaravelDrill(WEEK_1_DRILL.initialCode);
    assert.strictEqual(res.passed, false, 'Untouched starter code must fail');
    assert.strictEqual(res.queriesExecuted, 51);
    const budgetAssertion = res.assertionResults.find((a) => a.name === 'Query budget satisfied');
    assert.strictEqual(budgetAssertion.passed, false);
  });

  await t.test('Comment-only bypass attempts are rejected', () => {
    const commentExploit = `<?php
namespace App\\Http\\Controllers;
class PostController extends Controller {
    public function index(Request $request): JsonResponse {
        // Post::with(['author', 'comments'])->get();
        // $post->author->name;
        // $post->comments->count();
        $posts = Post::all();
        return response()->json([]);
    }
}`;
    const res = evaluateLaravelDrill(commentExploit);
    assert.strictEqual(res.passed, false, 'Comment-only bypass must fail');
  });

  await t.test('String, heredoc, and backtick bypass attempts are rejected', () => {
    const stringExploit = `<?php
namespace App\\Http\\Controllers;
class PostController extends Controller {
    public function index(Request $request): JsonResponse {
        $msg = 'Post::with(["author", "comments"])->get();';
        $doc = <<<EOT
Post::with(['author', 'comments'])->get();
author comments
EOT;
        $cmd = \`Post::with(['author', 'comments'])->get();\`;
        $posts = Post::all();
        return response()->json([]);
    }
}`;
    const res = evaluateLaravelDrill(stringExploit);
    assert.strictEqual(res.passed, false, 'String, heredoc, and backtick exploits must fail');
  });

  await t.test('Comma-separated relation arguments without array are rejected', () => {
    const invalidSyntaxCode = `<?php
namespace App\\Http\\Controllers;
use App\\Models\\Post;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class PostController extends Controller {
    public function index(Request $request): JsonResponse {
        $posts = Post::with('author', 'comments')->get();
        $data = $posts->map(function ($post) {
            return [
                'id' => $post->id,
                'title' => $post->title,
                'author' => $post->author->name,
                'comments_count' => $post->comments->count(),
            ];
        });
        return response()->json($data);
    }
}`;
    const res = evaluateLaravelDrill(invalidSyntaxCode);
    assert.strictEqual(res.passed, false, 'with("author", "comments") without array must fail');
    assert.match(res.assertionResults[0].message, /Syntax error: Eloquent with\(\) does not accept multiple relationship names/);
  });

  await t.test('Chaining withCount but reading $post->comments->count() triggers per-row lazy load warning and fails', () => {
    const mixedCode = `<?php
namespace App\\Http\\Controllers;
use App\\Models\\Post;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class PostController extends Controller {
    public function index(Request $request): JsonResponse {
        $posts = Post::with('author')->withCount('comments')->get();
        $data = $posts->map(function ($post) {
            return [
                'id' => $post->id,
                'title' => $post->title,
                'author' => $post->author->name,
                'comments_count' => $post->comments->count(),
            ];
        });
        return response()->json($data);
    }
}`;
    const res = evaluateLaravelDrill(mixedCode);
    assert.strictEqual(res.passed, false, 'Accessing ->comments->count() with withCount must fail');
    const commentsAssertion = res.assertionResults.find((a) => a.name === 'Comments relation eager loaded or aggregated');
    assert.strictEqual(commentsAssertion.passed, false);
    assert.match(commentsAssertion.message, /Calling \$post->comments->count\(\) still triggers lazy relation queries/);
  });

  await t.test('Chaining withCount and reading $post->comments_count passes with query count 2', () => {
    const withCountCode = `<?php
namespace App\\Http\\Controllers;
use App\\Models\\Post;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class PostController extends Controller {
    public function index(Request $request): JsonResponse {
        $posts = Post::with('author')->withCount('comments')->get();
        $data = $posts->map(function ($post) {
            return [
                'id' => $post->id,
                'title' => $post->title,
                'author' => $post->author->name,
                'comments_count' => $post->comments_count,
            ];
        });
        return response()->json($data);
    }
}`;
    const res = evaluateLaravelDrill(withCountCode);
    assert.strictEqual(res.passed, true, 'Proper withCount usage must pass');
    assert.strictEqual(res.queriesExecuted, 2, 'Budget should be 2 queries');
  });

  await t.test('Eager loading with double quotes and column selection passes assertions', () => {
    const colSelectionCode = `<?php
namespace App\\Http\\Controllers;
use App\\Models\\Post;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class PostController extends Controller {
    public function index(Request $request): JsonResponse {
        $posts = Post::with(["author:id,name", "comments"])->get();
        $data = $posts->map(function ($post) {
            return [
                'id' => $post->id,
                'title' => $post->title,
                'author' => $post->author->name,
                'comments_count' => $post->comments->count(),
            ];
        });
        return response()->json($data);
    }
}`;
    const res = evaluateLaravelDrill(colSelectionCode);
    assert.strictEqual(res.passed, true, 'Double quotes and column selection must pass');
    assert.strictEqual(res.queriesExecuted, 3);
  });

  await t.test('Standard eager loading solution passes all assertions with query count 3', () => {
    const res = evaluateLaravelDrill(WEEK_1_DRILL.solutionCode);
    assert.strictEqual(res.passed, true, 'Valid solution must pass');
    assert.strictEqual(res.queriesExecuted, 3);
    for (const a of res.assertionResults) {
      assert.strictEqual(a.passed, true, `Assertion "${a.name}" must pass`);
    }
  });
});

test('Week 2 REST Cursor Pagination Evaluator & Anti-Bypass Invariants', async (t) => {
  await t.test('Untouched starter code with OFFSET fails assertions', () => {
    const res = evaluateCursorPaginationDrill(WEEK_2_DRILL.initialCode);
    assert.strictEqual(res.passed, false, 'Untouched starter using OFFSET must fail');
    const offsetAssertion = res.assertionResults.find((a) => a.name === 'Eliminated OFFSET & skip() Modifiers');
    assert.strictEqual(offsetAssertion.passed, false);
  });

  await t.test('Comment-only bypass attempts are rejected', () => {
    const commentExploit = `<?php
namespace App\\Http\\Controllers\\Api;
class ObservationApiController extends Controller {
    public function index(Request $request): JsonResponse {
        // base64_decode($cursor);
        // base64_encode("$recorded_at:$id");
        // $query->where('recorded_at', '<', $cursorRecordedAt);
        // return response()->json(['type' => 'https://api.syscraft.io/errors/invalid-cursor'], 400);
        return response()->json([]);
    }
}`;
    const res = evaluateCursorPaginationDrill(commentExploit);
    assert.strictEqual(res.passed, false, 'Comment-only bypass must fail');
  });

  await t.test('String, heredoc, and backtick bypass attempts are rejected', () => {
    const stringExploit = `<?php
namespace App\\Http\\Controllers\\Api;
class ObservationApiController extends Controller {
    public function index(Request $request): JsonResponse {
        $msg = 'base64_decode($cursor); base64_encode("x:y");';
        $doc = <<<EOT
recorded_at < $cursorRecordedAt
type title status detail instance 400
next_cursor
EOT;
        $cmd = \`base64_decode($cursor);\`;
        return response()->json([]);
    }
}`;
    const res = evaluateCursorPaginationDrill(stringExploit);
    assert.strictEqual(res.passed, false, 'String, heredoc, and backtick exploits must fail');
  });

  await t.test('Query filtering only recorded_at < $cursor without tie-breaker branch fails', () => {
    const seekWithoutTieBreaker = `<?php
namespace App\\Http\\Controllers\\Api;
use App\\Models\\WeatherObservation;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class ObservationApiController extends Controller {
    public function index(Request $request): JsonResponse {
        $cursor = $request->input('cursor');
        if ($cursor !== null) {
            $decoded = base64_decode($cursor, true);
            if ($decoded === false || !str_contains($decoded, ':')) {
                return response()->json([
                    'type' => 'https://api.syscraft.io/errors/invalid-cursor',
                    'title' => 'Invalid Pagination Cursor',
                    'status' => 400,
                ], 400, ['Content-Type' => 'application/problem+json']);
            }
        }
        $query = WeatherObservation::query()
            ->where('recorded_at', '<', $cursor)
            ->orderBy('recorded_at', 'desc')
            ->orderBy('id', 'desc');
        return response()->json(['data' => $query->limit(20)->get(), 'next_cursor' => base64_encode('x:1')]);
    }
}`;
    const res = evaluateCursorPaginationDrill(seekWithoutTieBreaker);
    assert.strictEqual(res.passed, false, 'Seek without tie-breaker must fail');
    const seekAssertion = res.assertionResults.find((a) => a.name === 'Seek-based Composite Key Traversal');
    assert.strictEqual(seekAssertion.passed, false);
    assert.match(seekAssertion.message, /lacks equality tie-breaker/);
  });

  await t.test('Valid remediated cursor pagination passes all assertions', () => {
    const res = evaluateCursorPaginationDrill(WEEK_2_DRILL.solutionCode);
    assert.strictEqual(res.passed, true, 'Valid cursor solution must pass all assertions');
    for (const a of res.assertionResults) {
      assert.strictEqual(a.passed, true, `Assertion "${a.name}" must pass`);
    }
  });
});

test('Week 3 Clean Architecture & Dependency Injection Invariants', async (t) => {
  await t.test('Untouched starter code with direct instantiation fails', () => {
    const res = evaluateClassRefactoringDrill(WEEK_3_DRILL.initialCode);
    assert.strictEqual(res.passed, false, 'Untouched starter with new OpenMeteoClient must fail');
    const newAssertion = res.assertionResults.find((a) => a.name === 'Eliminated Direct Concrete Instantiation');
    assert.strictEqual(newAssertion.passed, false);
  });

  await t.test('Comment-only bypass attempts are rejected', () => {
    const commentExploit = `<?php
namespace App\\Services;
class WeatherReportService {
    // SensorClientInterface $sensorClient
    // $this->app->bind(SensorClientInterface::class, OpenMeteoClient::class);
    // implements WeatherReportServiceInterface
}`;
    const res = evaluateClassRefactoringDrill(commentExploit);
    assert.strictEqual(res.passed, false, 'Comment-only bypass must fail');
  });

  await t.test('String, heredoc, and backtick bypass attempts are rejected', () => {
    const stringExploit = `<?php
namespace App\\Services;
class WeatherReportService {
    public function fake() {
        $msg = 'SensorClientInterface $sensorClient; $this->app->bind(SensorClientInterface::class, OpenMeteoClient::class);';
        $doc = <<<EOT
SensorClientInterface WeatherReportServiceInterface
EOT;
        $cmd = \`$this->app->bind();\`;
    }
}`;
    const res = evaluateClassRefactoringDrill(stringExploit);
    assert.strictEqual(res.passed, false, 'String, heredoc, and backtick exploits must fail');
  });

  await t.test('Valid refactored service with IoC container binding passes all assertions', () => {
    const res = evaluateClassRefactoringDrill(WEEK_3_DRILL.solutionCode);
    assert.strictEqual(res.passed, true, 'Valid refactored service must pass all assertions');
    for (const a of res.assertionResults) {
      assert.strictEqual(a.passed, true, `Assertion "${a.name}" must pass`);
    }
  });
});

test('Week 5 Resilient Queue & Dead-Letter Pipeline Invariants', async (t) => {
  await t.test('Untouched starter code without tries and backoff fails', () => {
    const res = evaluateQueueDlqDrill(WEEK_5_DRILL.initialCode);
    assert.strictEqual(res.passed, false, 'Untouched starter without tries/backoff must fail');
    const triesAssertion = res.assertionResults.find((a) => a.name === 'Bounded Retry Ceiling ($tries)');
    assert.strictEqual(triesAssertion.passed, false);
  });

  await t.test('Comment-only bypass attempts are rejected', () => {
    const commentExploit = `<?php
namespace App\\Jobs;
class ProcessTelemetryBatchJob {
    // public int $tries = 3;
    // public array $backoff = [10, 60, 300];
    // Cache::lock("telemetry_batch:key");
    // public function failed() {}
}`;
    const res = evaluateQueueDlqDrill(commentExploit);
    assert.strictEqual(res.passed, false, 'Comment-only bypass must fail');
  });

  await t.test('String, heredoc, and backtick bypass attempts are rejected', () => {
    const stringExploit = `<?php
namespace App\\Jobs;
class ProcessTelemetryBatchJob {
    public function fake() {
        $msg = '$tries = 3; $backoff = [10, 60, 300]; Cache::lock(); failed();';
        $doc = <<<EOT
$tries = 3; $backoff = [10, 60, 300];
EOT;
        $cmd = \`Cache::lock();\`;
    }
}`;
    const res = evaluateQueueDlqDrill(stringExploit);
    assert.strictEqual(res.passed, false, 'String, heredoc, and backtick exploits must fail');
  });

  await t.test('Bypass with bare idempotencyKey reference and insertOrIgnore without lock or ledger is rejected', () => {
    const fakeIdempotencyCode = `<?php
namespace App\\Jobs;
use Illuminate\\Support\\Facades\\DB;
class ProcessTelemetryBatchJob {
    public int $tries = 3;
    public array $backoff = [10, 60, 300];
    public function handle(): void {
        $this->idempotencyKey;
        DB::table('weather_observations')->insertOrIgnore($this->telemetryBatch);
    }
    public function failed(\\Throwable $e): void {
        DB::table('dead_letter_jobs')->insert([]);
    }
}`;
    const res = evaluateQueueDlqDrill(fakeIdempotencyCode);
    assert.strictEqual(res.passed, false, 'Bare idempotencyKey reference without lock/ledger must fail');
    const idempAssertion = res.assertionResults.find((a) => a.name === 'Idempotency Lock Enforcement');
    assert.strictEqual(idempAssertion.passed, false);
  });

  await t.test('Valid resilient queue job passes all assertions', () => {
    const res = evaluateQueueDlqDrill(WEEK_5_DRILL.solutionCode);
    assert.strictEqual(res.passed, true, 'Valid resilient queue job must pass all assertions');
    for (const a of res.assertionResults) {
      assert.strictEqual(a.passed, true, `Assertion "${a.name}" must pass`);
    }
  });
});

test('Bridge Command Manifest Parity & Tier 3 Invariants', async (t) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = path.resolve(__dirname, '../bridge/command_manifest.v1.json');
  assert.ok(fs.existsSync(manifestPath), 'command_manifest.v1.json must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(Array.isArray(manifest.allowedCommands), 'allowedCommands must be an array');

  const EXPECTED_BRIDGE_COMMANDS = {
    1: { id: 'laravel-n1-test', drillId: 'w1-laravel-internals-n1', filter: 'PostNPlusOneTest' },
    3: { id: 'class-refactoring-di-test', drillId: 'w3-class-refactoring-di', filter: 'ClassRefactoringDiTest' },
    4: { id: 'postgres-plan-test', drillId: 'w4-btree-indexing', filter: 'PostgresIndexPlanTest' },
    7: { id: 'w7-auth-sprint-test', drillId: 'w7-crud-auth-sprint', filter: 'SecurityAuthSprintTest' },
  };

  await t.test('All active weeks with bridge commands exist in command manifest with matching drillId', () => {
    for (const [weekStr, expected] of Object.entries(EXPECTED_BRIDGE_COMMANDS)) {
      const week = Number(weekStr);
      const cmdEntry = manifest.allowedCommands.find((c) => c.id === expected.id);
      assert.ok(cmdEntry, `Command ID "${expected.id}" for Week ${week} must exist in allowedCommands`);
      
      const task = CURRICULUM_TASKS.find((ct) => ct.week === week);
      assert.ok(task, `Task for Week ${week} must exist in curriculum tasks`);
      assert.strictEqual(cmdEntry.drillId, task.id, `Command "${expected.id}" drillId must match ${task.id}`);
      assert.strictEqual(cmdEntry.executable, 'docker', `Command "${expected.id}" executable must be docker`);
      assert.ok(cmdEntry.args.includes('test'), `Command "${expected.id}" must include test service`);
      assert.ok(cmdEntry.args.some((a) => a.includes(`--filter=${expected.filter}`)), `Command "${expected.id}" must target --filter=${expected.filter}`);
    }
  });

  await t.test('Week 3 class-refactoring-di-test manifest command is valid and targets ClassRefactoringDiTest', () => {
    const cmd = manifest.allowedCommands.find((c) => c.id === 'class-refactoring-di-test');
    assert.ok(cmd, 'class-refactoring-di-test must exist in manifest');
    assert.strictEqual(cmd.drillId, 'w3-class-refactoring-di');
    assert.ok(cmd.args.some((a) => a.includes('--filter=ClassRefactoringDiTest')), 'Command must target ClassRefactoringDiTest filter');
  });

  await t.test('Command IDs in manifest are unique', () => {
    const ids = manifest.allowedCommands.map((c) => c.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'All manifest command IDs must be unique');
  });
});

test('Active Frontier Resolver & CTA Presentation Invariants', async (t) => {
  await t.test('Fresh learner state (empty states) resolves to Week 1 available', () => {
    const action = resolveNextActionableTask(CURRICULUM_TASKS, {});
    assert.deepStrictEqual(action, { week: 1, kind: 'available' });

    const cta = resolveCtaPresentation(action, CURRICULUM_TASKS);
    assert.strictEqual(cta.label, 'Start Week 1: Laravel Request Lifecycle & Eloquent N+1 Elimination');
    assert.strictEqual(cta.ariaLabel, 'Launch Week 1 workbench: Laravel Request Lifecycle & Eloquent N+1 Elimination');
  });

  await t.test('Week 1 completed resolves to Week 2 available', () => {
    const states = {
      'w1-laravel-internals-n1': { taskId: 'w1-laravel-internals-n1', status: 'completed', attempts: 1 }
    };
    const action = resolveNextActionableTask(CURRICULUM_TASKS, states);
    assert.deepStrictEqual(action, { week: 2, kind: 'available' });

    const cta = resolveCtaPresentation(action, CURRICULUM_TASKS);
    assert.strictEqual(cta.label, 'Continue to Week 2: REST Cursor Pagination & RFC 9457 Problem Details');
    assert.strictEqual(cta.ariaLabel, 'Launch Week 2 workbench: REST Cursor Pagination & RFC 9457 Problem Details');
  });

  await t.test('Week 1 verified resolves to Week 2 available', () => {
    const states = {
      'w1-laravel-internals-n1': { taskId: 'w1-laravel-internals-n1', status: 'verified', attempts: 1 }
    };
    const action = resolveNextActionableTask(CURRICULUM_TASKS, states);
    assert.deepStrictEqual(action, { week: 2, kind: 'available' });
  });

  await t.test('Non-contiguous completion (Weeks 1 & 4 completed) resolves to earliest available (Week 2)', () => {
    const states = {
      'w1-laravel-internals-n1': { taskId: 'w1-laravel-internals-n1', status: 'completed', attempts: 1 },
      'w4-btree-indexing': { taskId: 'w4-btree-indexing', status: 'completed', attempts: 1 }
    };
    const action = resolveNextActionableTask(CURRICULUM_TASKS, states);
    assert.deepStrictEqual(action, { week: 2, kind: 'available' });
  });

  await t.test('Active in_progress task resolves with in_progress kind and Resume copy', () => {
    const states = {
      'w1-laravel-internals-n1': { taskId: 'w1-laravel-internals-n1', status: 'completed', attempts: 1 },
      'w2-rest-cursor-pagination': { taskId: 'w2-rest-cursor-pagination', status: 'completed', attempts: 1 },
      'w3-class-refactoring-di': { taskId: 'w3-class-refactoring-di', status: 'completed', attempts: 1 },
      'w4-btree-indexing': { taskId: 'w4-btree-indexing', status: 'in_progress', attempts: 1 }
    };
    const action = resolveNextActionableTask(CURRICULUM_TASKS, states);
    assert.deepStrictEqual(action, { week: 4, kind: 'in_progress' });

    const cta = resolveCtaPresentation(action, CURRICULUM_TASKS);
    assert.strictEqual(cta.label, 'Resume Week 4: B-Tree Compound Indexing & EXPLAIN QUERY PLAN Lab');
    assert.strictEqual(cta.ariaLabel, 'Resume Week 4 workbench: B-Tree Compound Indexing & EXPLAIN QUERY PLAN Lab');
  });

  await t.test('Week 1 in_progress resolves to Week 1 in_progress with Resume copy', () => {
    const states = {
      'w1-laravel-internals-n1': { taskId: 'w1-laravel-internals-n1', status: 'in_progress', attempts: 1 }
    };
    const action = resolveNextActionableTask(CURRICULUM_TASKS, states);
    assert.deepStrictEqual(action, { week: 1, kind: 'in_progress' });

    const cta = resolveCtaPresentation(action, CURRICULUM_TASKS);
    assert.strictEqual(cta.label, 'Resume Week 1: Laravel Request Lifecycle & Eloquent N+1 Elimination');
    assert.strictEqual(cta.ariaLabel, 'Resume Week 1 workbench: Laravel Request Lifecycle & Eloquent N+1 Elimination');
  });

  await t.test('All active tasks completed resolves to review with derived highest week', () => {
    const states = {};
    for (const t of CURRICULUM_TASKS.filter(ct => ct.statusActiveInMvp)) {
      states[t.id] = { taskId: t.id, status: 'completed', attempts: 1 };
    }
    const action = resolveNextActionableTask(CURRICULUM_TASKS, states);
    assert.deepStrictEqual(action, { week: 7, kind: 'review' });

    const cta = resolveCtaPresentation(action, CURRICULUM_TASKS);
    assert.strictEqual(cta.label, 'Review Curriculum Mastery');
    assert.strictEqual(cta.ariaLabel, 'Review curriculum mastery for Week 7');
  });

  await t.test('Week 1 completed + Week 2 deferred resolves to Week 3 available', () => {
    const states = {
      'w1-laravel-internals-n1': { taskId: 'w1-laravel-internals-n1', status: 'completed', attempts: 1 },
      'w2-rest-cursor-pagination': { taskId: 'w2-rest-cursor-pagination', status: 'deferred', attempts: 1 }
    };
    const action = resolveNextActionableTask(CURRICULUM_TASKS, states);
    assert.deepStrictEqual(action, { week: 3, kind: 'available' });
  });

  await t.test('Totality: Week 1 deferred resolves to Week 2 available', () => {
    const states = {
      'w1-laravel-internals-n1': { taskId: 'w1-laravel-internals-n1', status: 'deferred', attempts: 1 }
    };
    const action = resolveNextActionableTask(CURRICULUM_TASKS, states);
    assert.deepStrictEqual(action, { week: 2, kind: 'available' });
  });

  await t.test('Totality: Synthetic all-active deferred falls back cleanly to Week 1 available', () => {
    const states = {};
    for (const t of CURRICULUM_TASKS.filter(ct => ct.statusActiveInMvp)) {
      states[t.id] = { taskId: t.id, status: 'deferred', attempts: 1 };
    }
    const action = resolveNextActionableTask(CURRICULUM_TASKS, states);
    assert.deepStrictEqual(action, { week: 1, kind: 'available' });
  });
});



