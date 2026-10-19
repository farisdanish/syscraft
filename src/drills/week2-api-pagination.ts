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
    thesis: 'Traditional OFFSET / LIMIT pagination degrades to O(N) table scanning at deep pages and produces skipped or duplicate records under concurrent writes. Seek-based cursor pagination provides an O(log N) B-tree seek that avoids scanning O(N) skipped offset rows and standards-compliant RFC 9457 error contracts.',
    diagramType: 'btree',
    keyPoints: [
      'OFFSET Penalty: OFFSET 100000 LIMIT 20 forces the database to read 100,020 tuples from disk, discarding the first 100,000.',
      'Seek-Based Cursors: Querying WHERE (recorded_at, id) < (:cursor_at, :cursor_id) jumps directly to the index boundary via B-Tree seek without scanning skipped rows.',
      'Eloquent Implementation: Because SQL row constructor syntax (a, b) < (c, d) is not supported across all drivers, implement it in query builder via: where("recorded_at", "<", $cAt)->orWhere(function ($q) use ($cAt, $cId) { $q->where("recorded_at", "=", $cAt)->where("id", "<", $cId); }).',
      'Concurrency Stability: Stable, immutable, unique ordering keys prevent offset shifting between pages during concurrent inserts. Note that cursor pagination does not provide full snapshot isolation; deletes, updates to ordering columns, and inserts behind the active cursor can still affect traversal.',
      'Opaque Tokens: Never expose raw IDs or schema internals directly in URLs. Package cursor state into one transport-safe token by JSON-encoding cursor attributes before base64 encoding (e.g. base64_encode(json_encode(["recorded_at" => ..., "id" => ...]))). This discourages clients from depending directly on individual cursor fields. Base64 provides transport encoding and schema obfuscation, not confidentiality or tamper-proofing; production tamper prevention requires an HMAC signature or authenticated encryption.',
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
    "Replace OFFSET with seek conditions: check if $cursor is passed, base64-decode and json-decode the token, and filter where (recorded_at, id) < (:recorded_at, :id).",
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
     * 1. Validate cursor: decode base64, decode JSON, verify required recorded_at and id fields. If malformed, return RFC 9457 HTTP 400 JSON with application/problem+json header.
     * 2. Replace OFFSET/LIMIT with seek-based filtering on recorded_at & id (use nested boolean orWhere).
     * 3. Return next_cursor as opaque base64 string (base64_encode(json_encode(['recorded_at' => $last->recorded_at, 'id' => $last->id]))) only when record count matches $limit, else null.
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
            $cursorData = null;
            if ($decoded !== false) {
                try {
                    $cursorData = json_decode($decoded, true, 512, JSON_THROW_ON_ERROR);
                } catch (\\JsonException $e) {
                    $cursorData = null;
                }
            }

            if (
                !is_array($cursorData) ||
                !isset($cursorData['recorded_at']) ||
                !is_string($cursorData['recorded_at']) ||
                $cursorData['recorded_at'] === '' ||
                !isset($cursorData['id']) ||
                !is_numeric($cursorData['id'])
            ) {
                return response()->json([
                    'type' => 'https://api.syscraft.io/errors/invalid-cursor',
                    'title' => 'Invalid Pagination Cursor',
                    'status' => 400,
                    'detail' => 'The cursor parameter is malformed or unparseable.',
                    'instance' => '/api/observations',
                ], 400, ['Content-Type' => 'application/problem+json']);
            }

            $cursorRecordedAt = $cursorData['recorded_at'];
            $cursorId = (int)$cursorData['id'];
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
            $nextCursor = base64_encode(json_encode([
                'recorded_at' => $last->recorded_at,
                'id' => $last->id,
            ], JSON_THROW_ON_ERROR));
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
        prompt: 'Accurately explained O(log N) index B-tree seek vs. O(N) heap tuple discard during deep pagination traversal.',
      },
      {
        dimension: 'tradeoff',
        prompt: 'Articulated trade-offs of cursor pagination: Prevents arbitrary random page jumping ("Page 42"), requires strict deterministic tie-breaker sorting, but eliminates offset shifting on concurrent inserts without guaranteeing full snapshot isolation.',
      },
      {
        dimension: 'failure',
        prompt: 'Detailed what happens when an ordering key is non-unique: without a secondary tie-breaker like id, records sharing identical timestamps are skipped or looped.',
      },
      {
        dimension: 'clarity',
        prompt: 'Explained opaque token packaging: how base64-encoded JSON hides schema representations and packages composite keys safely, and accurately noted that base64 alone is obfuscation rather than cryptographic tamper-proofing (which requires HMAC or encryption).',
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
 * Extract closure bodies following a target pattern based on brace depth.
 */
function extractAllClosuresAfter(code: string, pattern: string): string[] {
  const closures: string[] = [];
  let startPos = 0;
  while (startPos < code.length) {
    const idx = code.indexOf(pattern, startPos);
    if (idx === -1) break;
    const semiIdx = code.indexOf(';', idx);
    const braceIdx = code.indexOf('{', idx);
    if (braceIdx !== -1 && (semiIdx === -1 || braceIdx < semiIdx)) {
      let depth = 1;
      let i = braceIdx + 1;
      while (i < code.length && depth > 0) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') depth--;
        if (depth === 0) {
          closures.push(code.slice(braceIdx + 1, i));
          break;
        }
        i++;
      }
    }
    startPos = idx + pattern.length;
  }
  return closures;
}

