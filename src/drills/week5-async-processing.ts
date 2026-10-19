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
    thesis: 'Background workers processing external sensor observations inevitably encounter transient downtime and corrupted payloads. Unprotected jobs can monopolize worker capacity through unconstrained retry loops; resilient pipelines enforce bounded attempts ($tries), exponential backoff, atomic concurrency locks, and dead-letter queue (DLQ) isolation.',
    diagramType: 'queue',
    keyPoints: [
      'Worker Attempt Limits: By default, Laravel attempts a job once unless retry flags or job-level bounds are set. Running php artisan queue:work --tries=N sets a worker ceiling, while --tries=0 allows unlimited retries. Declaring public int $tries on the Job class explicitly overrides worker flags, bounding execution so repeatedly failing poison jobs do not consume worker capacity.',
      'Configuration Precedence: Job-level properties ($tries and $backoff) declared on the Job class take precedence over queue worker daemon CLI flags. A bounded retry policy guarantees that failing jobs are failed cleanly after budgeted attempts.',
      'Exponential Backoff: Immediate retries cause thundering herds on recovering databases; $backoff = [10, 60, 300] allows downstream dependencies to recover gracefully.',
      'Durable Idempotency vs. Transient Locks: Cache::lock() guards against concurrent in-flight execution races, but once released, subsequent re-deliveries will re-acquire the lock. Durable idempotency requires an atomic insert/claim into a database table (e.g. processed_batches with unique idempotency_key) inside the same DB::transaction as observation writes. A concurrency lock alone is not durable idempotency.',
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
    "Define $tries property: public int $tries = 3; on the job class to override worker defaults with a bounded retry ceiling.",
    "Implement backoff schedule: public array $backoff = [10, 60, 300]; (or via backoff() method) to shed load during downstream outages.",
    "Enforce dual idempotency: acquire Cache::lock('telemetry_batch:'.$this->idempotencyKey, 120), then inside DB::transaction atomically claim processed_batches (idempotency_key) via insertOrIgnore (checking affected rows === 0 to return early on duplicate delivery) before writing observations, releasing the lock in finally. In failed(\\Throwable $e), log the error and insert into dead_letter_jobs with fields: idempotency_key, payload, exception, failed_at.",
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
     * DRILL: Unprotected Queue Job (Vulnerable to Worker Monopolization & Duplicate Writes)
     * 1. No bounded $tries configured: An unconfigured worker or --tries=0 allows jobs to retry indefinitely.
     * 2. No exponential $backoff: Immediate retries slam recovering downstream databases.
     * 3. No durable idempotency: Concurrent or retried executions insert duplicate sensor records.
     * 4. No failed() DLQ routing: Poisonous payloads fail to be isolated to dead_letter_jobs.
     *
     * TASKS:
     * 1. Define public int $tries = 3;
     * 2. Define public array $backoff = [10, 60, 300];
     * 3. Enforce idempotency: acquire Cache::lock("telemetry_batch:{$this->idempotencyKey}", 120),
     *    then atomically claim processed_batches in DB::transaction (e.g. insertOrIgnore) before inserting observations.
     *    Handle duplicate claims so redeliveries do not fail into the DLQ (avoid race-prone exists() checks).
     *    Always release lock in finally.
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
        // Concurrency lock + durable ledger guard
        $lock = Cache::lock("telemetry_batch:{$this->idempotencyKey}", 120);

        if (!$lock->get()) {
            Log::warning("Duplicate job execution prevented for idempotency key: {$this->idempotencyKey}");
            return;
        }

        try {
            $claimed = false;
            DB::transaction(function () use (&$claimed) {
                $affected = DB::table('processed_batches')->insertOrIgnore([
                    'idempotency_key' => $this->idempotencyKey,
                    'processed_at' => now()->toIso8601String(),
                ]);

                if ($affected === 0) {
                    return;
                }

                $claimed = true;
                foreach ($this->telemetryBatch as $reading) {
                    DB::table('weather_observations')->insertOrIgnore($reading);
                }
            });

            if (!$claimed) {
                Log::info("Batch already processed in durable ledger: {$this->idempotencyKey}");
                return;
            }
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
        prompt: 'Accurately articulated the relationship between worker reservation timeouts (retry_after), attempt limits ($tries), worker defaults, and job timeouts ($timeout).',
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
        prompt: 'Explained dual idempotency: using short-lived distributed concurrency locks (Cache::lock) coupled with durable database transaction claims (processed_batches) to prevent duplicate processing across retries.',
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
    'processed_batches',
    'processed_at',
    'idempotency_key',
    'idempotencyKey',
    'failed',
    'handle',
    'duplicate',
    'UNIQUE',
    'payload',
    'exception',
    'failed_at',
    'insertOrIgnore',
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
      } else if (/\$[a-zA-Z0-9_>-]*idempotencyKey\b/.test(strContent)) {
        result += `"${strContent}"`;
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
 * Extract closure block body following a target pattern based on brace depth.
 */
function extractClosureAfter(code: string, pattern: string): string | null {
  const idx = code.indexOf(pattern);
  if (idx === -1) return null;
  const braceIdx = code.indexOf('{', idx);
  if (braceIdx === -1) return null;
  let depth = 1;
  let i = braceIdx + 1;
  while (i < code.length && depth > 0) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') depth--;
    if (depth === 0) {
      return code.slice(braceIdx + 1, i);
    }
    i++;
  }
  return null;
}

/**
 * Splits top-level entries of a PHP array literal across matching braces/brackets/parentheses.
 */
function splitTopLevelArrayEntries(rawArgs: string): string[] | null {
  const trimmed = rawArgs.trim();
  let inner = '';
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    inner = trimmed.slice(1, -1);
  } else if (/^array\s*\(/i.test(trimmed) && trimmed.endsWith(')')) {
    const start = trimmed.indexOf('(');
    inner = trimmed.slice(start + 1, -1);
  } else {
    return null;
  }

  const entries: string[] = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let idx = 0; idx < inner.length; idx++) {
    const ch = inner[idx];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (ch === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      if (current.trim().length > 0) {
        entries.push(current.trim());
      }
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) {
    entries.push(current.trim());
  }

  return entries;
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
    const referencesKey = handleBody.includes('idempotencyKey');

    const lockAssignRegex = /\$([a-zA-Z0-9_]+)\s*=\s*(?:Cache::lock|->\s*lock)\s*\(/;
    const lockMatch = lockAssignRegex.exec(handleBody);
    const lockVar = lockMatch ? lockMatch[1] : null;

    let hasLock = false;
    let lockAcqPos = -1;
    if (lockVar) {
      const acqRegex = new RegExp(`\\$${lockVar}\\s*->\\s*(?:get|block)\\s*\\(`, 'g');
      const acqMatch = acqRegex.exec(handleBody);
      if (acqMatch) {
        hasLock = true;
        lockAcqPos = acqMatch.index;
      }
    }

    const txnPos = handleBody.search(/DB::transaction\s*\(/);

    let hasReleaseInFinally = false;
    if (lockVar) {
      const finallyIdx = handleBody.indexOf('finally');
      if (finallyIdx !== -1) {
        const afterFinally = handleBody.slice(finallyIdx);
        const braceIdx = afterFinally.indexOf('{');
        if (braceIdx !== -1) {
          let depth = 1;
          let i = braceIdx + 1;
          while (i < afterFinally.length && depth > 0) {
            if (afterFinally[i] === '{') depth++;
            else if (afterFinally[i] === '}') depth--;
            if (depth === 0) {
              const finallyBody = afterFinally.slice(braceIdx + 1, i);
              const releaseRegex = new RegExp(`\\$${lockVar}\\s*->\\s*release\\s*\\(`);
              hasReleaseInFinally = releaseRegex.test(finallyBody);
              break;
            }
            i++;
          }
        }
      }
    }

    const hasLedger = /['"]processed_batches['"]/.test(handleBody) && handleBody.includes('insert');
    const hasTransaction = txnPos !== -1;

    const txnClosure = extractClosureAfter(handleBody, 'DB::transaction');
    const ledgerInTxn = Boolean(txnClosure && /['"]processed_batches['"]/.test(txnClosure));
    const obsInTxn = Boolean(txnClosure && /['"]weather_observations['"]/.test(txnClosure));

    let ledgerBeforeObs = false;
    let ledgerMatch: RegExpExecArray | null = null;
    let obsMatch: RegExpExecArray | null = null;
    if (txnClosure) {
      ledgerMatch = /['"]processed_batches['"]/.exec(txnClosure);
      obsMatch = /['"]weather_observations['"]/.exec(txnClosure);
      ledgerBeforeObs = Boolean(ledgerMatch && obsMatch && ledgerMatch.index < obsMatch.index);
    }

    let hasValidAtomicClaim = false;
    let ledgerStoresKey = false;
    if (txnClosure && ledgerMatch && obsMatch && ledgerMatch.index < obsMatch.index) {
      const preObsCode = txnClosure.slice(0, obsMatch.index);
      const assignRegex = /\$([a-zA-Z0-9_]+)\s*=\s*[^;]*?['"]processed_batches['"][^;]*?->\s*insertOrIgnore\s*\(/;
      const assignMatch = assignRegex.exec(preObsCode);

      if (assignMatch) {
        const varName = assignMatch[1];
        const callArgStart = assignMatch.index + assignMatch[0].length;
        let parenDepth = 1;
        let k = callArgStart;
        let insertArgs = '';
        while (k < preObsCode.length && parenDepth > 0) {
          if (preObsCode[k] === '(') parenDepth++;
          else if (preObsCode[k] === ')') parenDepth--;
          if (parenDepth === 0) {
            insertArgs = preObsCode.slice(callArgStart, k);
            break;
          }
          k++;
        }
        const entries = splitTopLevelArrayEntries(insertArgs);
        if (entries) {
          let idempotencyKeyCount = 0;
          let validKeyEntryCount = 0;
          const keyRegex = /^\s*(['"])idempotency_key\1\s*=>\s*([\s\S]+?)\s*$/;

          for (const entry of entries) {
            const match = keyRegex.exec(entry);
            if (match) {
              idempotencyKeyCount++;
              const val = match[2].replace(/\s+/g, '');
              if (val === '$this->idempotencyKey') {
                validKeyEntryCount++;
              }
            }
          }

          ledgerStoresKey = idempotencyKeyCount === 1 && validKeyEntryCount === 1;
        }

        const postAssignCode = preObsCode.slice(assignMatch.index + assignMatch[0].length);

        const conditionRegex = new RegExp(
          `if\\s*\\(\\s*(?:` +
          `!\\s*\\$${varName}\\b|` +
          `empty\\s*\\(\\s*\\$${varName}\\s*\\)|` +
          `\\$${varName}\\s*(?:===?|<=?)\\s*0\\b|` +
          `\\$${varName}\\s*<\\s*1\\b|` +
          `\\$${varName}\\s*===?\\s*false\\b|` +
          `0\\s*(?:===?|>=?)\\s*\\$${varName}\\b|` +
          `false\\s*===?\\s*\\$${varName}\\b` +
          `)\\s*\\)`,
          'gi'
        );

        let ifMatch: RegExpExecArray | null = null;
        while ((ifMatch = conditionRegex.exec(postAssignCode)) !== null) {
          const afterIf = postAssignCode.slice(ifMatch.index + ifMatch[0].length).trim();
          let ifBody = '';
          if (afterIf.startsWith('{')) {
            let depth = 1;
            let j = 1;
            while (j < afterIf.length && depth > 0) {
              if (afterIf[j] === '{') depth++;
              else if (afterIf[j] === '}') depth--;
              if (depth === 0) {
                ifBody = afterIf.slice(1, j);
                break;
              }
              j++;
            }
          } else {
            const semi = afterIf.indexOf(';');
            if (semi !== -1) {
              ifBody = afterIf.slice(0, semi);
            }
          }

          if (/\breturn\b/.test(ifBody)) {
            hasValidAtomicClaim = true;
            break;
          }
        }
      }
    }

    if (!referencesKey) {
      idempotencyMessage = 'Failed: Missing references to $this->idempotencyKey in handle() concurrency guard.';
    } else if (!hasLock || (txnPos !== -1 && lockAcqPos > txnPos)) {
      idempotencyMessage = 'Failed: Atomic concurrency lock (Cache::lock with ->get() or ->block() on the lock variable) must be acquired before database transaction.';
    } else if (!hasLedger) {
      idempotencyMessage = 'Failed: Missing durable idempotency ledger claim in processed_batches table.';
    } else if (!hasTransaction || !ledgerInTxn || !obsInTxn) {
      idempotencyMessage = 'Failed: Both processed_batches claim and observation writes must occur atomically within a DB::transaction.';
    } else if (!ledgerBeforeObs) {
      idempotencyMessage = 'Failed: Durable idempotency claim on processed_batches must precede observation writes.';
    } else if (!hasReleaseInFinally) {
      idempotencyMessage = 'Failed: Atomic concurrency lock must be released inside a finally block on the acquired lock variable.';
    } else if (!hasValidAtomicClaim) {
      idempotencyMessage = 'Failed: Duplicate claims on processed_batches must be handled atomically (assign insertOrIgnore() result to a variable and check for zero/false with an early return before writing observations).';
    } else if (!ledgerStoresKey) {
      idempotencyMessage = "Failed: Durable idempotency ledger claim on processed_batches must store $this->idempotencyKey in the 'idempotency_key' column.";
    } else {
      hasIdempotency = true;
      idempotencyMessage = 'Passed: Durable idempotency enforced with atomic concurrency lock, processed_batches claim before observations, duplicate-claim handling, shared transaction, and finally release.';
    }
  }

  // 4. Dead-letter queue routing in failed()
  const failedBody = extractMethodBody(cleanCode, 'failed');
  let hasDeadLetter = false;
  let dlqMessage = 'Failed: Missing failed(\\Throwable $exception) hook with dead-letter queue routing.';

  if (failedBody) {
    const targetsDlqTable = failedBody.includes("'dead_letter_jobs'") || failedBody.includes('"dead_letter_jobs"');
    const hasInsert = /->\s*insert\s*\(/.test(failedBody);
    const hasIdempotencyKeyField = failedBody.includes("'idempotency_key'") || failedBody.includes('"idempotency_key"');
    const hasPayloadField = failedBody.includes("'payload'") || failedBody.includes('"payload"');
    const hasExceptionField = failedBody.includes("'exception'") || failedBody.includes('"exception"');
    const hasFailedAtField = failedBody.includes("'failed_at'") || failedBody.includes('"failed_at"');

    const hasAllFields = hasIdempotencyKeyField && hasPayloadField && hasExceptionField && hasFailedAtField;

    if (!targetsDlqTable || !hasInsert) {
      dlqMessage = 'Failed: failed() must insert the failed job payload into the dead_letter_jobs table (logging alone is insufficient).';
    } else if (!hasAllFields) {
      dlqMessage = 'Failed: dead_letter_jobs record must contain idempotency_key, payload, exception, and failed_at fields.';
    } else {
      hasDeadLetter = true;
      dlqMessage = 'Passed: Dead-letter isolation with complete fields (idempotency_key, payload, exception, failed_at) recorded in dead_letter_jobs.';
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
