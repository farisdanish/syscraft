import type { DrillDefinition } from '../types';

export const WEEK_5_DRILL: DrillDefinition = {
  id: 'w5-queue-dlq-pipeline',
  week: 5,
  title: 'Resilient Queue Ingestion & Dead-Letter Backoff Pipeline',
  tier: 2,
  engine: 'simulated-laravel',
  language: 'php',
  targetFile: 'app/Jobs/ProcessTelemetryBatchJob.php',
  conceptBrief: {
    thesis: 'Background workers processing external sensor observations inevitably encounter transient downtime and corrupted payloads. Unprotected jobs cause worker starvation through infinite retry loops; resilient pipelines enforce exponential backoff, atomic idempotency locks, and dead-letter queue (DLQ) isolation.',
    diagramType: 'queue',
    keyPoints: [
      'Worker Starvation: Without max tries ($tries), a job that consistently throws an uncaught exception will re-queue infinitely, consuming worker CPU and starving legitimate jobs.',
      'Exponential Backoff: Immediate retries cause thundering herds on recovering databases; $backoff = [10, 60, 300] allows downstream dependencies to recover gracefully.',
      'Idempotency Keys: Network acknowledgments can fail after successful database commits; workers must check an idempotency key (or atomic lock) before mutating state.',
      'Dead-Letter Queue (DLQ): After exhausting retry budgets, poison messages must be logged and inserted into dead_letter_jobs (idempotency_key, payload, exception, failed_at) for inspection without halting the worker pool.',
      'Timeouts vs Reservation: Queue worker retry_after (in queue config) must ALWAYS exceed job $timeout. If retry_after is shorter, the queue broker will re-assign a running job to a second worker, causing duplicate execution.',
      'At-Least-Once Delivery: Queue systems guarantee message delivery at least once; job handlers must always be architected as idempotent operations.',
    ],
    quiz: {
      question: 'Why is it dangerous to manually release an atomic lock (Cache::lock) inside a queue job that failed due to a timeout?',
      options: [
        {
          id: 'opt-a',
          label: 'The worker supervisor may have already re-queued the job, allowing another worker to acquire the lock and run concurrently.',
          isCorrect: true,
          explanation: 'When a job times out, its lock TTL has often expired. Manually releasing can unlock another worker that acquired the lock on retry, causing duplicate processing.',
        },
        {
          id: 'opt-b',
          label: 'Releasing an expired lock deletes the entire Redis job queue payload.',
          isCorrect: false,
          explanation: 'Lock management operates on dedicated cache keys and does not affect Redis queue lists.',
        },
        {
          id: 'opt-c',
          label: 'Redis throws a fatal syntax error if an expired key is deleted.',
          isCorrect: false,
          explanation: 'Redis DEL and Lua unlock scripts return 0 on missing keys without throwing errors.',
        },
      ],
    },
  },
  hints: [
    "Define $tries property: public int $tries = 3; on the job class.",
    "Implement backoff schedule: public array $backoff = [10, 60, 300]; (or via backoff() method).",
    "Enforce idempotency using Cache::lock('telemetry_batch:'.$this->idempotencyKey, 120). In failed(\\Throwable $e), log the error and insert into dead_letter_jobs with keys: idempotency_key, payload, exception, failed_at.",
  ],
  initialCode: `<?php

namespace App\\Jobs;

use Illuminate\\Bus\\Queueable;
use Illuminate\\Contracts\\Queue\\ShouldQueue;
use Illuminate\\Foundation\\Bus\\Dispatchable;
use Illuminate\\Queue\\InteractsWithQueue;
use Illuminate\\Queue\\SerializesModels;
use Illuminate\\Support\\Facades\\Cache;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Facades\\Log;

class ProcessTelemetryBatchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * DRILL: Unprotected Queue Job (Vulnerable to Worker Poisoning & Duplicate Writes)
     * 1. No $tries configured: Default infinite retry loops on uncaught exception!
     * 2. No exponential $backoff: Immediately retries, slamming struggling databases.
     * 3. No idempotency check: Duplicate execution inserts duplicate sensor records.
     * 4. No failed() hook: Poisonous payloads loop forever without dead-letter isolation.
     *
     * TASKS:
     * 1. Define public int $tries = 3;
     * 2. Define public array $backoff = [10, 60, 300];
     * 3. Enforce idempotency: use Cache::lock("telemetry_batch:{$this->idempotencyKey}", 120)->get() before DB mutation.
     * 4. Implement failed(\\Throwable $exception): Log error and record into dead_letter_jobs with columns:
     *    ['idempotency_key', 'payload', 'exception', 'failed_at'].
     */

    public function __construct(
        public array $telemetryBatch,
        public string $idempotencyKey
    ) {}

    public function handle(): void
    {
        // BUG: Unprotected insertion without idempotency guard
        foreach ($this->telemetryBatch as $reading) {
            DB::table('weather_observations')->insert($reading);
        }
    }
}
`,
  solutionCode: `<?php

namespace App\\Jobs;

use Illuminate\\Bus\\Queueable;
use Illuminate\\Contracts\\Queue\\ShouldQueue;
use Illuminate\\Foundation\\Bus\\Dispatchable;
use Illuminate\\Queue\\InteractsWithQueue;
use Illuminate\\Queue\\SerializesModels;
use Illuminate\\Support\\Facades\\Cache;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Facades\\Log;

class ProcessTelemetryBatchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [10, 60, 300];

    public function __construct(
        public array $telemetryBatch,
        public string $idempotencyKey
    ) {}

    public function handle(): void
    {
        // Idempotency guard: prevent duplicate batch execution
        $lock = Cache::lock("telemetry_batch:{$this->idempotencyKey}", 120);

        if (!$lock->get()) {
            Log::warning("Duplicate job execution prevented for idempotency key: {$this->idempotencyKey}");
            return;
        }

        try {
            DB::transaction(function () {
                foreach ($this->telemetryBatch as $reading) {
                    DB::table('weather_observations')->insertOrIgnore($reading);
                }
            });
        } finally {
            $lock->release();
        }
    }

    public function failed(\\Throwable $exception): void
    {
        Log::error("Telemetry batch job permanently failed after {$this->tries} attempts. Routing to Dead-Letter Queue.", [
            'idempotency_key' => $this->idempotencyKey,
            'batch_count' => count($this->telemetryBatch),
            'error' => $exception->getMessage(),
        ]);

        DB::table('dead_letter_jobs')->insert([
            'idempotency_key' => $this->idempotencyKey,
            'payload' => json_encode($this->telemetryBatch),
            'exception' => $exception->getMessage(),
            'failed_at' => now()->toIso8601String(),
        ]);
    }
}
`,
  validationRules: {
    type: 'ast-property',
    expectedAssertions: [
      'Bounded retry attempts configured ($tries >= 2 and <= 5)',
      'Exponential backoff progression defined ($backoff array)',
      'Idempotency lock enforced before database transaction',
      'Dead-letter routing implemented in failed() callback',
    ],
  },
  oralRubric: {
    question: 'Explain how you design background queue workers to guarantee resilience under external network failures, prevent worker starvation, and handle poison messages.',
    checkpoints: [
      {
        dimension: 'correctness',
        prompt: 'Accurately articulated the relationship between worker reservation timeouts (retry_after) and job execution limits ($tries & $timeout).',
      },
      {
        dimension: 'tradeoff',
        prompt: 'Compared exponential backoff vs. linear retries: Exponential backoff sheds load on failing downstream services, preventing cascading failures.',
      },
      {
        dimension: 'failure',
        prompt: 'Described poison pill message behavior: An unparseable payload that throws immediately will exhaust worker concurrency if not isolated to a DLQ.',
      },
      {
        dimension: 'clarity',
        prompt: 'Explained idempotency mechanisms: using distributed locks (Redis atomic lock) or database unique constraints to safely handle duplicate message delivery.',
      },
      {
        dimension: 'challenge',
        prompt: 'Answered follow-up: "What is the difference between at-least-once and exactly-once processing in distributed queue systems? Why is true exactly-once processing effectively impossible without two-phase commit?"',
      },
    ],
  },
};