/**
 * Evaluates whether a PHP condition is statically / unreachable false.
 */
function isStaticallyFalseCondition(cond: string): boolean {
  const trimmed = cond.trim();
  if (/^(?:false|0|null|!true|!1|""|''|\[\])$/i.test(trimmed)) {
    return true;
  }
  if (/^!(?:true|1|"[^"]*"|'[^']*')$/i.test(trimmed)) {
    return true;
  }
  const compMatch = trimmed.match(
    /^(\d+|true|false|'[^']*'|"[^"]*")\s*(===|==|!==|!=|<=|>=|<|>)\s*(\d+|true|false|'[^']*'|"[^"]*")$/i
  );
  if (compMatch) {
    const [, leftStr, op, rightStr] = compMatch;
    const parseConst = (s: string): string | number | boolean => {
      if (/^\d+$/.test(s)) return Number(s);
      if (/^true$/i.test(s)) return true;
      if (/^false$/i.test(s)) return false;
      if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
        return s.slice(1, -1);
      }
      return s;
    };
    const left = parseConst(leftStr);
    const right = parseConst(rightStr);
    let isTrue = false;
    switch (op) {
      case '===': isTrue = (left === right); break;
      case '==': isTrue = (left == right); break;
      case '!==': isTrue = (left !== right); break;
      case '!=': isTrue = (left != right); break;
      case '<': isTrue = (typeof left === 'number' && typeof right === 'number') ? (left < right) : false; break;
      case '>': isTrue = (typeof left === 'number' && typeof right === 'number') ? (left > right) : false; break;
      case '<=': isTrue = (typeof left === 'number' && typeof right === 'number') ? (left <= right) : false; break;
      case '>=': isTrue = (typeof left === 'number' && typeof right === 'number') ? (left >= right) : false; break;
    }
    return !isTrue;
  }
  return false;
}

/**
 * Evaluates whether a PHP condition is statically / always true.
 */
function isStaticallyTrueCondition(cond: string): boolean {
  const trimmed = cond.trim();
  if (/^(?:true|1)$/i.test(trimmed)) {
    return true;
  }
  const compMatch = trimmed.match(
    /^(\d+|true|false|'[^']*'|"[^"]*")\s*(===|==|!==|!=|<=|>=|<|>)\s*(\d+|true|false|'[^']*'|"[^"]*")$/i
  );
  if (compMatch) {
    const [, leftStr, op, rightStr] = compMatch;
    const parseConst = (s: string): string | number | boolean => {
      if (/^\d+$/.test(s)) return Number(s);
      if (/^true$/i.test(s)) return true;
      if (/^false$/i.test(s)) return false;
      if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
        return s.slice(1, -1);
      }
      return s;
    };
    const left = parseConst(leftStr);
    const right = parseConst(rightStr);
    switch (op) {
      case '===': return left === right;
      case '==': return left == right;
      case '!==': return left !== right;
      case '!=': return left != right;
      case '<': return (typeof left === 'number' && typeof right === 'number') ? (left < right) : false;
      case '>': return (typeof left === 'number' && typeof right === 'number') ? (left > right) : false;
      case '<=': return (typeof left === 'number' && typeof right === 'number') ? (left <= right) : false;
      case '>=': return (typeof left === 'number' && typeof right === 'number') ? (left >= right) : false;
    }
  }
  return false;
}

/**
 * Checks if a specific return statement is inside an unreachable or dead-code block.
 */
