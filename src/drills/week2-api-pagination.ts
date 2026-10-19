import type { DrillDefinition } from '../types';

export const WEEK_2_DRILL: DrillDefinition = {
  id: 'w2-rest-cursor-pagination',
  week: 2,
  title: 'REST Cursor Pagination & RFC 9457 Problem Details',
  tier: 1,
  engine: 'sqlite-wasm',
  language: 'php',
  targetFile: 'app/Http/Controllers/Api/ObservationApiController.php',
  conceptBrief: {
    thesis: 'Traditional OFFSET / LIMIT pagination degrades to O(N) table scanning at deep pages and produces skipped or duplicate records under concurrent writes. Seek-based cursor pagination provides deterministic O(1) entry and standards-compliant RFC 9457 error contracts.',
    diagramType: 'btree',
    keyPoints: [
      'OFFSET Penalty: OFFSET 100000 LIMIT 20 forces the database to read 100,020 tuples from disk, discarding the first 100,000.',
      'Seek-Based Cursors: Querying WHERE (recorded_at, id) < (:cursor_at, :cursor_id) jumps directly to the index boundary via B-Tree seek without scanning skipped rows.',
      'Eloquent Implementation: Because SQL row constructor syntax (a, b) < (c, d) is not supported across all drivers, implement it in query builder via: where("recorded_at", "<", $cAt)->orWhere(function ($q) use ($cAt, $cId) { $q->where("recorded_at", "=", $cAt)->where("id", "<", $cId); }).',
      'Concurrency Stability: Rows inserted before or after the cursor do not shift the current page offset; data never duplicates or disappears.',
      'Opaque Tokens: Never expose raw IDs or schema internals directly in URLs. Encode cursors as base64 strings (e.g. base64_encode("$recorded_at:$id")) to keep them opaque and decoupled from client assumptions. Note that base64 is encoding/obfuscation, not tamper-proofing; production tamper prevention requires an HMAC signature or authenticated encryption.',
      'RFC 9457 Problem Details: When a cursor is malformed, return HTTP 400 with Content-Type: application/problem+json. Under RFC 9457, all members (type, title, status, detail, instance) are technically optional (type defaults to "about:blank"), but SysCraft\'s API contract mandates these standard keys for machine-readable client diagnostics.',
    ],
    quiz: {
      question: 'Why does OFFSET 100000 degrade database query performance even when the query uses an index on id?',
      options: [
        {
          id: 'opt-a',
          label: 'The database storage engine must traverse and discard all 100,000 index entries sequentially before retrieving the requested page.',
          isCorrect: true,
          explanation: 'OFFSET N forces the storage engine to read N index rows into memory and discard them, resulting in O(N) execution cost on deep pages.',
        },
        {
          id: 'opt-b',
          label: 'The database table locks exclusively for the entire duration of an OFFSET query.',
          isCorrect: false,
          explanation: 'Standard SELECT queries do not acquire exclusive table locks during OFFSET operations.',
        },
        {
          id: 'opt-c',
          label: 'Network transfer payload increases proportionally with the OFFSET number.',
          isCorrect: false,
          explanation: 'Only the LIMIT rows are transferred across the wire; the delay is internal disk and index traversal overhead.',
        },
      ],
    },
  },
  hints: [
    "Replace OFFSET with seek conditions: check if $cursor is passed, decode base64, and filter where (recorded_at, id) < (:recorded_at, :id).",
    "On invalid or corrupted cursor format, return response()->json(['type' => 'https://api.syscraft.io/errors/invalid-cursor', 'title' => 'Invalid Pagination Cursor', 'status' => 400, 'detail' => 'The cursor parameter is malformed or unparseable.', 'instance' => '/api/observations'], 400, ['Content-Type' => 'application/problem+json']).",
    "Order deterministically: ->orderBy('recorded_at', 'desc')->orderBy('id', 'desc')->limit($limit).",
  ],
  initialCode: `<?php

namespace App\\Http\\Controllers\\Api;

use App\\Models\\WeatherObservation;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class ObservationApiController extends Controller
{
    /**
     * Return paginated weather observations using seek-based cursor pagination.
     *
     * DRILL: Currently uses naive OFFSET pagination which suffers from O(N) heap scans
     * and duplicate/skipped rows when new sensor records are inserted.
     * 
     * TASKS:
     * 1. Validate cursor: decode base64, check delimiter ':'. If malformed, return RFC 9457 HTTP 400 JSON with application/problem+json header.
     * 2. Replace OFFSET/LIMIT with seek-based filtering on recorded_at & id (use nested boolean orWhere).
     * 3. Return next_cursor as opaque base64 string (base64_encode("$recorded_at:$id")) only when record count matches $limit, else null.
     */
    public function index(Request $request): JsonResponse
    {
        $limit = min((int)$request->input('limit', 20), 100);
        $page = (int)$request->input('page', 1);

        // BUG: Inefficient OFFSET pagination
        $offset = ($page - 1) * $limit;
        $observations = WeatherObservation::orderBy('recorded_at', 'desc')
            ->orderBy('id', 'desc')
            ->offset($offset)
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $observations,
            'page' => $page,
        ]);
    }
}
`,
  solutionCode: `<?php

namespace App\\Http\\Controllers\\Api;

use App\\Models\\WeatherObservation;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;

class ObservationApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = min((int)$request->input('limit', 20), 100);
        $cursor = $request->input('cursor');

        $cursorRecordedAt = null;
        $cursorId = null;

        if ($cursor !== null) {
            $decoded = base64_decode($cursor, true);
            if ($decoded === false || !str_contains($decoded, ':')) {
                return response()->json([
                    'type' => 'https://api.syscraft.io/errors/invalid-cursor',
                    'title' => 'Invalid Pagination Cursor',
                    'status' => 400,
                    'detail' => 'The cursor parameter is malformed or unparseable.',
                    'instance' => '/api/observations',
                ], 400, ['Content-Type' => 'application/problem+json']);
            }

            [$cursorRecordedAt, $cursorId] = explode(':', $decoded, 2);
        }

        $query = WeatherObservation::query()
            ->orderBy('recorded_at', 'desc')
            ->orderBy('id', 'desc');

        if ($cursorRecordedAt && $cursorId) {
            $query->where(function ($q) use ($cursorRecordedAt, $cursorId) {
                $q->where('recorded_at', '<', $cursorRecordedAt)
                  ->orWhere(function ($sub) use ($cursorRecordedAt, $cursorId) {
                      $sub->where('recorded_at', '=', $cursorRecordedAt)
                          ->where('id', '<', $cursorId);
                  });
            });
        }

        $observations = $query->limit($limit)->get();

        $nextCursor = null;
        if ($observations->isNotEmpty() && $observations->count() === $limit) {
            $last = $observations->last();
            $nextCursor = base64_encode("{$last->recorded_at}:{$last->id}");
        }

        return response()->json([
            'data' => $observations,
            'next_cursor' => $nextCursor,
        ]);
    }
}
`,
  validationRules: {
    type: 'ast-property',
    expectedAssertions: [
      'Eliminated OFFSET and skip() query modifiers',
      'Seek-based composite comparison on (recorded_at, id)',
      'RFC 9457 Problem Details returned on malformed cursor (HTTP 400)',
      'Opaque base64 token generation for next_cursor',
    ],
  },
  oralRubric: {
    question: 'Defend seek-based cursor pagination over OFFSET/LIMIT under high-concurrency production workloads, and explain why RFC 9457 Problem Details is standard for REST APIs.',
    checkpoints: [
      {
        dimension: 'correctness',
        prompt: 'Accurately explained O(1) index boundary seek vs. O(N) heap tuple discard during deep pagination traversal.',
      },
      {
        dimension: 'tradeoff',
        prompt: 'Articulated trade-offs of cursor pagination: Prevents arbitrary random page jumping ("Page 42"), requires strict deterministic tie-breaker sorting, but eliminates duplicate records on concurrent inserts.',
      },
      {
        dimension: 'failure',
        prompt: 'Detailed what happens when an ordering key is non-unique: without a secondary tie-breaker like id, records sharing identical timestamps are skipped or looped.',
      },
      {
        dimension: 'clarity',
        prompt: 'Explained opaque token encoding: how base64 hides internal column names and schema representations from clients, and accurately noted that base64 alone is obfuscation rather than cryptographic tamper-proofing (which requires HMAC or encryption).',
      },
      {
        dimension: 'challenge',
        prompt: 'Answered follow-up: "Are RFC 9457 members required or optional in the RFC specification? Why does application/problem+json specify type (and its about:blank default) and status matching the HTTP response?"',
      },
    ],
  },
};