/**
 * Hardened PHP comment & inert string stripper for Week 5 validation.
 */
function stripPhpCommentsAndInertStrings(code: string): string {
  let result = '';
  let i = 0;
  const len = code.length;

  const whitelistedLiterals = new Set([
    'telemetry_batch',
    'dead_letter_jobs',
    'weather_observations',
    'idempotencyKey',
    'failed',
    'handle',
  ]);

  while (i < len) {
    if (code[i] === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < len && code[i] !== '\n') i++;
      result += '\n';
      continue;
    }
    if (code[i] === '#') {
      i++;
      while (i < len && code[i] !== '\n') i++;
      result += '\n';
      continue;
    }
    if (code[i] === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') result += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    if (code[i] === "'") {
      let strContent = '';
      i++;
      while (i < len && code[i] !== "'") {
        if (code[i] === '\\' && i + 1 < len) {
          strContent += code[i + 1];
          i += 2;
        } else {
          strContent += code[i];
          i++;
        }
      }
      i++;
      if (whitelistedLiterals.has(strContent.trim())) {
        result += `'${strContent.trim()}'`;
      } else {
        result += "''";
      }
      continue;
    }
    if (code[i] === '"') {
      let strContent = '';
      i++;
      while (i < len && code[i] !== '"') {
        if (code[i] === '\\' && i + 1 < len) {
          strContent += code[i + 1];
          i += 2;
        } else {
          strContent += code[i];
          i++;
        }
      }
      i++;
      if (whitelistedLiterals.has(strContent.trim())) {
        result += `"${strContent.trim()}"`;
      } else {
        result += '""';
      }
      continue;
    }
    if (code[i] === '`') {
      i++;
      while (i < len && code[i] !== '`') {
        if (code[i] === '\\' && i + 1 < len) {
          i += 2;
        } else {
          i++;
        }
      }
      i++;
      result += '""';
      continue;
    }
    if (code[i] === '<' && code[i + 1] === '<' && code[i + 2] === '<') {
      i += 3;
      while (i < len && (code[i] === ' ' || code[i] === '\t')) i++;
      let quote = '';
      if (code[i] === "'" || code[i] === '"') {
        quote = code[i];
        i++;
      }
      let identifier = '';
      while (i < len && /[a-zA-Z0-9_]/.test(code[i])) {
        identifier += code[i];
        i++;
      }
      if (quote && code[i] === quote) {
        i++;
      }
      while (i < len && code[i] !== '\n') i++;
      if (code[i] === '\n') {
        result += '\n';
        i++;
      }
      if (identifier.length > 0) {
        while (i < len) {
          const rest = code.slice(i);
          const lineMatch = rest.match(/^[ \t]*([a-zA-Z0-9_]+)(;?)/);
          if (lineMatch && lineMatch[1] === identifier) {
            i += lineMatch[0].length;
            result += '""';
            break;
          }
          const nextNewline = code.indexOf('\n', i);
          if (nextNewline === -1) {
            i = len;
            break;
          } else {
            result += '\n';
            i = nextNewline + 1;
          }
        }
      }
      continue;
    }
    result += code[i];
    i++;
  }
  return result;
}

