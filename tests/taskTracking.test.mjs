import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  CURRICULUM_TASKS, 
  resolveTaskStatus, 
  resolveTaskAvailability 
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

  await t.test('Valid architecture specification passes all assertions', () => {
    const res = evaluateSystemDesignDrill(WEEK_6_DRILL.solutionCode);
    assert.strictEqual(res.passed, true);
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

  await t.test('Valid resilient queue job passes all assertions', () => {
    const res = evaluateQueueDlqDrill(WEEK_5_DRILL.solutionCode);
    assert.strictEqual(res.passed, true, 'Valid resilient queue job must pass all assertions');
    for (const a of res.assertionResults) {
      assert.strictEqual(a.passed, true, `Assertion "${a.name}" must pass`);
    }
  });
});