/**
 * Hardened PHP comment & inert string stripper for Week 2 validation.
 * Strips comments, docblocks, heredocs, nowdocs, backticks, and non-whitelisted strings.
 */
function stripPhpCommentsAndInertStrings(code: string): string {
  let result = '';
  let i = 0;
  const len = code.length;

  const whitelistedLiterals = new Set([
    'cursor',
    'recorded_at',
    'id',
    'limit',
    'desc',
    'asc',
    'data',
    'next_cursor',
    'type',
    'title',
    'status',
    'detail',
    'instance',
    'application/problem+json',
    'https://api.syscraft.io/errors/invalid-cursor',
    'invalid-cursor',
    ':',
    '<',
    '=',
  ]);

  while (i < len) {
    // Single-line comment //
    if (code[i] === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < len && code[i] !== '\n') i++;
      result += '\n';
      continue;
    }
    // Single-line comment #
    if (code[i] === '#') {
      i++;
      while (i < len && code[i] !== '\n') i++;
      result += '\n';
      continue;
    }
    // Multi-line comment /* ... */
    if (code[i] === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') result += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    // Single-quoted string '...'
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
      i++; // skip closing quote
      if (whitelistedLiterals.has(strContent.trim())) {
        result += `'${strContent.trim()}'`;
      } else {
        result += "''";
      }
      continue;
    }
    // Double-quoted string "..."
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
      i++; // skip closing quote
      if (whitelistedLiterals.has(strContent.trim())) {
        result += `"${strContent.trim()}"`;
      } else {
        result += '""';
      }
      continue;
    }
    // Backticks `...`
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
    // Heredoc / Nowdoc <<<TAG ... TAG;
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
 * Deterministic client evaluation for Week 2 REST Cursor Pagination & RFC 9457
 */