/**
 * Extract method body based on brace depth.
 */
function extractMethodBody(code: string, methodName: string): string | null {
  const methodRegex = new RegExp(`function\\s+${methodName}\\s*\\([^)]*\\)[^{]*\\{`, 'g');
  const match = methodRegex.exec(code);
  if (!match) return null;

  let depth = 1;
  let i = match.index + match[0].length;
  const start = i;

  while (i < code.length && depth > 0) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') depth--;
    if (depth === 0) {
      return code.slice(start, i);
    }
    i++;
  }
  return null;
}

/**
 * Deterministic client evaluation for Week 5 Resilient Queue & Dead-Letter Pipeline
 */
export function evaluateQueueDlqDrill(code: string): {
  passed: boolean;
  queriesExecuted: number;
  simulatedLatencyMs: number;
  assertionResults: Array<{ name: string; passed: boolean; message: string }>;
} {
  const cleanCode = stripPhpCommentsAndInertStrings(code);

  // 1. Bounded retry attempts ($tries >= 2 and <= 5)
  const triesMatch = cleanCode.match(/(?:public|protected|private)?\s*(?:int\s+)?\$tries\s*=\s*(\d+)\s*;/);
  let hasValidTries = false;
  let triesMessage = 'Failed: Missing bounded $tries configuration (Must be configured: $tries = 3).';

  if (triesMatch) {
    const val = parseInt(triesMatch[1], 10);
    if (val >= 2 && val <= 5) {
      hasValidTries = true;
      triesMessage = `Passed: Bounded retry ceiling set to ${val} attempts.`;
    } else {
      triesMessage = `Failed: $tries value (${val}) out of safe bounds (must be between 2 and 5).`;
    }
  }

  // 2. Exponential backoff progression ($backoff array)
  const backoffMatch = cleanCode.match(/(?:public|protected|private)?\s*(?:array\s+)?\$backoff\s*=\s*\[([^\]]+)\]\s*;/);
  let hasValidBackoff = false;
  let backoffMessage = 'Failed: Missing exponential $backoff progression array (e.g. $backoff = [10, 60, 300];).';

  if (backoffMatch) {
    const intervals = backoffMatch[1].split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (intervals.length >= 2 && intervals[1] > intervals[0]) {
      hasValidBackoff = true;
      backoffMessage = `Passed: Exponential backoff intervals defined: [${intervals.join(', ')}] seconds.`;
    } else {
      backoffMessage = 'Failed: $backoff intervals must contain at least 2 progressive increasing intervals.';
    }
  }

  // 3. Idempotency guard in handle()
  const handleBody = extractMethodBody(cleanCode, 'handle');
  let hasIdempotency = false;
  let idempotencyMessage = 'Failed: Missing idempotency lock or key verification in handle() before database write.';

  if (handleBody) {
    const hasLock = /Cache::lock\s*\(/.test(handleBody) || /->\s*lock\s*\(/.test(handleBody) || handleBody.includes('insertOrIgnore');
    const referencesKey = handleBody.includes('idempotencyKey');

    if (hasLock || referencesKey) {
      hasIdempotency = true;
      idempotencyMessage = 'Passed: Idempotency protection enforced before database mutation.';
    }
  }

  // 4. Dead-letter queue routing in failed()
  const failedBody = extractMethodBody(cleanCode, 'failed');
  let hasDeadLetter = false;
  let dlqMessage = 'Failed: Missing failed(\\Throwable $exception) hook with dead-letter queue routing.';

  if (failedBody) {
    const recordsDeadLetter = failedBody.includes('dead_letter_jobs') || failedBody.includes('insert') || failedBody.includes('Log::error');
    if (recordsDeadLetter) {
      hasDeadLetter = true;
      dlqMessage = 'Passed: Dead-letter isolation and permanent failure logging implemented in failed() callback.';
    }
  }

  const passed = hasValidTries && hasValidBackoff && hasIdempotency && hasDeadLetter;

  return {
    passed,
    queriesExecuted: passed ? 2 : 0,
    simulatedLatencyMs: 18,
    assertionResults: [
      {
        name: 'Bounded Retry Ceiling ($tries)',
        passed: hasValidTries,
        message: triesMessage,
      },
      {
        name: 'Exponential Backoff Progression ($backoff)',
        passed: hasValidBackoff,
        message: backoffMessage,
      },
      {
        name: 'Idempotency Lock Enforcement',
        passed: hasIdempotency,
        message: idempotencyMessage,
      },
      {
        name: 'Dead-Letter Queue Isolation (failed)',
        passed: hasDeadLetter,
        message: dlqMessage,
      },
    ],
  };
}
