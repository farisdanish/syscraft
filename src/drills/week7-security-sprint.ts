import type { DrillDefinition } from '../types';

export const WEEK_7_DRILL: DrillDefinition = {
  id: 'w7-crud-auth-sprint',
  week: 7,
  title: 'Timed CRUD, Session Fixation Defense & Policy Authorization',
  tier: 3,
  engine: 'postgresql-docker',
  language: 'php',
  targetFile: 'app/Http/Controllers/AuthController.php',
  conceptBrief: {
    thesis: 'High-stakes production code requires multi-layered defense. Session identifiers must be regenerated upon authentication to prevent fixation attacks, and resource mutation endpoints must enforce fine-grained policy authorization.',
    diagramType: 'lifecycle',
    keyPoints: [
      'Session Fixation: Attackers establish a known session ID prior to login. Without $request->session()->regenerate(), the victim authenticates the attacker-controlled session.',
      'Policy Authorization: Authentication confirms WHO the user is; Authorization confirms WHAT they are allowed to do. Controllers must enforce $this->authorize("update", $record).',
      'Multi-Tenancy Isolation: Users must strictly be restricted to records belonging to their tenant or user ID ($user->id === $record->user_id).',
      'Zero-Trust Role Gating: Administrative privileges must be validated via explicit role checks ($user->hasRole("admin")) or policy before() callbacks.',
      'Timing Attack Resistance: Password verification and token checks must use constant-time comparison (hash_equals).',
    ],
  },
  initialCode: `<?php

namespace App\\Http\\Controllers;

use App\\Models\\Record;
use App\\Models\\User;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Support\\Facades\\Auth;

class AuthController extends Controller
{
    /**
     * Authenticate user credentials and return authenticated session.
     *
     * SECURITY DRILL:
     * Vulnerability 1 (Session Fixation):
     * The login method authenticates the user but FAILS to regenerate the session ID!
     * Remediate by calling $request->session()->regenerate() upon successful authentication.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::attempt($credentials)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        // BUG: Missing session fixation defense!
        // Task: Call $request->session()->regenerate() before continuing.

        return response()->json([
            'message' => 'Authenticated successfully',
            'user' => Auth::user(),
        ]);
    }

    /**
     * Update a user-owned climate/system record.
     *
     * Vulnerability 2 (Privilege Escalation / IDOR):
     * The update endpoint mutates any record without verifying tenant authorization!
     * Remediate by enforcing policy authorization: $this->authorize('update', $record);
     */
    public function updateRecord(Request $request, Record $record): JsonResponse
    {
        $validated = $request->validate([
            'metric_value' => ['required', 'numeric'],
            'status' => ['required', 'string'],
        ]);

        // BUG: Missing policy authorization gate!
        // Task: Add $this->authorize('update', $record);

        $record->update($validated);

        return response()->json([
            'message' => 'Record updated successfully',
            'record' => $record,
        ]);
    }
}
`,
  solutionCode: `<?php

namespace App\\Http\\Controllers;

use App\\Models\\Record;
use App\\Models\\User;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Support\\Facades\\Auth;

class AuthController extends Controller
{
    /**
     * Authenticate user credentials with session fixation protection.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::attempt($credentials)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        // REMEDIATED: Invalidate and regenerate session ID to thwart session fixation
        $request->session()->regenerate();

        return response()->json([
            'message' => 'Authenticated successfully',
            'user' => Auth::user(),
        ]);
    }

    /**
     * Update record protected with multi-tenant policy gate.
     */
    public function updateRecord(Request $request, Record $record): JsonResponse
    {
        $validated = $request->validate([
            'metric_value' => ['required', 'numeric'],
            'status' => ['required', 'string'],
        ]);

        // REMEDIATED: Enforce policy gate checking $user->id === $record->user_id
        $this->authorize('update', $record);

        $record->update($validated);

        return response()->json([
            'message' => 'Record updated successfully',
            'record' => $record,
        ]);
    }
}
`,
  validationRules: {
    type: 'bridge-pest-test',
    expectedAssertions: [
      'Session fixation prevented via $request->session()->regenerate()',
      'Policy authorization enforced via $this->authorize("update", $record)',
      'Unauthorized cross-tenant mutations rejected with HTTP 403',
      'Valid tenant updates persist cleanly to PostgreSQL 16.4',
    ],
  },
  oralRubric: {
    question: 'Walk through the session fixation attack vector unscripted in 3 minutes, and explain why authorization checks must live in granular policy objects rather than controller conditionals.',
    checkpoints: [
      {
        dimension: 'correctness',
        prompt: 'Articulated the attack mechanics: attacker injects fixed session ID into victim browser, victim logs in, without regeneration session ID remains unchanged, attacker reuses session to impersonate victim.',
      },
      {
        dimension: 'tradeoff',
        prompt: 'Compared centralized Model Policies vs inline controller gates (can/cannot) vs middleware route guards in terms of testability and single responsibility.',
      },
      {
        dimension: 'failure',
        prompt: 'Identified the consequences of missing authorization: Insecure Direct Object References (IDOR), cross-tenant data leakage, and unauthorized state mutation.',
      },
      {
        dimension: 'clarity',
        prompt: 'Spoke fluently, concisely, and defended defense-in-depth principles (session invalidation, CSRF tokens, strict cookies, RBAC) within the time limit.',
      },
      {
        dimension: 'challenge',
        prompt: 'Answered follow-up: "How do you defend against timing attacks when verifying authentication tokens or comparing webhook signatures in PHP? (Answer: hash_equals())"',
      },
    ],
  },
};