export function evaluateCursorPaginationDrill(code: string): {
  passed: boolean;
  queriesExecuted: number;
  simulatedLatencyMs: number;
  assertionResults: Array<{ name: string; passed: boolean; message: string }>;
} {
  const cleanCode = stripPhpCommentsAndInertStrings(code);
  const indexBody = extractMethodBody(cleanCode, 'index');

  // 1. Elimination of offset / skip
  let hasNoOffset = false;
  let offsetMessage = 'Failed: Query still utilizes offset() or skip(), which triggers O(N) sequential scans on deep pages.';

  if (indexBody) {
    const usesOffset = /->\s*(?:offset|skip)\s*\(/.test(indexBody);
    if (!usesOffset) {
      hasNoOffset = true;
      offsetMessage = 'Passed: Zero offset()/skip() calls. O(N) heap scans successfully eliminated.';
    }
  }

  // 2. Seek-based composite comparison on (recorded_at, id)
  let hasSeekPredicate = false;
  let seekMessage = 'Failed: Missing seek comparison on composite keys (recorded_at, id).';

  if (indexBody) {
    const hasDeterministicOrder =
      indexBody.includes('orderBy') &&
      indexBody.includes('recorded_at') &&
      indexBody.includes('id');
    const hasBase64Decode = /base64_decode\s*\(/.test(indexBody);

    const hasTupleComparison = /whereRaw\s*\([^)]*recorded_at[^)]*id[^)]*</i.test(indexBody);
    const hasIdComparisonInWhere =
      /where\s*\(\s*['"]id['"]\s*,\s*['"]<['"]/.test(indexBody) ||
      /where\s*\(\s*\[\s*['"]id['"]\s*,\s*['"]<['"]/.test(indexBody) ||
      /id\s*<\s*\$cursorId/.test(indexBody);
    const hasTieBreakerBranch =
      (/orWhere\s*\(/.test(indexBody) || /orWhereRaw\s*\(/.test(indexBody)) &&
      indexBody.includes('recorded_at') &&
      hasIdComparisonInWhere;

    const hasCompositeSeek = hasTupleComparison || hasTieBreakerBranch;

    if (!hasDeterministicOrder) {
      seekMessage = 'Failed: Missing deterministic orderBy clauses for both recorded_at and id.';
    } else if (!hasBase64Decode) {
      seekMessage = 'Failed: Missing base64_decode() invocation to parse opaque cursor.';
    } else if (!hasCompositeSeek) {
      seekMessage =
        'Failed: Seek predicate lacks equality tie-breaker for duplicate timestamps. Use an orWhere branch (recorded_at = ? AND id < ?) or tuple comparison (recorded_at, id) < (?, ?).';
    } else {
      hasSeekPredicate = true;
      seekMessage = 'Passed: Deterministic seek predicate implemented on composite keys (recorded_at, id) with tie-breaker ordering.';
    }
  }

  // 3. RFC 9457 Problem Details error contract
  let hasRfc9457 = false;
  let rfcMessage = 'Failed: Missing RFC 9457 Problem Details response on malformed cursor with HTTP 400.';

  if (indexBody) {
    const hasType = indexBody.includes('type');
    const hasTitle = indexBody.includes('title');
    const hasStatus400 = /400/.test(indexBody);
    const hasProblemJson = indexBody.includes('application/problem+json') || (hasType && hasTitle && hasStatus400);

    if (hasProblemJson && hasStatus400) {
      hasRfc9457 = true;
      rfcMessage = 'Passed: Standard RFC 9457 Problem Details payload returned on invalid cursor input (HTTP 400).';
    }
  }

  // 4. Opaque next_cursor generation
  let hasOpaqueToken = false;
  let tokenMessage = 'Failed: Missing next_cursor opaque token generation via base64_encode().';

  if (indexBody) {
    const hasBase64Encode = /base64_encode\s*\(/.test(indexBody);
    const hasNextCursorKey = indexBody.includes('next_cursor');

    if (hasBase64Encode && hasNextCursorKey) {
      hasOpaqueToken = true;
      tokenMessage = 'Passed: Next cursor serialized as an opaque base64-encoded token.';
    }
  }

  const passed = hasNoOffset && hasSeekPredicate && hasRfc9457 && hasOpaqueToken;

  return {
    passed,
    queriesExecuted: passed ? 1 : 4,
    simulatedLatencyMs: passed ? 8 : 145,
    assertionResults: [
      {
        name: 'Eliminated OFFSET & skip() Modifiers',
        passed: hasNoOffset,
        message: offsetMessage,
      },
      {
        name: 'Seek-based Composite Key Traversal',
        passed: hasSeekPredicate,
        message: seekMessage,
      },
      {
        name: 'RFC 9457 Problem Details Error Contract',
        passed: hasRfc9457,
        message: rfcMessage,
      },
      {
        name: 'Opaque base64 Cursor Token Generation',
        passed: hasOpaqueToken,
        message: tokenMessage,
      },
    ],
  };
}