function isReturnUnreachable(code: string, returnIdx: number): boolean {
  let currentPos = returnIdx;
  while (currentPos > 0) {
    let depth = 0;
    let openBraceIdx = -1;
    for (let i = currentPos - 1; i >= 0; i--) {
      if (code[i] === '}') {
        depth++;
      } else if (code[i] === '{') {
        if (depth === 0) {
          openBraceIdx = i;
          break;
        }
        depth--;
      }
    }

    if (openBraceIdx === -1) {
      break;
    }

    // Check for unconditional return/throw/exit earlier in the same enclosing block
    let innerDepth = 0;
    let blockBody = '';
    for (let i = openBraceIdx + 1; i < currentPos; i++) {
      if (code[i] === '{') innerDepth++;
      else if (code[i] === '}') innerDepth--;
      else if (innerDepth === 0) {
        blockBody += code[i];
      }
    }
    if (/(?:^|[;{}])\s*(?:return\b|throw\b|exit\b)/.test(blockBody)) {
      return true;
    }

    // Check header before openBraceIdx
    let j = openBraceIdx - 1;
    while (j >= 0 && /\s/.test(code[j])) j--;

    if (j >= 0 && code[j] === ')') {
      let parenDepth = 0;
      let openParenIdx = -1;
      for (let k = j; k >= 0; k--) {
        if (code[k] === ')') {
          parenDepth++;
        } else if (code[k] === '(') {
          parenDepth--;
          if (parenDepth === 0) {
            openParenIdx = k;
            break;
          }
        }
      }
      if (openParenIdx !== -1) {
        let beforeParen = openParenIdx - 1;
        while (beforeParen >= 0 && /\s/.test(code[beforeParen])) beforeParen--;
        if (beforeParen >= 1) {
          const keywordMatch = code.slice(Math.max(0, beforeParen - 6), beforeParen + 1).match(/\b(?:if|elseif)\b/);
          if (keywordMatch) {
            const cond = code.slice(openParenIdx + 1, j).trim();
            if (isStaticallyFalseCondition(cond)) {
              return true;
            }
          }
        }
      }
    } else if (j >= 3 && code.slice(j - 3, j + 1) === 'else') {
      let k = j - 4;
      while (k >= 0 && /\s/.test(code[k])) k--;
      if (k >= 0 && code[k] === '}') {
        let ifDepth = 0;
        let ifOpenBrace = -1;
        for (let m = k - 1; m >= 0; m--) {
          if (code[m] === '}') ifDepth++;
          else if (code[m] === '{') {
            if (ifDepth === 0) {
              ifOpenBrace = m;
              break;
            }
            ifDepth--;
          }
        }
        if (ifOpenBrace !== -1) {
          let p = ifOpenBrace - 1;
          while (p >= 0 && /\s/.test(code[p])) p--;
          if (p >= 0 && code[p] === ')') {
            let pDepth = 0;
            let ifOpenParen = -1;
            for (let q = p; q >= 0; q--) {
              if (code[q] === ')') pDepth++;
              else if (code[q] === '(') {
                pDepth--;
                if (pDepth === 0) {
                  ifOpenParen = q;
                  break;
                }
              }
            }
            if (ifOpenParen !== -1) {
              const ifCond = code.slice(ifOpenParen + 1, p).trim();
              if (isStaticallyTrueCondition(ifCond)) {
                return true;
              }
            }
          }
        }
      }
    }

    currentPos = openBraceIdx;
  }

  return false;
}

/**
 * Detects if the RFC 9457 error return is enclosed in a dead-code branch (e.g. if (false), if (1 === 0), enclosing dead branch).
 */