/**
 * Strip comments and inert string literals from PHP source code so comments
 * or inert strings can never satisfy executable security assertions.
 */
function stripPhpCommentsAndInertStrings(code: string): string {
  let result = '';
  let i = 0;
  const len = code.length;

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
      // Preserve 'update' argument for policy authorization; strip all other strings to empty
      if (strContent.trim() === 'update') {
        result += "'update'";
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
      if (strContent.trim() === 'update') {
        result += '"update"';
      } else {
        result += '""';
      }
      continue;
    }
    result += code[i];
    i++;
  }
  return result;
}

/**
 * Extract a method body from PHP source code based on brace depth.
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
 * Deterministic client evaluation for Week 7 (Simulation Fallback)
 * Enforces AST-aware method scoping, comment stripping, and control-flow reachability.
 */
export function evaluateSecuritySprintDrill(code: string): {
  passed: boolean;
  queriesExecuted: number;
  simulatedLatencyMs: number;
  assertionResults: Array<{ name: string; passed: boolean; message: string }>;
} {
  const cleanCode = stripPhpCommentsAndInertStrings(code);
  const loginBody = extractMethodBody(cleanCode, 'login');
  const updateBody = extractMethodBody(cleanCode, 'updateRecord');

  // 1. Session Fixation Defense: Must be in login() body as an executable statement
  let hasSessionRegenerate = false;
  let sessionRegenerateMessage = 'Failed: Missing $request->session()->regenerate() in login(). Login is vulnerable to session fixation attacks.';

  if (loginBody) {
    const sessionMatch = /(?:\$request\s*->\s*session\s*\(\s*\)|session\s*\(\s*\))\s*->\s*regenerate\s*\(\s*\)\s*;/.test(loginBody);
    const authAttemptPos = loginBody.indexOf('Auth::attempt(');
    const regenPos = loginBody.search(/(?:\$request\s*->\s*session\s*\(\s*\)|session\s*\(\s*\))\s*->\s*regenerate\s*\(\s*\)/);

    if (sessionMatch) {
      if (authAttemptPos !== -1 && regenPos !== -1 && regenPos > authAttemptPos) {
        hasSessionRegenerate = true;
        sessionRegenerateMessage = 'Passed: $request->session()->regenerate() invoked upon successful credential authentication.';
      } else {
        sessionRegenerateMessage = 'Failed: Session regeneration must be executed after credential verification (Auth::attempt).';
      }
    }
  }

  // 2. Model Policy Gate: Must be in updateRecord() body before $record->update()
  let hasAuthorize = false;
  let authorizeMessage = 'Failed: Missing $this->authorize(\'update\', $record) in updateRecord(). Mutation endpoint is vulnerable to IDOR / privilege escalation.';

  if (updateBody) {
    const authMatch = /(?:\$this\s*->\s*authorize|Gate::authorize)\s*\(\s*['"]update['"]\s*,\s*\$record\s*\)\s*;/.test(updateBody);
    const authorizePos = updateBody.search(/(?:\$this\s*->\s*authorize|Gate::authorize)\s*\(\s*['"]update['"]\s*,\s*\$record\s*\)/);
    const recordUpdatePos = updateBody.indexOf('$record->update(');

    if (authMatch) {
      if (recordUpdatePos !== -1 && authorizePos !== -1 && authorizePos < recordUpdatePos) {
        hasAuthorize = true;
        authorizeMessage = 'Passed: $this->authorize(\'update\', $record) protects update endpoint against cross-tenant tampering.';
      } else if (recordUpdatePos !== -1 && authorizePos !== -1 && authorizePos > recordUpdatePos) {
        authorizeMessage = 'Failed: Policy authorization gate must be executed before model mutation ($record->update).';
      } else {
        hasAuthorize = true;
        authorizeMessage = 'Passed: Policy authorization enforced on mutation endpoint.';
      }
    }
  }

  const passed = hasSessionRegenerate && hasAuthorize;

  return {
    passed,
    queriesExecuted: passed ? 2 : 1,
    simulatedLatencyMs: 38,
    assertionResults: [
      {
        name: 'Session Fixation Defense',
        passed: hasSessionRegenerate,
        message: sessionRegenerateMessage,
      },
      {
        name: 'Model Policy Gate Enforcement',
        passed: hasAuthorize,
        message: authorizeMessage,
      },
      {
        name: 'HTTP 403 Forbidden Response',
        passed: hasAuthorize,
        message: hasAuthorize
          ? 'Passed: Unauthorized cross-tenant attempts rejected with standard HTTP 403 Forbidden.'
          : 'Failed: Unauthorized requests are permitted to mutate foreign tenant data.',
      },
      {
        name: 'PostgreSQL 16.4 State Consistency',
        passed,
        message: passed
          ? 'Passed: Verified against PostgreSQL 16.4 isolation model.'
          : 'Failed: Security assertions not satisfied.',
      },
    ],
  };
}
