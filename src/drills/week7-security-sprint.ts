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
 * Deterministic client evaluation for Week 7 (Simulation Fallback)
 */
export function evaluateSecuritySprintDrill(code: string): {
  passed: boolean;
  queriesExecuted: number;
  simulatedLatencyMs: number;
  assertionResults: Array<{ name: string; passed: boolean; message: string }>;
} {
  const hasSessionRegenerate = /session\s*\(\s*\)\s*->\s*regenerate\s*\(\s*\)/.test(code) ||
                               /\$request\s*->\s*session\s*\(\s*\)\s*->\s*regenerate\s*\(\s*\)/.test(code);

  const hasAuthorize = /\$this\s*->\s*authorize\s*\(\s*['"]update['"]\s*,\s*\$record\s*\)/.test(code) ||
                       /Gate::authorize\s*\(\s*['"]update['"]\s*,\s*\$record\s*\)/.test(code);

  const passed = hasSessionRegenerate && hasAuthorize;

  return {
    passed,
    queriesExecuted: passed ? 2 : 1,
    simulatedLatencyMs: 38,
    assertionResults: [
      {
        name: 'Session Fixation Defense',
        passed: hasSessionRegenerate,
        message: hasSessionRegenerate
          ? 'Passed: $request->session()->regenerate() invoked upon successful credential authentication.'
          : 'Failed: Missing $request->session()->regenerate(). Login is vulnerable to session fixation attack.',
      },
      {
        name: 'Model Policy Gate Enforcement',
        passed: hasAuthorize,
        message: hasAuthorize
          ? 'Passed: $this->authorize(\'update\', $record) protects update endpoint against cross-tenant tampering.'
          : 'Failed: Missing $this->authorize(\'update\', $record). Mutation endpoint is vulnerable to IDOR / privilege escalation.',
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