function isDeadCodeBranch(code: string): boolean {
  const rfcIndices: number[] = [];
  let pos = 0;
  while ((pos = code.indexOf('application/problem+json', pos)) !== -1) {
    rfcIndices.push(pos);
    pos += 'application/problem+json'.length;
  }

  if (rfcIndices.length === 0) {
    return false;
  }

  // If ALL occurrences of application/problem+json are unreachable, return true
  for (const rfcIdx of rfcIndices) {
    const returnIdx = code.lastIndexOf('return', rfcIdx);
    if (returnIdx !== -1 && !isReturnUnreachable(code, returnIdx)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates next_cursor serialization:
 * Anchors specifically to next_cursor in the response,
 * requires base64_encode(json_encode([...])),
 * checks that both 'recorded_at' and 'id' are packaged in the payload,
 * and ensures their values derive from the last row of the returned response collection.
 */
function validateNextCursorGeneration(indexBody: string): { valid: boolean; message: string } {
  const hasBase64Encode = /base64_encode\s*\(/.test(indexBody);
  const hasNextCursorKey = indexBody.includes('next_cursor');

  if (!hasBase64Encode || !hasNextCursorKey) {
    return {
      valid: false,
      message: 'Failed: Missing next_cursor opaque token generation via base64_encode().',
    };
  }

  // 1. Identify the response returned with 'data' and 'next_cursor'
  const responseDataMatch = indexBody.match(/['"]data['"]\s*=>\s*\$([a-zA-Z0-9_]+)/);
  const responseDataVar = responseDataMatch ? responseDataMatch[1] : 'observations';

  const nextCursorReturnMatch = indexBody.match(/['"]next_cursor['"]\s*=>\s*([^,\]\r\n}]+)/);
  if (!nextCursorReturnMatch) {
    return {
      valid: false,
      message: 'Failed: Missing next_cursor in the JSON response payload.',
    };
  }

  const nextCursorTarget = nextCursorReturnMatch[1].trim();

  // 2. Anchor token generation to next_cursor's expression or assigned variable
  let tokenGenCode = '';
  if (nextCursorTarget.startsWith('$')) {
    const varName = nextCursorTarget.slice(1);
    const assignRegex = new RegExp(`\\$${varName}\\s*=\\s*([^;]+(?:base64_encode[\\s\\S]*?));`, 'i');
    const assignMatch = indexBody.match(assignRegex);
    if (assignMatch) {
      tokenGenCode = assignMatch[0];
    }
  } else if (nextCursorTarget.includes('base64_encode')) {
    tokenGenCode = nextCursorTarget;
  }

  if (!tokenGenCode || !/base64_encode\s*\(/.test(tokenGenCode)) {
    return {
      valid: false,
      message: 'Failed: Value assigned to next_cursor must be generated via base64_encode().',
    };
  }

  // 3. Locate json_encode inside or feeding into tokenGenCode
  let payloadStr = '';
  const inlineJsonMatch = tokenGenCode.match(/base64_encode\s*\(\s*json_encode\s*\(\s*\[([\s\S]*?)\]/);
  if (inlineJsonMatch) {
    payloadStr = inlineJsonMatch[1];
  } else {
    const inlineVarJsonMatch = tokenGenCode.match(/base64_encode\s*\(\s*json_encode\s*\(\s*\$([a-zA-Z0-9_]+)/);
    if (inlineVarJsonMatch) {
      const payloadVar = inlineVarJsonMatch[1];
      const payloadAssignMatch = indexBody.match(
        new RegExp(`\\$${payloadVar}\\s*=\\s*\\[([\\s\\S]*?)\\];`, 'i')
      );
      if (payloadAssignMatch) {
        payloadStr = payloadAssignMatch[1];
      }
    } else {
      const intermediateVarMatch = tokenGenCode.match(/base64_encode\s*\(\s*\$([a-zA-Z0-9_]+)/);
      if (intermediateVarMatch) {
        const jsonVar = intermediateVarMatch[1];
        const jsonAssignMatch = indexBody.match(
          new RegExp(`\\$${jsonVar}\\s*=\\s*json_encode\\s*\\(\\s*\\[([\\s\\S]*?)\\]`, 'i')
        );
        if (jsonAssignMatch) {
          payloadStr = jsonAssignMatch[1];
        } else {
          const jsonVarAssignMatch = indexBody.match(
            new RegExp(`\\$${jsonVar}\\s*=\\s*json_encode\\s*\\(\\s*\\$([a-zA-Z0-9_]+)`, 'i')
          );
          if (jsonVarAssignMatch) {
            const payloadVar = jsonVarAssignMatch[1];
            const payloadAssignMatch = indexBody.match(
              new RegExp(`\\$${payloadVar}\\s*=\\s*\\[([\\s\\S]*?)\\];`, 'i')
            );
            if (payloadAssignMatch) {
              payloadStr = payloadAssignMatch[1];
            }
          }
        }
      }
    }
  }

  if (!payloadStr) {
    return {
      valid: false,
      message: 'Failed: Next cursor must JSON-encode recorded_at and id prior to base64_encode().',
    };
  }

  const recAtMatch = payloadStr.match(/['"]recorded_at['"]\s*=>\s*([^,\]]+)/);
  const idMatch = payloadStr.match(/['"]id['"]\s*=>\s*([^,\]]+)/);

  if (!recAtMatch || !idMatch) {
    return {
      valid: false,
      message:
        'Failed: Next cursor JSON payload must package both recorded_at and id keys for composite seek boundary reconstruction.',
    };
  }

  const recAtVal = recAtMatch[1].trim();
  const idVal = idMatch[1].trim();

  // 4. Require values to derive from the last row of the returned response collection ($responseDataVar)
  const lastRowMatch = indexBody.match(
    new RegExp(`\\$([a-zA-Z0-9_]+)\\s*=\\s*[^;]*?\\$${responseDataVar}\\s*(?:->\\s*last\\s*\\(|end\\s*\\(|\\s*\\[)`, 'i')
  );
  const lastRowVar = lastRowMatch ? lastRowMatch[1] : null;

  const derivesFromReturnedCollection = (val: string, col: string): boolean => {
    if (lastRowVar) {
      const lastVarRegex = new RegExp(`^\\$${lastRowVar}\\s*(?:->\\s*${col}|\\[\\s*['"]${col}['"]\\s*\\])`);
      if (lastVarRegex.test(val)) return true;
    }
    const directChainRegex = new RegExp(
      `\\$${responseDataVar}\\s*->\\s*last\\s*\\(\\s*\\)\\s*(?:->\\s*${col}|\\[\\s*['"]${col}['"]\\s*\\])`
    );
    return directChainRegex.test(val);
  };

  const recAtDerived = derivesFromReturnedCollection(recAtVal, 'recorded_at');
  const idDerived = derivesFromReturnedCollection(idVal, 'id');

  if (!recAtDerived || !idDerived) {
    return {
      valid: false,
      message: `Failed: Next cursor recorded_at and id values must derive from the last returned row of the observations collection returned in the response (e.g. $last = $${responseDataVar}->last()).`,
    };
  }

  return {
    valid: true,
    message:
      'Passed: Next cursor serialized as an opaque base64-encoded JSON token with composite keys derived from returned observations.',
  };
}

interface CursorDecodeChain {
  hasStrictCursorDecode: boolean;
  cursorDataVar: string | null;
  decodedVar: string | null;
}

/**
 * Iterates candidate decode chains in indexBody and selects the one consuming the request cursor input.
 */
function resolveCursorDecodeChain(indexBody: string): CursorDecodeChain {
  const cursorInputMatch = indexBody.match(
    /\$([a-zA-Z0-9_]+)\s*=\s*(?:\$request->(?:query|input|get)\s*\(\s*['"]cursor['"]\s*\)|request\s*\(\s*['"]cursor['"]\s*\)|\$request->cursor|\$request\s*\[\s*['"]cursor['"]\s*\])/i
  );
  const cursorInputVar = cursorInputMatch ? cursorInputMatch[1] : 'cursor';

  const isCursorArg = (decodeArg: string): boolean => {
    const trimmed = decodeArg.trim();
    return (
      trimmed === `$${cursorInputVar}` ||
      trimmed === '$cursor' ||
      trimmed.includes('$request') ||
      trimmed.includes('request(')
    );
  };

  // 1. Iterate candidate base64_decode assignments with strict true flag
  const base64AssignRegex = /\$([a-zA-Z0-9_]+)\s*=\s*base64_decode\s*\(\s*([^,;]+?)\s*,\s*true\s*\)/gi;
  let bMatch: RegExpExecArray | null;
  while ((bMatch = base64AssignRegex.exec(indexBody)) !== null) {
    const candidateDecodedVar = bMatch[1];
    const decodeArg = bMatch[2];
    if (isCursorArg(decodeArg)) {
      const jsonAssignRegex = new RegExp(
        `\\$([a-zA-Z0-9_]+)\\s*=\\s*json_decode\\s*\\(\\s*\\$${candidateDecodedVar}\\b`,
        'i'
      );
      const jMatch = indexBody.match(jsonAssignRegex);
      if (jMatch) {
        return {
          hasStrictCursorDecode: true,
          cursorDataVar: jMatch[1],
          decodedVar: candidateDecodedVar,
        };
      }
      const bareJsonRegex = new RegExp(`json_decode\\s*\\(\\s*\\$${candidateDecodedVar}\\b`, 'i');
      if (bareJsonRegex.test(indexBody)) {
        return {
          hasStrictCursorDecode: true,
          cursorDataVar: null,
          decodedVar: candidateDecodedVar,
        };
      }
    }
  }

  // 2. Iterate candidate inline json_decode(base64_decode(..., true))
  const inlineAssignRegex =
    /\$([a-zA-Z0-9_]+)\s*=\s*json_decode\s*\(\s*base64_decode\s*\(\s*([^,;]+?)\s*,\s*true\s*\)/gi;
  let iMatch: RegExpExecArray | null;
  while ((iMatch = inlineAssignRegex.exec(indexBody)) !== null) {
    const candidateCursorDataVar = iMatch[1];
    const decodeArg = iMatch[2];
    if (isCursorArg(decodeArg)) {
      return {
        hasStrictCursorDecode: true,
        cursorDataVar: candidateCursorDataVar,
        decodedVar: null,
      };
    }
  }

  const bareInlineRegex = /json_decode\s*\(\s*base64_decode\s*\(\s*([^,;]+?)\s*,\s*true\s*\)/gi;
  let biMatch: RegExpExecArray | null;
  while ((biMatch = bareInlineRegex.exec(indexBody)) !== null) {
    const decodeArg = biMatch[1];
    if (isCursorArg(decodeArg)) {
      return {
        hasStrictCursorDecode: true,
        cursorDataVar: null,
        decodedVar: null,
      };
    }
  }

  // 3. Fallback for incomplete submissions
  const fallbackJsonMatch = indexBody.match(/\$([a-zA-Z0-9_]+)\s*=\s*json_decode\s*\(/i);
  return {
    hasStrictCursorDecode: false,
    cursorDataVar: fallbackJsonMatch ? fallbackJsonMatch[1] : null,
    decodedVar: null,
  };
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
  const decodeChain = indexBody
    ? resolveCursorDecodeChain(indexBody)
    : { hasStrictCursorDecode: false, cursorDataVar: null, decodedVar: null };

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
    const orderRecordedAtMatch = indexBody.match(
      /->\s*(?:orderBy\s*\(\s*['"]recorded_at['"]\s*,\s*['"]desc['"]|orderByDesc\s*\(\s*['"]recorded_at['"])\s*\)/i
    );
    const orderIdMatch = indexBody.match(
      /->\s*(?:orderBy\s*\(\s*['"]id['"]\s*,\s*['"]desc['"]|orderByDesc\s*\(\s*['"]id['"])\s*\)/i
    );
    const hasAscOrder = /->\s*(?:orderBy\s*\([^)]*['"]asc['"]|orderByAsc\s*\()/i.test(indexBody);
    const hasDeterministicOrder = Boolean(
      orderRecordedAtMatch &&
      orderIdMatch &&
      !hasAscOrder &&
      orderRecordedAtMatch.index !== undefined &&
      orderIdMatch.index !== undefined &&
      orderRecordedAtMatch.index < orderIdMatch.index
    );

    const hasBase64Decode = /base64_decode\s*\(/.test(indexBody);
    const hasJsonDecode = /json_decode\s*\(/.test(indexBody);
    const usesExplode = /explode\s*\(/.test(indexBody);

    const cursorDataVar = decodeChain.cursorDataVar;
    const hasStrictCursorDecode = decodeChain.hasStrictCursorDecode;

    // Identify intermediate variables assigned from decoded cursor
    const validRecordedAtVars = new Set<string>();
    const validIdVars = new Set<string>();

    if (cursorDataVar) {
      const recAtAssignRegex = new RegExp(
        `\\$([a-zA-Z0-9_]+)\\s*=\\s*[^;]*?\\$${cursorDataVar}\\s*(?:\\[\\s*['"]recorded_at['"]\\s*\\]|->recorded_at)`,
        'gi'
      );
      const idAssignRegex = new RegExp(
        `\\$([a-zA-Z0-9_]+)\\s*=\\s*[^;]*?\\$${cursorDataVar}\\s*(?:\\[\\s*['"]id['"]\\s*\\]|->id)`,
        'gi'
      );
      let m: RegExpExecArray | null;
      while ((m = recAtAssignRegex.exec(indexBody)) !== null) {
        validRecordedAtVars.add(m[1]);
      }
      while ((m = idAssignRegex.exec(indexBody)) !== null) {
        validIdVars.add(m[1]);
      }
    }

    const isRecordedAtSeekOperand = (operand: string | undefined): boolean => {
      if (!operand) return false;
      const trimmed = operand.trim();
      if (cursorDataVar) {
        const directRegex = new RegExp(
          `^(?:\\([a-zA-Z]+\\)\\s*)?\\$${cursorDataVar}\\s*(?:\\[\\s*['"]recorded_at['"]\\s*\\]|->recorded_at)`
        );
        if (directRegex.test(trimmed)) return true;
      }
      const varMatch = trimmed.match(/^(?:\([a-zA-Z]+\)\s*)?\$([a-zA-Z0-9_]+)/);
      return Boolean(varMatch && validRecordedAtVars.has(varMatch[1]));
    };

    const isIdSeekOperand = (operand: string | undefined): boolean => {
      if (!operand) return false;
      const trimmed = operand.trim();
      if (cursorDataVar) {
        const directRegex = new RegExp(
          `^(?:\\([a-zA-Z]+\\)\\s*)?\\$${cursorDataVar}\\s*(?:\\[\\s*['"]id['"]\\s*\\]|->id)`
        );
        if (directRegex.test(trimmed)) return true;
      }
      const varMatch = trimmed.match(/^(?:\([a-zA-Z]+\)\s*)?\$([a-zA-Z0-9_]+)/);
      return Boolean(varMatch && validIdVars.has(varMatch[1]));
    };

    // Tuple seek: whereRaw('(recorded_at, id) < (?, ?)', [$recAt, $id])
    const tupleMatch = indexBody.match(
      /whereRaw\s*\([^)]*\(?\s*recorded_at\s*,\s*id\s*\)?\s*<\s*\(?\s*\?\s*,\s*\?\s*\)?\s*,\s*\[\s*([^,\]]+)\s*,\s*([^,\]]+)\s*\]/i
    );
    const hasTupleComparison = Boolean(
      tupleMatch &&
      isRecordedAtSeekOperand(tupleMatch[1]) &&
      isIdSeekOperand(tupleMatch[2])
    );

    const recordedAtLtMatch = indexBody.match(/where\s*\(\s*['"]recorded_at['"]\s*,\s*['"]<['"]\s*,\s*([^,)]+)\)/i);
    const hasRecordedAtLtStructural = Boolean(recordedAtLtMatch);
    const hasRecordedAtLt = Boolean(recordedAtLtMatch && isRecordedAtSeekOperand(recordedAtLtMatch[1]));

    let hasTieBreakerBranch = false;
    let hasVariableBoundTieBreaker = false;
    const orWhereClosures = extractAllClosuresAfter(indexBody, 'orWhere');
    if (orWhereClosures.length > 0) {
      hasTieBreakerBranch = Boolean(
        hasRecordedAtLtStructural &&
        orWhereClosures.some((closure) => {
          const hasEqualRecordedAt =
            /where\s*\(\s*['"]recorded_at['"]\s*,\s*(?:['"]=['"]\s*,\s*)?([^,)]+)\)/i.test(closure) ||
            /recorded_at\s*=\s*/i.test(closure);
          const hasIdLt =
            /where\s*\(\s*['"]id['"]\s*,\s*['"]<['"]\s*,\s*([^,)]+)\)/i.test(closure) ||
            /id\s*<\s*/i.test(closure);
          return hasEqualRecordedAt && hasIdLt;
        })
      );

      hasVariableBoundTieBreaker = Boolean(
        hasRecordedAtLt &&
        orWhereClosures.some((closure) => {
          const eqMatch = closure.match(/where\s*\(\s*['"]recorded_at['"]\s*,\s*(?:['"]=['"]\s*,\s*)?([^,)]+)\)/i);
          const eqValid = Boolean(eqMatch && isRecordedAtSeekOperand(eqMatch[1]));

          const idMatch = closure.match(/where\s*\(\s*['"]id['"]\s*,\s*['"]<['"]\s*,\s*([^,)]+)\)/i);
          const idValid = Boolean(idMatch && isIdSeekOperand(idMatch[1]));

          return eqValid && idValid;
        })
      );
    }

    const hasCompositeSeek = hasTupleComparison || hasTieBreakerBranch;
    const hasVariableBoundSeek = hasTupleComparison || hasVariableBoundTieBreaker;

    if (!hasDeterministicOrder) {
      seekMessage =
        'Failed: Query must order deterministically by ->orderBy("recorded_at", "desc") followed by ->orderBy("id", "desc").';
    } else if (!hasBase64Decode || !hasJsonDecode || usesExplode) {
      seekMessage = 'Failed: Cursor must be decoded via strict base64_decode() and json_decode() without explode().';
    } else if (!hasCompositeSeek) {
      seekMessage =
        'Failed: Seek predicate lacks equality tie-breaker for duplicate timestamps. Use an orWhere closure branch grouping (recorded_at = ? AND id < ?) or tuple comparison (recorded_at, id) < (?, ?).';
    } else if (!hasStrictCursorDecode) {
      seekMessage =
        'Failed: json_decode() must consume the strict base64_decode($cursor, true) result.';
    } else if (!hasVariableBoundSeek) {
      seekMessage =
        'Failed: Seek variables must derive from the decoded cursor ($cursorData[\'recorded_at\'], $cursorData[\'id\']) rather than request inputs or unlinked variables.';
    } else {
      hasSeekPredicate = true;
      seekMessage =
        'Passed: Deterministic seek predicate implemented on composite keys (recorded_at, id) with tie-breaker ordering.';
    }
  }

  // 3. RFC 9457 Problem Details error contract
  let hasRfc9457 = false;
  let rfcMessage = 'Failed: Missing RFC 9457 Problem Details response on malformed cursor with HTTP 400.';

  if (indexBody) {
    const hasType = indexBody.includes("'type'") || indexBody.includes('"type"');
    const hasTitle = indexBody.includes("'title'") || indexBody.includes('"title"');
    const hasStatus = indexBody.includes("'status'") || indexBody.includes('"status"');
    const hasDetail = indexBody.includes("'detail'") || indexBody.includes('"detail"');
    const hasInstance = indexBody.includes("'instance'") || indexBody.includes('"instance"');
    const hasStatus400 = /400/.test(indexBody);
    const hasProblemJson = indexBody.includes('application/problem+json');

    const rfcLastIdx = indexBody.lastIndexOf('application/problem+json');
    const cursorVarIdx = decodeChain.cursorDataVar ? indexBody.indexOf(`$${decodeChain.cursorDataVar}`) : -1;
    const decodeIdx = cursorVarIdx !== -1 ? cursorVarIdx : indexBody.indexOf('base64_decode');
    const validationRegion =
      decodeIdx !== -1 && rfcLastIdx !== -1 && rfcLastIdx > decodeIdx
        ? indexBody.slice(decodeIdx, rfcLastIdx)
        : indexBody;

    const rfcCursorDataVar = decodeChain.cursorDataVar;

    let validatesRecordedAt = false;
    let validatesId = false;

    if (rfcCursorDataVar) {
      const recAtValRegex = new RegExp(
        `(?:array_key_exists\\s*\\(\\s*['"]recorded_at['"]\\s*,\\s*\\$${rfcCursorDataVar}\\)|(?:isset|empty|is_string|!\\s*\\$|\\bvalidat)[^;{}]*\\$${rfcCursorDataVar}(?:\\s*\\[\\s*['"]recorded_at['"]|->recorded_at))`,
        'i'
      );
      const idValRegex = new RegExp(
        `(?:array_key_exists\\s*\\(\\s*['"]id['"]\\s*,\\s*\\$${rfcCursorDataVar}\\)|(?:isset|empty|is_numeric|is_int|!\\s*\\$|\\bvalidat)[^;{}]*\\$${rfcCursorDataVar}(?:\\s*\\[\\s*['"]id['"]|->id))`,
        'i'
      );
      validatesRecordedAt = recAtValRegex.test(validationRegion);
      validatesId = idValRegex.test(validationRegion);
    }

    if (!hasType || !hasTitle || !hasStatus || !hasDetail || !hasInstance || !hasStatus400 || !hasProblemJson) {
      rfcMessage =
        'Failed: RFC 9457 contract requires type, title, status, detail, instance, HTTP 400, and application/problem+json header.';
    } else if (isDeadCodeBranch(indexBody)) {
      rfcMessage =
        'Failed: RFC 9457 Problem Details (HTTP 400) response must not be in a dead-code branch (e.g. if (false)).';
    } else if (!validatesRecordedAt || !validatesId) {
      rfcMessage =
        'Failed: Cursor validation must verify presence of recorded_at and id fields before returning HTTP 400 on malformed input.';
    } else {
      hasRfc9457 = true;
      rfcMessage =
        'Passed: Standard RFC 9457 Problem Details payload returned on invalid cursor input (HTTP 400).';
    }
  }

  // 4. Opaque next_cursor generation
  const nextCursorResult = indexBody ? validateNextCursorGeneration(indexBody) : { valid: false, message: 'Failed: Missing method body.' };
  const hasOpaqueToken = nextCursorResult.valid;
  const tokenMessage = nextCursorResult.message;

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
